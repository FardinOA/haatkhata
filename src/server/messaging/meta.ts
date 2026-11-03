import "server-only";
/**
 * Meta messaging: Messenger, Instagram Direct and WhatsApp Cloud API.
 * - verifyMetaSignature: X-Hub-Signature-256 HMAC over the raw body (META_APP_SECRET)
 * - normalizeWebhook: one shape for the three platforms' webhook payloads
 * - ingest: routes a message to its business (by page / IG account / phone-number id)
 *   and stores it, matching the customer by phone
 * - sendMessage: replies via the Graph API, or the sandbox driver when no token is set
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { normalizePhone } from "@/lib/domain";
import { db, schema, withTenant } from "../db";
import { channelAccounts, conversations, messages } from "../db/schema-platform";
import { HttpError } from "../http";
import { decrypt } from "./crypto";

export type Platform = "messenger" | "instagram" | "whatsapp";
export const MESSAGING_WINDOW_MS = 24 * 3_600_000;
const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION ?? "v21.0"}`;

export function verifyMetaSignature(rawBody: string | Buffer, header: string | null, appSecret = process.env.META_APP_SECRET ?? "") {
  if (!header || !appSecret || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const got = header.slice(7);
  if (got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(expected, "hex"));
}

export type InboundMessage = {
  platform: Platform;
  accountExternalId: string;
  userExternalId: string;
  name?: string;
  text: string;
  externalId: string;
  at: Date;
  attachments: { type: string; url?: string }[];
};

type MessagingEvent = { sender?: { id: string }; recipient?: { id: string }; timestamp?: number; message?: { mid: string; text?: string; is_echo?: boolean; attachments?: { type: string; payload?: { url?: string } }[] } };

/** Turns any of the three webhook payload shapes into a flat list of inbound messages. */
export function normalizeWebhook(body: unknown): InboundMessage[] {
  const b = body as { object?: string; entry?: { id: string; messaging?: MessagingEvent[]; changes?: { value?: Record<string, unknown> }[] }[] };
  const out: InboundMessage[] = [];
  if (b.object === "page" || b.object === "instagram") {
    const platform: Platform = b.object === "page" ? "messenger" : "instagram";
    for (const entry of b.entry ?? [])
      for (const ev of entry.messaging ?? []) {
        if (!ev.message || ev.message.is_echo || !ev.sender) continue;
        out.push({
          platform,
          accountExternalId: entry.id,
          userExternalId: ev.sender.id,
          text: ev.message.text ?? "",
          externalId: ev.message.mid,
          at: new Date(ev.timestamp ?? Date.now()),
          attachments: (ev.message.attachments ?? []).map((a) => ({ type: a.type, url: a.payload?.url })),
        });
      }
  } else if (b.object === "whatsapp_business_account") {
    for (const entry of b.entry ?? [])
      for (const change of entry.changes ?? []) {
        const v = change.value as { metadata?: { phone_number_id: string }; contacts?: { wa_id: string; profile?: { name?: string } }[]; messages?: { from: string; id: string; timestamp: string; type: string; text?: { body: string }; image?: { id: string; caption?: string } }[] };
        if (!v?.metadata || !v.messages) continue;
        for (const m of v.messages) {
          out.push({
            platform: "whatsapp",
            accountExternalId: v.metadata.phone_number_id,
            userExternalId: m.from,
            name: v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name,
            text: m.text?.body ?? m.image?.caption ?? (m.type !== "text" ? `[${m.type}]` : ""),
            externalId: m.id,
            at: new Date(Number(m.timestamp) * 1000),
            attachments: m.type === "image" ? [{ type: "image" }] : [],
          });
        }
      }
  }
  return out;
}

const newId = (p: string) => `${p}${randomBytes(9).toString("base64url")}`;

/** Finds a phone number in free text, e.g. a customer typing their number in chat. */
function phoneIn(text: string) {
  const m = text.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).match(/(?:\+?88)?0?1[3-9][\d\s-]{8,11}/);
  return m ? normalizePhone(m[0]) : null;
}

/** Stores one inbound message. Idempotent on the platform's message id. */
export async function ingest(m: InboundMessage) {
  const [account] = await db.select().from(channelAccounts).where(and(eq(channelAccounts.platform, m.platform), eq(channelAccounts.externalId, m.accountExternalId)));
  if (!account) return { stored: false as const, reason: "unknown account" };
  return withTenant(account.businessId, async (tx) => {
    const dup = await tx.select({ id: messages.id }).from(messages).where(eq(messages.externalId, m.externalId));
    if (dup.length) return { stored: false as const, reason: "duplicate" };
    let [conv] = await tx.select().from(conversations).where(and(eq(conversations.accountId, account.id), eq(conversations.externalUserId, m.userExternalId)));
    const phone = m.platform === "whatsapp" ? normalizePhone(m.userExternalId) : phoneIn(m.text);
    if (!conv) {
      [conv] = await tx
        .insert(conversations)
        .values({ businessId: account.businessId, id: newId("cv_"), accountId: account.id, platform: m.platform, externalUserId: m.userExternalId, name: m.name ?? "", phone, lastText: m.text, lastMessageAt: m.at, lastInboundAt: m.at, unread: 0 })
        .returning();
    }
    const nextPhone = conv.phone ?? phone;
    let customerId = conv.customerId;
    if (!customerId && nextPhone) {
      const [c] = await tx.select({ id: schema.customers.id, name: schema.customers.name }).from(schema.customers).where(eq(schema.customers.phone, nextPhone));
      customerId = c?.id ?? null;
    }
    await tx.insert(messages).values({ businessId: account.businessId, id: newId("msg_"), conversationId: conv.id, direction: "in", text: m.text, attachments: m.attachments, externalId: m.externalId, status: "received", at: m.at });
    await tx
      .update(conversations)
      .set({ lastText: m.text || "[attachment]", lastMessageAt: m.at, lastInboundAt: m.at, unread: sql`${conversations.unread} + 1`, status: "open", phone: nextPhone, customerId, name: conv.name || m.name || "" })
      .where(eq(conversations.id, conv.id));
    return { stored: true as const, businessId: account.businessId, conversationId: conv.id };
  });
}

export function windowOpen(lastInboundAt: Date | null, now = Date.now()) {
  return !!lastInboundAt && now - lastInboundAt.getTime() < MESSAGING_WINDOW_MS;
}

/** Sends a reply. Enforces Meta's 24-hour customer-service window. */
export async function sendMessage(businessId: string, conversationId: string, text: string, opts: { byName: string; attachments?: { type: string; title?: string; price?: number; url?: string }[] }) {
  return withTenant(businessId, async (tx) => {
    const [conv] = await tx.select().from(conversations).where(eq(conversations.id, conversationId));
    if (!conv) throw new HttpError(404, "Conversation not found");
    if (!windowOpen(conv.lastInboundAt)) throw new HttpError(409, "More than 24 hours since the customer last wrote. Meta only allows replies inside that window — ask them to message again, or use an approved WhatsApp template.", "window_closed");
    const [account] = await tx.select().from(channelAccounts).where(eq(channelAccounts.id, conv.accountId));
    const id = newId("msg_");
    let status: "sent" | "failed" = "sent";
    let error: string | undefined;
    let externalId: string | null = null;
    const token = account?.tokenEnc ? decrypt(account.tokenEnc) : null;
    if (token) {
      try {
        const res =
          conv.platform === "whatsapp"
            ? await fetch(`${GRAPH}/${account.externalId}/messages`, {
                method: "POST",
                headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
                body: JSON.stringify({ messaging_product: "whatsapp", to: conv.externalUserId, type: "text", text: { body: text, preview_url: true } }),
              })
            : await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(token)}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ recipient: { id: conv.externalUserId }, messaging_type: "RESPONSE", message: { text } }),
              });
        const body = (await res.json().catch(() => ({}))) as { message_id?: string; messages?: { id: string }[]; error?: { message?: string } };
        if (!res.ok) throw new Error(body.error?.message ?? `Graph API ${res.status}`);
        externalId = body.message_id ?? body.messages?.[0]?.id ?? null;
      } catch (e) {
        status = "failed";
        error = (e as Error).message;
      }
    }
    // Sandbox (no token): the message is stored as sent so the inbox can be tried end to end.
    const at = new Date();
    await tx.insert(messages).values({ businessId, id, conversationId, direction: "out", text, attachments: opts.attachments ?? [], externalId, status, error, byName: opts.byName, at });
    await tx.update(conversations).set({ lastText: text, lastMessageAt: at, unread: 0 }).where(eq(conversations.id, conversationId));
    return { id, status, error, sandbox: !token };
  });
}

export async function recentMessages(businessId: string, conversationId: string, limit = 200) {
  return withTenant(businessId, (tx) => tx.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(desc(messages.at)).limit(limit));
}

import "server-only";
/** Web push (SRS FR-NOT-02) with VAPID. Expired subscriptions are removed on 404/410. */
import { and, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { schema, withTenant } from "../db";
import { notificationPrefs, pushSubscriptions } from "../db/schema-platform";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };
export type PushKind = "new_order" | "low_stock" | "cod_overdue" | "summary" | "test";

let configured: boolean | null = null;
export function pushConfigured() {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:support@haatkhata.com", pub, priv);
    configured = true;
  } else configured = false;
  return configured;
}

const PREF_FOR: Partial<Record<PushKind, "pushNewOrders" | "pushLowStock" | "pushCodOverdue">> = { new_order: "pushNewOrders", low_stock: "pushLowStock", cod_overdue: "pushCodOverdue" };

/**
 * Sends to the given users (or every owner and manager) who have push on for
 * this kind of notification. Returns how many devices accepted it.
 */
export async function notifyUsers(businessId: string, kind: PushKind, payload: PushPayload, opts: { userIds?: string[]; exceptUserId?: string } = {}) {
  if (!pushConfigured()) return { sent: 0, skipped: "not_configured" as const };
  const targets = await withTenant(businessId, async (tx) => {
    let userIds = opts.userIds;
    if (!userIds) {
      const managers = await tx.select({ userId: schema.memberships.userId }).from(schema.memberships).where(and(inArray(schema.memberships.role, ["owner", "manager"]), eq(schema.memberships.status, "active")));
      userIds = managers.map((m) => m.userId);
    }
    if (opts.exceptUserId) userIds = userIds.filter((u) => u !== opts.exceptUserId);
    if (!userIds.length) return [];
    const prefs = await tx.select().from(notificationPrefs).where(inArray(notificationPrefs.userId, userIds));
    const key = PREF_FOR[kind];
    const allowed = userIds.filter((u) => {
      const p = prefs.find((x) => x.userId === u);
      return !key || !p || p[key];
    });
    return allowed.length ? tx.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, allowed)) : [];
  });
  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    targets.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...payload, kind }), { TTL: 3600, urgency: kind === "new_order" ? "high" : "normal" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.id);
      }
    }),
  );
  if (gone.length) await withTenant(businessId, (tx) => tx.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone)));
  return { sent };
}

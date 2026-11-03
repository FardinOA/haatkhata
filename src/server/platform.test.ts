/**
 * Platform & messaging tests against Postgres: Meta signatures and payloads,
 * AI parsing fallback, API keys (scopes, revocation, tenant isolation),
 * signed webhooks with retry, the SMS consent rule, daily summaries, inbox.
 */
import { createHmac, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CommandPayload, CommandType } from "@/lib/commands";
import type { Role } from "@/lib/types";
import { createApiKey, revokeApiKey } from "./api-keys";
import { applyCommand } from "./apply";
import { parseOrder, setAnthropicClient } from "./ai/parse-order";
import { createBusiness } from "./business";
import { db, schema, withTenant } from "./db";
import { channelAccounts, conversations, messages, smsCredits, smsLog, webhookDeliveries, webhookEndpoints } from "./db/schema-platform";
import { encrypt } from "./messaging/crypto";
import { ingest, normalizeWebhook, sendMessage, verifyMetaSignature, windowOpen } from "./messaging/meta";
import { addSmsCredits, saveTemplate, sendCustomerSms, smsParts } from "./notify/sms";
import { composeSummary, dhakaDay, summaryData } from "./notify/summary";
import { enqueueEvent, processDueDeliveries, signPayload, verifyWebhookSignature } from "./notify/webhooks";
import { GET as listOrders, POST as createOrderApi } from "@/app/api/v1/orders/route";
import { GET as listProducts } from "@/app/api/v1/products/route";

const uid = () => randomBytes(8).toString("hex");
type Who = { businessId: string; userId: string; userName: string; role: Role };
const cmd = <T extends CommandType>(type: T, payload: CommandPayload<T>) => ({ id: `c${uid()}`, type, payload, at: new Date().toISOString() });

async function shop(): Promise<Who> {
  const userId = `u_${uid()}`;
  await db.insert(schema.users).values({ id: userId, phone: `017${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`, name: "Owner" });
  const businessId = await createBusiness(userId, { name: "Platform Shop", ownerName: "Owner", type: "online", channels: ["facebook"], sample: false });
  const owner: Who = { businessId, userId, userName: "Owner", role: "owner" };
  const r = await applyCommand(
    owner,
    cmd("product.save", {
      product: {
        id: "p_kurti",
        name: "Block-print Kurti",
        nameBn: "ব্লক প্রিন্ট কুর্তি",
        categoryId: "cat_kurti",
        unit: "pcs",
        images: [],
        art: { hue: "#3446C4", pattern: "dots" },
        optionTypes: [{ name: "Size", values: ["M", "L"] }],
        variants: [
          { id: "v_m", sku: "KRT-M", options: { Size: "M" }, price: 890, cost: 480, onHand: 0, reserved: 0, inTransit: 0, damaged: 0, lowStock: 2, active: true },
          { id: "v_l", sku: "KRT-L", options: { Size: "L" }, price: 890, cost: 480, onHand: 0, reserved: 0, inTransit: 0, damaged: 0, lowStock: 2, active: true },
        ],
        status: "active",
        tags: [],
        createdAt: new Date().toISOString(),
      },
      opening: { v_m: 10, v_l: 2 }, // L sits at its low-stock threshold
    }),
  );
  expect(r).toMatchObject({ status: "applied" });
  return owner;
}

const order = (who: Who, qty = 1, phone = "01755667788") =>
  applyCommand(
    who,
    cmd("order.create", {
      mode: "confirm",
      input: { channel: "facebook", customer: { name: "Sumaiya", phone, address: { line: "House 5", area: "Mirpur", district: "Dhaka" } }, lines: [{ key: "k", productId: "p_kurti", variantId: "v_m", qty, price: 890, discount: 0 }], discount: { type: "flat", value: 0 }, deliveryCharge: 70, otherCharges: 0, payments: [], settlement: "cod" },
    }),
  );

/* ------------------------------------------------------------ Meta */

describe("Meta webhooks", () => {
  it("verifies X-Hub-Signature-256 over the raw body", () => {
    const body = JSON.stringify({ object: "page", entry: [] });
    const sig = `sha256=${createHmac("sha256", "app-secret").update(body).digest("hex")}`;
    expect(verifyMetaSignature(body, sig, "app-secret")).toBe(true);
    expect(verifyMetaSignature(body + " ", sig, "app-secret")).toBe(false);
    expect(verifyMetaSignature(body, sig, "other")).toBe(false);
    expect(verifyMetaSignature(body, null, "app-secret")).toBe(false);
  });

  it("normalises Messenger, Instagram and WhatsApp payloads and skips echoes", () => {
    const ms = normalizeWebhook({ object: "page", entry: [{ id: "PAGE1", messaging: [{ sender: { id: "U1" }, recipient: { id: "PAGE1" }, timestamp: 1700000000000, message: { mid: "m1", text: "Kurti M ta ache?" } }, { sender: { id: "PAGE1" }, message: { mid: "m2", text: "echo", is_echo: true } }] }] });
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ platform: "messenger", accountExternalId: "PAGE1", userExternalId: "U1", text: "Kurti M ta ache?" });
    const ig = normalizeWebhook({ object: "instagram", entry: [{ id: "IG1", messaging: [{ sender: { id: "U2" }, timestamp: 1, message: { mid: "i1", text: "price?" } }] }] });
    expect(ig[0].platform).toBe("instagram");
    const wa = normalizeWebhook({ object: "whatsapp_business_account", entry: [{ id: "W", changes: [{ value: { metadata: { phone_number_id: "PN1" }, contacts: [{ wa_id: "8801711000000", profile: { name: "Rafi" } }], messages: [{ from: "8801711000000", id: "w1", timestamp: "1700000000", type: "text", text: { body: "Hi" } }] } }] }] });
    expect(wa[0]).toMatchObject({ platform: "whatsapp", accountExternalId: "PN1", name: "Rafi", text: "Hi" });
  });
});

/* ------------------------------------------------------------ inbox */

describe("inbox", () => {
  it("stores messages once, matches customers by phone, and enforces the 24-hour window", async () => {
    const s = await shop();
    await order(s, 1, "01711000000"); // creates customer with this phone
    const ext = `PN${uid()}`;
    await withTenant(s.businessId, (tx) => tx.insert(channelAccounts).values({ businessId: s.businessId, id: "ch1", platform: "whatsapp", externalId: ext, name: "Shop WA" }));
    const msg = { platform: "whatsapp" as const, accountExternalId: ext, userExternalId: "8801711000000", name: "Rafi", text: "Kurti M 2ta", externalId: `w${uid()}`, at: new Date(), attachments: [] };
    expect((await ingest(msg)).stored).toBe(true);
    expect((await ingest(msg)).stored).toBe(false); // duplicate
    const [conv] = await withTenant(s.businessId, (tx) => tx.select().from(conversations));
    expect(conv.phone).toBe("01711000000");
    expect(conv.customerId).toBeTruthy();
    expect(conv.unread).toBe(1);

    const sent = await sendMessage(s.businessId, conv.id, "Yes apu, 2ta available", { byName: "Owner" });
    expect(sent).toMatchObject({ status: "sent", sandbox: true });

    await withTenant(s.businessId, (tx) => tx.update(conversations).set({ lastInboundAt: new Date(Date.now() - 25 * 3_600_000) }).where(eq(conversations.id, conv.id)));
    await expect(sendMessage(s.businessId, conv.id, "late", { byName: "Owner" })).rejects.toMatchObject({ code: "window_closed" });
    expect(windowOpen(new Date(Date.now() - 23 * 3_600_000))).toBe(true);
    const n = await withTenant(s.businessId, (tx) => tx.select().from(messages).where(eq(messages.conversationId, conv.id)));
    expect(n).toHaveLength(2);
  });

  it("never routes a message to another shop's account", async () => {
    const a = await shop();
    const b = await shop();
    const ext = `PAGE${uid()}`;
    await withTenant(a.businessId, (tx) => tx.insert(channelAccounts).values({ businessId: a.businessId, id: "chA", platform: "messenger", externalId: ext, name: "A page", tokenEnc: encrypt("tok") }));
    await ingest({ platform: "messenger", accountExternalId: ext, userExternalId: "U9", text: "hello", externalId: `m${uid()}`, at: new Date(), attachments: [] });
    expect(await withTenant(a.businessId, (tx) => tx.select().from(conversations))).toHaveLength(1);
    expect(await withTenant(b.businessId, (tx) => tx.select().from(conversations))).toHaveLength(0);
  });
});

/* ------------------------------------------------------------ AI */

describe("AI order parsing", () => {
  const text = "Assalamu alaikum\nনাম: ফারহানা চৌধুরী\n০১৮১৫-৪৪৩৩২২\nবাসা ১৪, রোড ৩, মিরপুর ১০, ঢাকা\nKRT-M 2ta";
  // No size given, so the free reader can't pick a variant and the AI is worth asking.
  const vague = "Assalamu alaikum\nনাম: ফারহানা চৌধুরী\n০১৮১৫-৪৪৩৩২২\nবাসা ১৪, রোড ৩, মিরপুর ১০, ঢাকা\n2ta kurti";

  it("falls back to the rule parser without an API key", async () => {
    setAnthropicClient(null);
    const s = await shop();
    const r = await withTenant(s.businessId, (tx) => parseOrder(tx, s.businessId, text));
    expect(r.source).toBe("rules");
    expect(r.phone).toBe("01815443322");
    expect(r.items[0]).toMatchObject({ variantId: "v_m", qty: 2 });
  });

  it("doesn't spend an AI read when the free reader already got everything", async () => {
    const parse = vi.fn();
    setAnthropicClient({ beta: { messages: { parse } } } as never);
    const s = await shop();
    const r = await withTenant(s.businessId, (tx) => parseOrder(tx, s.businessId, text));
    expect(parse).not.toHaveBeenCalled();
    expect(r).toMatchObject({ source: "rules", usage: { used: 0, limit: 10 } });
    setAnthropicClient(null);
  });

  it("uses Claude's structured output, keeps only catalogue variants, and counts credits", async () => {
    const parse = vi.fn().mockResolvedValue({
      stop_reason: "end_turn",
      usage: { input_tokens: 900, output_tokens: 120 },
      parsed_output: { name: "ফারহানা চৌধুরী", phone: "০১৮১৫৪৪৩৩২২", address: "বাসা ১৪, রোড ৩", area: "Mirpur 10", district: "dhaka", items: [{ variantId: "v_m", text: "kurti M 2ta", qty: 2 }, { variantId: "v_fake", text: "saree", qty: 1 }], confidence: 0.9, notes: null },
    });
    setAnthropicClient({ beta: { messages: { parse } } } as never);
    const s = await shop();
    const r = await withTenant(s.businessId, (tx) => parseOrder(tx, s.businessId, vague));
    expect(r.source).toBe("ai");
    expect(r.phone).toBe("01815443322");
    expect(r.district).toBe("Dhaka");
    expect(r.items).toEqual([
      { productId: "p_kurti", variantId: "v_m", text: "kurti M 2ta", qty: 2 },
      { productId: undefined, variantId: undefined, text: "saree", qty: 1 },
    ]);
    expect(r.usage.used).toBe(1);
    const req = parse.mock.calls[0][0];
    expect(req.model).toBe("claude-haiku-5-5");
    expect(req.system[1].cache_control).toEqual({ type: "ephemeral" });
    expect(req.system[1].text).toContain("v_m | KRT-M");
  });

  it("falls back to rules when the API call fails", async () => {
    setAnthropicClient({ beta: { messages: { parse: vi.fn().mockRejectedValue(new Error("network down")) } } } as never);
    const s = await shop();
    const r = await withTenant(s.businessId, (tx) => parseOrder(tx, s.businessId, vague));
    expect(r.source).toBe("rules");
    setAnthropicClient(null);
  });
});

/* ------------------------------------------------------------ public API */

describe("public API keys", () => {
  const call = (handler: (req: Request, ...rest: never[]) => Promise<Response>, key: string, init: RequestInit = {}, url = "http://x/api/v1/orders") =>
    handler(new Request(url, { ...init, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.headers ?? {}) } }));

  it("enforces scopes, revocation and tenant isolation", async () => {
    const a = await shop();
    const b = await shop();
    await order(a);
    await order(b);
    await order(b);
    const readA = await createApiKey(a.businessId, { name: "Reporting", scopes: ["read"], createdBy: a.userId });

    const list = await call(listOrders, readA.key);
    expect(list.status).toBe(200);
    const body = await list.json();
    expect(body.data).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain('"cost"');

    const products = await (await call(listProducts, readA.key, {}, "http://x/api/v1/products")).json();
    expect(products.data[0].variants[0]).not.toHaveProperty("cost");

    const denied = await call(createOrderApi, readA.key, { method: "POST", body: JSON.stringify({ items: [{ variant_id: "v_m", qty: 1 }] }) });
    expect(denied.status).toBe(403);

    expect((await call(listOrders, "bk_live_nope")).status).toBe(401);
    await revokeApiKey(a.businessId, readA.id);
    expect((await call(listOrders, readA.key)).status).toBe(401);
  });

  it("creates orders through the command path, idempotently", async () => {
    const a = await shop();
    const key = await createApiKey(a.businessId, { name: "Website", scopes: ["read", "write"], createdBy: a.userId });
    const payload = JSON.stringify({ customer: { name: "Nabila", phone: "01912345678", address: { line: "Road 2", area: "Banani", district: "Dhaka" } }, items: [{ variant_id: "v_l", qty: 2 }], delivery_charge: 70 });
    const first = await call(createOrderApi, key.key, { method: "POST", body: payload, headers: { "idempotency-key": "order-42" } });
    expect(first.status).toBe(201);
    const o = await first.json();
    expect(o).toMatchObject({ status: "confirmed", totals: { total: 1850, cod: 1850 } });
    const again = await call(createOrderApi, key.key, { method: "POST", body: payload, headers: { "idempotency-key": "order-42" } });
    expect(again.status).toBe(200);
    expect((await again.json()).id).toBe(o.id);
    const [v] = await withTenant(a.businessId, (tx) => tx.select().from(schema.variants).where(eq(schema.variants.id, "v_l")));
    expect(v.reserved).toBe(2);
  });
});

/* ------------------------------------------------------------ webhooks */

describe("outbound webhooks", () => {
  const received: { headers: IncomingMessage["headers"]; body: string }[] = [];
  let failNext = false;
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      received.push({ headers: req.headers, body });
      res.statusCode = failNext ? 500 : 204;
      failNext = false;
      res.end();
    });
  });
  let url = "";
  beforeAll(async () => {
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("signs payloads so receivers can verify them", () => {
    const body = '{"event":"order.created"}';
    const header = signPayload("whsec_test", body, 1_700_000_000);
    expect(verifyWebhookSignature("whsec_test", body, header, 300, 1_700_000_100)).toBe(true);
    expect(verifyWebhookSignature("whsec_test", body + "x", header, 300, 1_700_000_100)).toBe(false);
    expect(verifyWebhookSignature("whsec_test", body, header, 300, 1_700_001_000)).toBe(false); // too old
  });

  it("delivers signed events and retries with backoff on failure", async () => {
    const s = await shop();
    const secret = "whsec_abc123";
    await withTenant(s.businessId, (tx) => tx.insert(webhookEndpoints).values({ businessId: s.businessId, id: "we1", url, secretEnc: encrypt(secret), events: ["order.created"] }));
    await enqueueEvent(s.businessId, "order.created", { id: "o_1", number: 1001 });
    await processDueDeliveries();
    const got = received.at(-1)!;
    expect(got.headers["x-bechakena-event"]).toBe("order.created");
    expect(verifyWebhookSignature(secret, got.body, String(got.headers["x-bechakena-signature"]))).toBe(true);
    const [d1] = await withTenant(s.businessId, (tx) => tx.select().from(webhookDeliveries));
    expect(d1).toMatchObject({ status: "delivered", attempts: 1, lastStatus: 204 });

    failNext = true;
    await enqueueEvent(s.businessId, "order.created", { id: "o_2" });
    await processDueDeliveries();
    const rows = await withTenant(s.businessId, (tx) => tx.select().from(webhookDeliveries));
    const failed = rows.find((r) => r.id !== d1.id)!;
    expect(failed).toMatchObject({ status: "pending", attempts: 1, lastStatus: 500 });
    expect(failed.nextAttemptAt.getTime() - Date.now()).toBeGreaterThan(50_000);
  });
});

/* ------------------------------------------------------------ SMS */

describe("customer SMS", () => {
  it("only sends due reminders to customers who agreed, and charges credits", async () => {
    const s = await shop();
    await saveTemplate(s.businessId, { key: "due_reminder", lang: "bn", body: "প্রিয় {customer}, ৳{due} বাকি আছে। — {shop}", enabled: true });
    await addSmsCredits(s.businessId, 10, "grant", "test");
    expect((await applyCommand(s, cmd("customer.upsert", { name: "Rehana", phone: "01822334455" }))).status).toBe("applied");
    const vars = { customer: "Rehana", due: "500", shop: "Platform Shop" };
    const without = await sendCustomerSms(s.businessId, { key: "due_reminder", to: "01822334455", vars });
    expect(without).toMatchObject({ status: "skipped", reason: "no_consent" });

    expect((await applyCommand(s, cmd("customer.upsert", { name: "Rehana", phone: "01822334455", smsConsent: true } as never))).status).toBe("applied");
    const withConsent = await sendCustomerSms(s.businessId, { key: "due_reminder", to: "01822334455", vars });
    expect(withConsent).toMatchObject({ status: "sent", parts: 1 });
    const [{ balance }] = await withTenant(s.businessId, async (tx) => [{ balance: (await tx.select().from(smsCredits)).reduce((t, c) => t + c.delta, 0) }]);
    expect(balance).toBe(9);
    const log = await withTenant(s.businessId, (tx) => tx.select().from(smsLog));
    expect(log.map((l) => l.status).sort()).toEqual(["sent", "skipped"]);
  });

  it("counts Bangla as Unicode SMS parts", () => {
    expect(smsParts("a".repeat(160))).toBe(1);
    expect(smsParts("ক".repeat(70))).toBe(1);
    expect(smsParts("ক".repeat(71))).toBe(2);
  });

  it("skips disabled templates and sends nothing without credits", async () => {
    const s = await shop();
    expect(await sendCustomerSms(s.businessId, { key: "order_confirmed", to: "01755667788", vars: {} })).toMatchObject({ status: "skipped", reason: "template_off" });
    await saveTemplate(s.businessId, { key: "order_confirmed", lang: "en", body: "Order #{order} confirmed", enabled: true });
    expect(await sendCustomerSms(s.businessId, { key: "order_confirmed", to: "01755667788", vars: { order: "1001" } })).toMatchObject({ status: "skipped", reason: "no_credits" });
  });
});

/* ------------------------------------------------------------ summary */

describe("daily summary", () => {
  it("reports today's sales, hides profit from roles without cost access, and lists low stock", async () => {
    const s = await shop();
    await order(s, 2); // 2 × 890 + 70 delivery
    const owner = await withTenant(s.businessId, (tx) => summaryData(tx, "owner"));
    expect(owner).toMatchObject({ sales: 1780, orders: 1, profit: (890 - 480) * 2 });
    expect(owner.lowStock.map((l) => l.name)).toEqual(["Block-print Kurti L"]); // M still has 8 available
    const sales = await withTenant(s.businessId, (tx) => summaryData(tx, "sales"));
    expect(sales.profit).toBeNull();

    const en = composeSummary(owner, "Platform Shop", "en");
    expect(en.text).toContain("Sales ৳1,780 · 1 order");
    expect(en.text).toContain("Gross profit ৳820");
    const bn = composeSummary(sales, "Platform Shop", "bn");
    expect(bn.text).toContain("বিক্রি ৳১,৭৮০ · ১টি অর্ডার");
    expect(bn.text).not.toContain("লাভ");
    expect(dhakaDay(new Date("2026-11-02T20:00:00Z"))).toMatchObject({ date: "2026-11-03", hour: 2 });
  });
});

/* ------------------------------------------------------------ post-apply hooks */

describe("post-apply hooks", () => {
  it("a confirmed order sends the confirmation SMS and an order.created webhook", async () => {
    const { runPostApplyHooks } = await import("./notify/hooks");
    const s = await shop();
    await saveTemplate(s.businessId, { key: "order_confirmed", lang: "en", body: "Hi {customer}, order #{order} confirmed. Total ৳{total}.", enabled: true });
    await addSmsCredits(s.businessId, 5, "grant", "test");
    await withTenant(s.businessId, (tx) => tx.insert(webhookEndpoints).values({ businessId: s.businessId, id: "weH", url: "http://127.0.0.1:9/unreachable", secretEnc: encrypt("whsec_h"), events: ["order.created"] }));
    const c = cmd("order.create", {
      mode: "confirm",
      input: { channel: "facebook", customer: { name: "Sumaiya", phone: "01755667788" }, lines: [{ key: "k", productId: "p_kurti", variantId: "v_m", qty: 1, price: 890, discount: 0 }], discount: { type: "flat", value: 0 }, deliveryCharge: 70, otherCharges: 0, payments: [], settlement: "cod" },
    });
    const outcome = await applyCommand(s, c);
    await runPostApplyHooks({ ...s, command: c as never, result: outcome.result });
    const log = await withTenant(s.businessId, (tx) => tx.select().from(smsLog));
    expect(log[0]).toMatchObject({ status: "sent", templateKey: "order_confirmed" });
    expect(log[0].body).toContain("Total ৳960");
    const deliveries = await withTenant(s.businessId, (tx) => tx.select().from(webhookDeliveries));
    expect(deliveries[0]).toMatchObject({ event: "order.created", attempts: 1, status: "pending" }); // unreachable → queued for retry
    expect((deliveries[0].payload as { data: { totals: { total: number } } }).data.totals.total).toBe(960);
  });
});

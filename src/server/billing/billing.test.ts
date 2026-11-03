/**
 * Billing, referrals, admin, custom roles and PIN — against real Postgres.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { CommandPayload, CommandType } from "@/lib/commands";
import { maxDiscountPct } from "@/lib/domain";
import type { Role } from "@/lib/types";
import { applyCommand } from "../apply";
import { businessDetail, impersonationTarget, requireSuperAdmin, resetPrints } from "../admin/service";
import { hashPin, PIN_MAX_FAILS, setPin, verifyPin } from "../auth/pin";
import { resolveRole, saveCustomRole } from "../auth/roles";
import { expireTrial, type AuthContext } from "../auth/session";
import { createBusiness } from "../business";
import { db, schema, withTenant } from "../db";
import { adminActions, referralCredits, subscriptionPayments } from "../db/schema-billing";
import { verifySslcommerzSignature } from "../integrations/billing/sslcommerz";
import { enforcePlanLimits } from "./limits";
import { claimPrints, printAllowance } from "./print-quota";
import { quote, usageLevel } from "./plans";
import { applyReferral, completePayment, getUsage, startCheckout } from "./service";

const uid = () => randomBytes(6).toString("hex");
async function makeUser(name = "Owner", superAdmin = false) {
  const id = `u_${uid()}`;
  await db.insert(schema.users).values({ id, phone: `018${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`, name, isSuperAdmin: superAdmin });
  return id;
}
async function shop(plan?: string) {
  const userId = await makeUser();
  const businessId = await createBusiness(userId, { name: `Shop ${uid()}`, ownerName: "Owner", type: "online", channels: ["facebook"], sample: false });
  if (plan) await db.update(schema.businesses).set({ plan, planOrderLimit: 2500 }).where(eq(schema.businesses.id, businessId));
  return { userId, businessId };
}
const cmd = <T extends CommandType>(type: T, payload: CommandPayload<T>) => ({ id: `c${uid()}`, type, payload, at: new Date().toISOString() });
const product = (id: string, variants = 1) => ({
  id,
  name: `P ${id}`,
  categoryId: "cat_kurti",
  unit: "pcs",
  images: [],
  art: { hue: "#C2306B", pattern: "plain" as const },
  optionTypes: variants > 1 ? [{ name: "Size", values: Array.from({ length: variants }, (_, i) => `S${i}`) }] : [],
  variants: Array.from({ length: variants }, (_, i) => ({ id: `${id}_v${i}`, sku: `${id}-${i}`, options: variants > 1 ? { Size: `S${i}` } : {}, price: 500, cost: 250, onHand: 0, reserved: 0, inTransit: 0, damaged: 0, lowStock: 2, active: true })),
  status: "active" as const,
  tags: [],
  createdAt: new Date().toISOString(),
});

describe("plans (FR-SUB-01)", () => {
  it("prices terms with a year billed as ten months and VAT included", () => {
    const q = quote("business", "year", 5);
    expect(q.total).toBe(7990);
    expect(q.months).toBe(12);
    expect(q.saved).toBe(1598);
    expect(q.vatAmount).toBeCloseTo((7990 * 5) / 105, 1);
    expect(quote("starter", "quarter", 5).total).toBe(897);
  });
  it("warns at 80% and blocks at 100%", () => {
    expect(usageLevel(79, 100)).toBe("ok");
    expect(usageLevel(80, 100)).toBe("warn");
    expect(usageLevel(100, 100)).toBe("full");
    expect(usageLevel(10_000, Number.POSITIVE_INFINITY)).toBe("ok");
  });

  it("an expired shop can't add orders, products, staff or suppliers, but can still edit", async () => {
    const { businessId } = await shop("expired");
    const run = (type: CommandType, payload: unknown, products: ReturnType<typeof product>[] = []) =>
      withTenant(businessId, async (tx) => {
        const st = (await import("@/lib/state")).initialState();
        st.products = products as never;
        return enforcePlanLimits(tx, businessId, type, payload, st);
      });
    await expect(run("order.create", { input: {}, mode: "confirm" })).rejects.toThrow(/no active plan/);
    await expect(run("product.save", { product: product("p_new") })).rejects.toThrow(/New products are paused without a plan/);
    await expect(run("product.save", { product: product("multi", 3) }, [product("multi")])).rejects.toThrow(/Sizes and colours/);
    await expect(run("staff.add", { name: "Mim", phone: "01911223344", role: "sales" })).rejects.toThrow(/up to 1 person/);
    await expect(run("staff.update", { id: "x", patch: { role: `custom:${businessId}:abc` } })).rejects.toThrow(/Custom roles/);
    await expect(run("supplier.add", { name: "S", phone: "" })).rejects.toThrow(/Suppliers/);
    await expect(run("product.save", { product: product("p1") }, [product("p1")])).resolves.toBeUndefined();
    await expect(run("order.note", { orderId: "o1", note: "call first" })).resolves.toBeUndefined();
  });

  it("caps new orders at the plan's monthly limit; drafts aren't counted", async () => {
    const { businessId } = await shop("starter");
    const run = (mode: string) => withTenant(businessId, (tx) => enforcePlanLimits(tx, businessId, "order.create", { input: {}, mode }, null as never));
    await withTenant(businessId, (tx) =>
      tx.insert(schema.orders).values(Array.from({ length: 500 }, (_, i) => ({ businessId, id: `o${i}`, no: i + 1, status: "confirmed", channel: "facebook", discount: { type: "flat", value: 0 }, settlement: "due", createdBy: "u", createdAt: new Date() }) as never)),
    );
    await expect(run("confirm")).rejects.toThrow(/all 500 orders on the Starter plan/);
    await expect(run("draft")).resolves.toBeUndefined();
  });

  it("a finished trial becomes expired, not free", async () => {
    const { businessId } = await shop();
    await db.update(schema.businesses).set({ trialEndsAt: new Date(Date.now() - 1000) }).where(eq(schema.businesses.id, businessId));
    await expireTrial(businessId);
    const u = await getUsage(businessId);
    expect(u.plan).toBe("expired");
    expect(u.renewsAt).toBeNull();
    expect(u.usage.orders.limit).toBe(0);
  });

  it("reports usage with levels for the UI", async () => {
    const { businessId } = await shop();
    const u = await getUsage(businessId);
    expect(u.plan).toBe("trial");
    expect(u.planName).toBe("Business trial");
    expect(u.trial?.daysLeft).toBe(7);
    expect(u.usage.products.limit).toBeNull(); // unlimited
    expect(u.usage.staff).toMatchObject({ used: 1, limit: 5, level: "ok" });
  });
});

describe("printing without a plan", () => {
  const who = (over: Partial<{ ip: string; device: string; businessId: string | null }> = {}) => ({ ip: `10.${uid()}`, device: `d${uid()}${uid()}`, businessId: null, ...over });
  it("allows PRINT_QUOTA orders per device, ever; reprints don't count", async () => {
    const me = who();
    expect(await claimPrints(me, ["o1", "o2", "o3"])).toMatchObject({ ok: true, paid: false, used: 3, left: 2 });
    expect(await claimPrints(me, ["o4", "o5"])).toMatchObject({ ok: true, used: 5, left: 0 });
    // All-or-nothing: a batch that doesn't fit counts nothing.
    expect(await claimPrints(me, ["o1", "o6"])).toMatchObject({ ok: false, used: 5 });
    expect(await claimPrints(me, ["o1", "o2"])).toMatchObject({ ok: true, used: 5 });
    expect(await printAllowance(me)).toMatchObject({ paid: false, left: 0 });
  });

  it("switching network or browser doesn't reset it", async () => {
    const { businessId } = await shop();
    const device = `d${uid()}${uid()}`;
    expect((await claimPrints(who({ device }), ["a", "b", "c", "d", "e"])).ok).toBe(true);
    expect((await claimPrints(who({ device }), ["f"])).ok).toBe(false); // new IP, same device
    expect((await claimPrints(who({ businessId }), ["a", "b", "c", "d", "e"])).ok).toBe(true);
    expect((await claimPrints(who({ businessId }), ["f"])).ok).toBe(false); // new device, same shop
  });

  it("caps an IP more loosely, so a shared carrier IP isn't locked out by one person", async () => {
    const ip = `10.${uid()}`;
    for (let i = 0; i < 3; i++) expect((await claimPrints(who({ ip }), [1, 2, 3, 4, 5].map((n) => `o${i}-${n}`))).ok).toBe(true);
    expect((await claimPrints(who({ ip }), ["o-last"])).ok).toBe(false); // 15 orders from one IP
  });

  it("an admin can give a shop its prints back, with the reason logged", async () => {
    const { businessId } = await shop();
    const me = who({ businessId });
    expect((await claimPrints(me, ["a", "b", "c", "d", "e"])).ok).toBe(true);
    expect((await businessDetail(businessId)).prints).toEqual({ used: 5, limit: 5 });
    const admin = await makeUser("Staff", true);
    expect(await resetPrints(admin, businessId, "Shared office IP (ticket 205)")).toEqual({ cleared: 15 }); // shop + device + IP rows
    expect(await printAllowance(me)).toMatchObject({ left: 5 });
    const [log] = await db.select().from(adminActions).where(and(eq(adminActions.businessId, businessId), eq(adminActions.action, "prints.reset")));
    expect(log.reason).toContain("ticket 205");
  });

  it("never counts a paid shop", async () => {
    const { businessId } = await shop("starter");
    const me = who({ businessId });
    expect(await claimPrints(me, Array.from({ length: 20 }, (_, i) => `o${i}`))).toMatchObject({ ok: true, paid: true });
    expect((await printAllowance({ ...me, businessId: null })).used).toBe(0);
  });
});

describe("subscription payments (FR-SUB-03)", () => {
  it("sandbox checkout activates the plan with a VAT receipt, idempotently", async () => {
    const { userId, businessId } = await shop();
    const start = await startCheckout({ businessId, userId, plan: "pro", term: "quarter", method: "bkash", origin: "http://localhost:3100" });
    expect(start.gateway).toBe("sandbox");
    expect(start.redirectUrl).toContain("/api/billing/sandbox?payment=");
    const paid = await completePayment(start.paymentId, { amount: 5997 });
    expect(paid.status).toBe("paid");
    expect(paid.invoiceNo).toMatch(/^BK-\d{4}-\d{6}$/);
    expect(paid.vatAmount).toBeGreaterThan(0);
    const again = await completePayment(start.paymentId, { amount: 5997 });
    expect(again.invoiceNo).toBe(paid.invoiceNo);
    const [b] = await db.select().from(schema.businesses).where(eq(schema.businesses.id, businessId));
    expect(b.plan).toBe("pro");
    expect(b.planOrderLimit).toBe(10000);
    expect(b.trialEndsAt).toBeNull();
    const months = Math.round((b.planRenewsAt!.getTime() - Date.now()) / (30.4 * 86_400_000));
    expect(months).toBe(3);
  });

  it("refuses an amount that doesn't match", async () => {
    const { userId, businessId } = await shop();
    const start = await startCheckout({ businessId, userId, plan: "starter", term: "month", method: "card", origin: "http://x" });
    await expect(completePayment(start.paymentId, { amount: 1 })).rejects.toThrow(/doesn't match/);
  });

  it("validates SSLCommerz IPN signatures", () => {
    const pass = "store-secret";
    const fields: Record<string, string> = { tran_id: "sp_1", val_id: "v1", amount: "799.00", status: "VALID", verify_key: "amount,status,tran_id,val_id" };
    const data: Record<string, string> = { amount: "799.00", status: "VALID", tran_id: "sp_1", val_id: "v1", store_passwd: createHash("md5").update(pass).digest("hex") };
    const str = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join("&");
    fields.verify_sign = createHash("md5").update(str).digest("hex");
    expect(verifySslcommerzSignature(fields, pass)).toBe(true);
    expect(verifySslcommerzSignature({ ...fields, amount: "1.00" }, pass)).toBe(false);
    expect(verifySslcommerzSignature({ ...fields }, "wrong")).toBe(false);
  });
});

describe("referrals (FR-SUB-05)", () => {
  it("gives both shops a free month on the referred shop's first payment, used on the next one", async () => {
    const ref = await shop();
    const [{ referralCode }] = await db.select({ referralCode: schema.businesses.referralCode }).from(schema.businesses).where(eq(schema.businesses.id, ref.businessId));
    const neu = await shop();
    await applyReferral(neu.businessId, referralCode!);
    await expect(applyReferral(neu.businessId, referralCode!)).rejects.toThrow(/already applied/);

    const p1 = await startCheckout({ ...neu, plan: "business", term: "month", method: "bkash", origin: "http://x" });
    await completePayment(p1.paymentId, {});
    const creditsRef = await db.select().from(referralCredits).where(eq(referralCredits.businessId, ref.businessId));
    const creditsNew = await db.select().from(referralCredits).where(eq(referralCredits.businessId, neu.businessId));
    expect(creditsRef.map((c) => c.months)).toEqual([1]);
    expect(creditsNew.map((c) => c.reason)).toEqual(["referred"]);

    // The referrer's next payment includes the free month.
    const p2 = await startCheckout({ ...ref, plan: "starter", term: "month", method: "card", origin: "http://x" });
    const paid = await completePayment(p2.paymentId, {});
    expect(paid.creditMonths).toBe(1);
    const [used] = await db.select().from(referralCredits).where(and(eq(referralCredits.businessId, ref.businessId)));
    expect(used.usedPaymentId).toBe(p2.paymentId);
  });
});

describe("super-admin (FR-ADM-01)", () => {
  const authOf = (u: Partial<AuthContext["user"]>, impersonatedBy: string | null = null) => ({ sessionId: "s", user: { id: "u", phone: "", name: "", email: null, lang: "en", numerals: "latin", isSuperAdmin: false, createdAt: new Date(), ...u }, businessId: null, role: null, impersonatedBy }) as AuthContext;

  it("only super-admins get in, and never while impersonating", () => {
    expect(() => requireSuperAdmin(null)).toThrow(/sign in/);
    expect(() => requireSuperAdmin(authOf({}))).toThrow(/staff only/);
    expect(() => requireSuperAdmin(authOf({ isSuperAdmin: true }, "u_admin"))).toThrow(/staff only/);
    expect(() => requireSuperAdmin(authOf({ isSuperAdmin: true }))).not.toThrow();
  });

  it("logs impersonation with its reason", async () => {
    const admin = await makeUser("Admin", true);
    const s = await shop();
    const owner = await impersonationTarget(admin, s.businessId, "Customer asked for help with invoices");
    expect(owner).toBe(s.userId);
    const [log] = await db.select().from(adminActions).where(and(eq(adminActions.businessId, s.businessId), eq(adminActions.action, "impersonate.start")));
    expect(log).toMatchObject({ adminUserId: admin, reason: "Customer asked for help with invoices" });
  });
});

describe("custom roles (FR-AUTH-06)", () => {
  it("are enforced on the server and can't leak across businesses", async () => {
    const s = await shop("pro");
    const owner = { businessId: s.businessId, userId: s.userId, userName: "Owner", role: "owner" as Role };
    expect((await applyCommand(owner, cmd("product.save", { product: product("tee") as never, opening: { tee_v0: 10 } }))).status).toBe("applied");

    const key = await saveCustomRole(s.businessId, { name: "Counter", permissions: ["create_order", "edit_stock"], maxDiscountPct: 5 });
    const role = await resolveRole(s.businessId, key);
    expect(role).toBe(key);
    expect(maxDiscountPct(role)).toBe(5);
    const counter = { ...owner, role };
    expect((await applyCommand(counter, cmd("stock.adjust", { variantId: "tee_v0", newOnHand: 9, reason: "adjust" }))).status).toBe("applied");
    expect(await applyCommand(counter, cmd("expense.add", { category: "other", amount: 10, date: new Date().toISOString(), method: "cash" }))).toMatchObject({ status: "rejected", code: "forbidden" });
    const input = (pct: number) => ({ channel: "walkin" as const, customer: null, lines: [{ key: "k", productId: "tee", variantId: "tee_v0", qty: 1, price: 500, discount: 0 }], discount: { type: "pct" as const, value: pct }, deliveryCharge: 0, otherCharges: 0, payments: [], settlement: "due" as const });
    expect(await applyCommand(counter, cmd("order.create", { input: input(10), mode: "complete" }))).toMatchObject({ status: "rejected", code: "forbidden" });
    expect((await applyCommand(counter, cmd("order.create", { input: input(5), mode: "complete" }))).status).toBe("applied");

    // Another business can't borrow this role, even by writing its key.
    const other = await shop("pro");
    const stolen = await resolveRole(other.businessId, key);
    expect(stolen).not.toBe(key);
    expect(await applyCommand({ businessId: other.businessId, userId: other.userId, userName: "X", role: stolen }, cmd("expense.add", { category: "other", amount: 10, date: new Date().toISOString(), method: "cash" }))).toMatchObject({ status: "rejected" });
  });
});

describe("device PIN (FR-AUTH-08)", () => {
  it("hashes PINs, refuses weak ones, and signs the device out after 5 wrong tries", async () => {
    await expect(hashPin("1111")).rejects.toThrow(/harder to guess/);
    await expect(hashPin("12a4")).rejects.toThrow(/4 digits/);
    const h = await hashPin("4826");
    expect(h).toMatch(/^scrypt\$/);
    expect(h).not.toContain("4826");

    const userId = await makeUser();
    const sessionId = `s_${uid()}`;
    await db.insert(schema.sessions).values({ id: sessionId, tokenHash: uid(), userId });
    await setPin(sessionId, userId, "4826");
    expect(await verifyPin(sessionId, "4826")).toEqual({ ok: true });
    for (let i = 1; i < PIN_MAX_FAILS; i++) expect(await verifyPin(sessionId, "0000")).toMatchObject({ ok: false, left: PIN_MAX_FAILS - i, locked: false });
    expect(await verifyPin(sessionId, "0000")).toMatchObject({ ok: false, locked: true });
    const [sess] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId));
    expect(sess.revokedAt).not.toBeNull();
  });
});

void subscriptionPayments;

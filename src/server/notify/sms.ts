import "server-only";
/**
 * Customer SMS (SRS FR-NOT-03, FR-PAY-03): editable bilingual templates,
 * prepaid credits, a send log, and the consent rule for due reminders.
 */
import { desc, eq, sql } from "drizzle-orm";
import { schema, withTenant, type Tx } from "../db";
import { smsCredits, smsLog, smsTemplates } from "../db/schema-platform";
import { sendSms } from "../integrations/sms";

export type SmsKey = "order_confirmed" | "order_shipped" | "order_delivered" | "due_reminder";
export const SMS_KEYS: SmsKey[] = ["order_confirmed", "order_shipped", "order_delivered", "due_reminder"];

/** Variables a template may use. */
export const SMS_VARIABLES = ["customer", "shop", "order", "total", "cod", "due", "courier", "tracking", "shop_phone"] as const;
export type SmsVars = Partial<Record<(typeof SMS_VARIABLES)[number], string>>;

export const DEFAULT_TEMPLATES: Record<SmsKey, { en: string; bn: string }> = {
  order_confirmed: {
    en: "Hi {customer}, your order #{order} at {shop} is confirmed. Total ৳{total}. We'll text you when it ships.",
    bn: "{customer}, {shop}-এ আপনার অর্ডার #{order} নিশ্চিত হয়েছে। মোট ৳{total}। পাঠানোর সময় জানাব।",
  },
  order_shipped: {
    en: "{shop}: order #{order} is on its way with {courier}. Tracking {tracking}. Please keep ৳{cod} ready.",
    bn: "{shop}: অর্ডার #{order} {courier}-এ পাঠানো হয়েছে। ট্র্যাকিং {tracking}। ৳{cod} প্রস্তুত রাখুন।",
  },
  order_delivered: {
    en: "Thank you {customer}! Order #{order} from {shop} is delivered. Questions? Call {shop_phone}.",
    bn: "ধন্যবাদ {customer}! {shop}-এর অর্ডার #{order} পৌঁছেছে। কিছু জানার থাকলে কল করুন {shop_phone}।",
  },
  due_reminder: {
    en: "Dear {customer}, a friendly reminder from {shop}: ৳{due} is still due. Pay by bKash/Nagad to {shop_phone}. Thank you!",
    bn: "প্রিয় {customer}, {shop} থেকে মনে করিয়ে দিচ্ছি: ৳{due} বাকি আছে। বিকাশ/নগদ {shop_phone}। ধন্যবাদ!",
  },
};

export function renderTemplate(body: string, vars: SmsVars) {
  return body.replace(/\{(\w+)\}/g, (m, k: string) => (vars as Record<string, string | undefined>)[k] ?? m).replace(/\s{2,}/g, " ").trim();
}

/** Bangla needs Unicode SMS: 70 characters (67 per part when split); plain Latin: 160 (153). */
export function smsParts(text: string) {
  const unicode = /[^\u0000-\u007f]/.test(text.replace(/৳/g, "Tk"));
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  return text.length <= single ? 1 : Math.ceil(text.length / multi);
}

export async function creditBalance(tx: Tx) {
  const [{ n }] = await tx.select({ n: sql<number>`coalesce(sum(${smsCredits.delta}), 0)::int` }).from(smsCredits);
  return n;
}

/** Adds prepaid credits (called by billing after a successful purchase). */
export async function addSmsCredits(businessId: string, credits: number, reason: "purchase" | "grant" | "refund", ref?: string) {
  await withTenant(businessId, (tx) => tx.insert(smsCredits).values({ businessId, delta: credits, reason, ref }));
}

export async function getTemplates(tx: Tx, lang: "en" | "bn" = "bn") {
  const rows = await tx.select().from(smsTemplates);
  return SMS_KEYS.map((key) => {
    const r = rows.find((x) => x.key === key);
    return { key, lang: (r?.lang as "en" | "bn") ?? lang, body: r?.body ?? DEFAULT_TEMPLATES[key][(r?.lang as "en" | "bn") ?? lang], enabled: r?.enabled ?? false, custom: !!r };
  });
}

export type SendResult = { status: "sent" | "failed" | "skipped"; reason?: string; parts?: number };

/**
 * Sends one templated SMS to a customer. Due reminders require the customer's
 * recorded consent; every send needs enough prepaid credits.
 */
export async function sendCustomerSms(
  businessId: string,
  args: { key: SmsKey; to: string; vars: SmsVars; orderId?: string; customerId?: string; force?: boolean },
): Promise<SendResult> {
  return withTenant(businessId, async (tx) => {
    const tpl = (await getTemplates(tx)).find((x) => x.key === args.key)!;
    const log = (status: SendResult["status"], body: string, extra: { error?: string; provider?: string; parts?: number } = {}) =>
      tx.insert(smsLog).values({ businessId, toPhone: args.to, templateKey: args.key, body, status, orderId: args.orderId, ...extra });
    if (!tpl.enabled && !args.force) return { status: "skipped", reason: "template_off" };
    if (args.key === "due_reminder") {
      const [c] = args.customerId
        ? await tx.select({ extra: schema.customers.extra }).from(schema.customers).where(eq(schema.customers.id, args.customerId))
        : await tx.select({ extra: schema.customers.extra }).from(schema.customers).where(eq(schema.customers.phone, args.to));
      if (!c || (c.extra as { smsConsent?: boolean }).smsConsent !== true) {
        await log("skipped", "", { error: "no consent" });
        return { status: "skipped", reason: "no_consent" };
      }
    }
    const body = renderTemplate(tpl.body, args.vars);
    const parts = smsParts(body);
    if ((await creditBalance(tx)) < parts) {
      await log("skipped", body, { error: "no credits", parts });
      return { status: "skipped", reason: "no_credits", parts };
    }
    const res = await sendSms(args.to, body);
    if (!res.ok) {
      await log("failed", body, { error: res.error, provider: res.provider, parts });
      return { status: "failed", reason: res.error, parts };
    }
    await tx.insert(smsCredits).values({ businessId, delta: -parts, reason: "sent", ref: args.orderId });
    await log("sent", body, { provider: res.provider, parts });
    return { status: "sent", parts };
  });
}

export async function smsOverview(businessId: string) {
  return withTenant(businessId, async (tx) => ({
    balance: await creditBalance(tx),
    templates: await getTemplates(tx),
    ledger: await tx.select().from(smsCredits).orderBy(desc(smsCredits.at)).limit(30),
    log: await tx.select().from(smsLog).orderBy(desc(smsLog.at)).limit(50),
  }));
}

export async function saveTemplate(businessId: string, t: { key: SmsKey; lang: "en" | "bn"; body: string; enabled: boolean }) {
  await withTenant(businessId, (tx) =>
    tx
      .insert(smsTemplates)
      .values({ businessId, ...t, updatedAt: new Date() })
      .onConflictDoUpdate({ target: [smsTemplates.businessId, smsTemplates.key], set: { lang: t.lang, body: t.body, enabled: t.enabled, updatedAt: new Date() } }),
  );
}


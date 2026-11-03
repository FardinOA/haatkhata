/**
 * Plans, prices and limits — the single source of truth (business plan §6,
 * SRS FR-SUB-01/02). Pure data + pure functions so both the server and the
 * client (through /api/billing/usage) agree. There is no free plan: a trial
 * or lapsed shop can print invoices for PRINT_QUOTA orders per network
 * (print-quota.ts), and a lapsed shop can't record new orders. Reading and
 * exporting always work.
 */
export type PlanId = "starter" | "business" | "pro";
/** "expired" = the trial ended or a paid plan lapsed and nothing was paid. */
export type StoredPlan = PlanId | "trial" | "expired";
export type Term = "month" | "quarter" | "year";

export type Feature =
  | "variants"
  | "bulk_import"
  | "suppliers"
  | "labels"
  | "returns_cod"
  | "profit_report"
  | "offline_pos"
  | "excel_export"
  | "custom_roles"
  | "audit_log"
  | "multi_business"
  | "priority_support";

export interface Plan {
  id: PlanId | "expired";
  name: string;
  nameBn: string;
  /** Monthly price in BDT, VAT inclusive. */
  monthly: number;
  limits: { ordersPerMonth: number; products: number; staff: number };
  features: Feature[];
  blurb: string;
  blurbBn: string;
}

const UNLIMITED = Number.POSITIVE_INFINITY;

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    nameBn: "স্টার্টার",
    monthly: 299,
    limits: { ordersPerMonth: 500, products: 300, staff: 2 },
    features: ["variants", "bulk_import", "suppliers", "labels"],
    blurb: "Home-based sellers",
    blurbBn: "ঘরে বসে বিক্রেতা",
  },
  business: {
    id: "business",
    name: "Business",
    nameBn: "বিজনেস",
    monthly: 799,
    limits: { ordersPerMonth: 2500, products: UNLIMITED, staff: 5 },
    features: ["variants", "bulk_import", "suppliers", "labels", "returns_cod", "profit_report", "offline_pos", "excel_export"],
    blurb: "Growing pages with a team",
    blurbBn: "টিমসহ বাড়তে থাকা পেজ",
  },
  pro: {
    id: "pro",
    name: "Pro",
    nameBn: "প্রো",
    monthly: 1999,
    limits: { ordersPerMonth: 10000, products: UNLIMITED, staff: UNLIMITED },
    features: ["variants", "bulk_import", "suppliers", "labels", "returns_cod", "profit_report", "offline_pos", "excel_export", "custom_roles", "audit_log", "multi_business", "priority_support"],
    blurb: "Brands and hybrid shops",
    blurbBn: "ব্র্যান্ড ও দোকান+অনলাইন",
  },
};

export const PLAN_ORDER: PlanId[] = ["starter", "business", "pro"];

/** What a shop without a paid plan gets: its data, but no new orders, products or staff. */
export const EXPIRED_PLAN: Plan = {
  id: "expired",
  name: "No plan",
  nameBn: "প্ল্যান নেই",
  monthly: 0,
  limits: { ordersPerMonth: 0, products: 0, staff: 1 },
  features: [],
  blurb: "Pick a plan to keep selling",
  blurbBn: "বিক্রি চালাতে প্ল্যান বাছুন",
};

export const isPaidPlan = (stored: string): stored is PlanId => Object.hasOwn(PLANS, stored);

export const FEATURE_LABEL: Record<Feature, [string, string]> = {
  variants: ["Sizes & colours (variants)", "সাইজ ও রং (ভ্যারিয়েন্ট)"],
  bulk_import: ["Bulk import from Excel", "এক্সেল থেকে একসাথে আমদানি"],
  suppliers: ["Suppliers & stock in", "সাপ্লায়ার ও স্টক ইন"],
  labels: ["Delivery labels", "ডেলিভারি লেবেল"],
  returns_cod: ["Returns & COD tracking", "ফেরত ও COD ট্র্যাকিং"],
  profit_report: ["Real profit report", "আসল লাভের রিপোর্ট"],
  offline_pos: ["Offline order screen", "অফলাইনে অর্ডার"],
  excel_export: ["Excel export", "এক্সেল এক্সপোর্ট"],
  custom_roles: ["Custom roles", "নিজের মতো রোল"],
  audit_log: ["Audit log", "অডিট লগ"],
  multi_business: ["Several businesses", "একাধিক ব্যবসা"],
  priority_support: ["Priority support", "অগ্রাধিকার সাপোর্ট"],
};

export const TERM_MONTHS: Record<Term, number> = { month: 1, quarter: 3, year: 12 };
/** Months actually charged per term — a year is billed as 10 (two months off). */
export const TERM_BILLED_MONTHS: Record<Term, number> = { month: 1, quarter: 3, year: 10 };

export const TRIAL_PLAN: PlanId = "business";

/** The plan whose limits apply right now. A running trial behaves like Business. */
export function effectivePlan(stored: string): Plan {
  if (stored === "trial") return PLANS[TRIAL_PLAN];
  return isPaidPlan(stored) ? PLANS[stored] : EXPIRED_PLAN;
}

export function hasFeature(stored: string, f: Feature) {
  return effectivePlan(stored).features.includes(f);
}

/** VAT on the subscription fee (prices are VAT-inclusive). Configurable via BILLING_VAT_PCT. */
export function vatPct() {
  const v = Number(process.env.BILLING_VAT_PCT ?? 5);
  return Number.isFinite(v) && v >= 0 && v <= 50 ? v : 5;
}

export function quote(planId: PlanId, term: Term, vat = vatPct()) {
  const plan = PLANS[planId];
  const total = plan.monthly * TERM_BILLED_MONTHS[term];
  const vatAmount = Math.round(((total * vat) / (100 + vat)) * 100) / 100;
  return { plan, term, months: TERM_MONTHS[term], total, vatPct: vat, vatAmount, net: Math.round((total - vatAmount) * 100) / 100, saved: plan.monthly * TERM_MONTHS[term] - total };
}

export type UsageLevel = "ok" | "warn" | "full";
/** FR-SUB-01: warn at 80%, block new records at 100%. */
export function usageLevel(used: number, limit: number): UsageLevel {
  if (!Number.isFinite(limit)) return "ok";
  if (used >= limit) return "full";
  if (used >= limit * 0.8) return "warn";
  return "ok";
}

/** JSON can't carry Infinity — the API sends `null` for "unlimited". */
export const jsonLimit = (n: number) => (Number.isFinite(n) ? n : null);

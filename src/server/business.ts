import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { CHANNELS } from "@/lib/domain";
import { initialState } from "@/lib/state";
import type { Role } from "@/lib/types";
import { db, schema, withTenant } from "./db";
import { HttpError } from "./http";
import { persistChanges } from "./state-io";

const { businesses, memberships, users } = schema;

export const onboardingSchema = z.object({
  name: z.string().trim().min(2, "Your business needs a name").max(80),
  ownerName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(20).optional(),
  address: z.string().trim().max(300).optional(),
  type: z.enum(["online", "shop", "both"]),
  channels: z.array(z.enum(CHANNELS as [string, ...string[]])).max(8),
  logo: z.string().max(6_000_000).nullable().optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sample: z.boolean().default(false),
  referralCode: z.string().trim().max(20).optional(),
});

const TRIAL_DAYS = 7;

export async function createBusiness(userId: string, input: z.infer<typeof onboardingSchema>) {
  const id = `b_${randomBytes(9).toString("base64url")}`;
  const defaults = initialState();
  const trialEnds = new Date(Date.now() + TRIAL_DAYS * 86_400_000);
  let referredBy: string | null = null;
  if (input.referralCode) {
    const [ref] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.referralCode, input.referralCode.toUpperCase()));
    referredBy = ref?.id ?? null;
  }
  await db.update(users).set({ name: input.ownerName }).where(eq(users.id, userId));
  await db.insert(businesses).values({
    id,
    name: input.name,
    phone: input.phone ?? "",
    address: input.address ?? "",
    businessType: input.type,
    channels: input.channels,
    theme: { ...defaults.theme, ...(input.accent ? { accent: input.accent.toUpperCase() } : {}) },
    invoice: { ...defaults.invoice },
    pos: { ...defaults.pos, lastChannel: input.channels[0] ?? (input.type === "shop" ? "walkin" : "facebook") },
    monthlyGoal: 100000,
    plan: "trial",
    planOrderLimit: 2500,
    trialEndsAt: trialEnds,
    referralCode: `BK${randomBytes(3).toString("hex").toUpperCase()}`,
    referredBy,
  });
  await db.insert(memberships).values({ businessId: id, userId, role: "owner", color: "#0E6B53", status: "active" });

  await withTenant(id, async (tx) => {
    const before = initialState();
    before.staff = [];
    before.categories = [];
    const after = structuredClone(before);
    after.business = { ...after.business, name: input.name, logo: input.logo ?? null };
    after.categories = defaults.categories;
    if (input.sample) {
      const { buildSeed } = await import("@/lib/seed");
      const seed = buildSeed(new Date());
      Object.assign(after, { products: seed.products, customers: seed.customers, orders: seed.orders, movements: seed.movements, suppliers: seed.suppliers, purchases: seed.purchases, expenses: seed.expenses, notices: seed.notices, locations: seed.locations, purchaseOrders: seed.purchaseOrders, quotes: seed.quotes, recurring: seed.recurring });
      after.nextOrderNo = seed.nextOrderNo;
      after.nextInvoiceNo = seed.nextInvoiceNo;
    }
    // Business name/settings were inserted above; persist logo and everything else.
    before.business = { ...after.business, logo: null };
    await persistChanges(tx, id, before, after);
  });
  return id;
}

export async function listBusinesses(userId: string) {
  return db
    .select({ id: businesses.id, name: businesses.name, logo: businesses.logo, role: memberships.role, plan: businesses.plan })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(and(eq(memberships.userId, userId), eq(memberships.status, "active")));
}

export async function requireRole(role: Role | null, allowed: Role[]) {
  if (!role || !allowed.includes(role)) throw new HttpError(403, "Your role can't do this");
}

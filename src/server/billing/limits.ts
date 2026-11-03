import "server-only";
/**
 * Plan limits for commands (FR-SUB-01/02). Only creating *new* things is ever
 * blocked — editing, reading and exporting always work. A shop with no paid
 * plan ("expired") can't record new orders at all.
 * apply.ts calls this right after authorize().
 */
import { and, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { CommandError, type CommandPayload, type CommandType } from "@/lib/commands";
import type { AppState } from "@/lib/state";
import { schema, type Tx } from "../db";
import { effectivePlan, hasFeature } from "./plans";

const { businesses, memberships, orders, products } = schema;

const NEW_ORDER = ["order.create", "quote.convert", "recurring.run"];

export async function enforcePlanLimits(tx: Tx, businessId: string, type: CommandType, payload: unknown, state: AppState) {
  if (![...NEW_ORDER, "product.save", "product.duplicate", "staff.add", "supplier.add", "staff.update"].includes(type)) return;
  const [b] = await tx.select({ plan: businesses.plan }).from(businesses).where(eq(businesses.id, businessId));
  if (!b) return;
  const plan = effectivePlan(b.plan);
  if (b.plan === "expired" && NEW_ORDER.includes(type))
    throw new CommandError("Your shop has no active plan, so new orders are paused. Pick a plan in Settings → Plan & billing — everything you already have stays available.", "limit");
  if (NEW_ORDER.includes(type)) {
    // FR-SUB-01: the monthly order cap. Drafts and recurring orders aren't capped.
    if (type === "recurring.run" || (payload as { mode?: string }).mode === "draft") return;
    const now = new Date();
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(gte(orders.createdAt, new Date(now.getFullYear(), now.getMonth(), 1)), ne(orders.status, "draft")));
    if (n >= plan.limits.ordersPerMonth)
      throw new CommandError(`You've used all ${plan.limits.ordersPerMonth.toLocaleString("en-IN")} orders on the ${plan.name} plan this month. Upgrade in Settings → Plan & billing to keep taking orders.`, "limit");
    return;
  }
  const upgrade = (what: string) =>
    new CommandError(`${what} ${b.plan === "expired" ? "without a plan" : `on the ${plan.name} plan`}. Pick a plan in Settings → Plan & billing — everything you already have stays available.`, "limit");

  if (type === "product.save" || type === "product.duplicate") {
    const isNew = type === "product.duplicate" || !state.products.some((p) => p.id === (payload as CommandPayload<"product.save">).product.id);
    if (isNew) {
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(products);
      if (n >= plan.limits.products) throw upgrade(plan.limits.products ? `You can have up to ${plan.limits.products} products` : "New products are paused");
    }
    if (type === "product.save" && !hasFeature(b.plan, "variants")) {
      const next = (payload as CommandPayload<"product.save">).product;
      const prev = state.products.find((p) => p.id === next.id);
      if (next.variants.length > 1 && (prev?.variants.length ?? 1) <= 1) throw upgrade("Sizes and colours aren't available");
    }
  }
  if (type === "staff.add") {
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(memberships).where(and(eq(memberships.businessId, businessId), inArray(memberships.status, ["active", "invited"])));
    if (n >= plan.limits.staff) throw upgrade(`Your team can have up to ${plan.limits.staff} ${plan.limits.staff === 1 ? "person" : "people"}`);
  }
  if (type === "staff.add" || type === "staff.update") {
    const role = type === "staff.add" ? (payload as CommandPayload<"staff.add">).role : (payload as CommandPayload<"staff.update">).patch.role;
    if (role?.startsWith("custom:")) {
      if (!hasFeature(b.plan, "custom_roles")) throw upgrade("Custom roles aren't available");
      if (!role.startsWith(`custom:${businessId}:`)) throw new CommandError("That role belongs to another business", "forbidden");
    }
  }
  if (type === "supplier.add" && !hasFeature(b.plan, "suppliers")) throw upgrade("Suppliers aren't available");
}

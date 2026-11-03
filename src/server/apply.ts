import "server-only";
/**
 * Server side of a command: idempotency → validation → authorisation →
 * plan limits → the shared reducer → persist → audit. One transaction per
 * command, serialised per business by a lock on the business row.
 */
import { and, eq, gte, ne, sql } from "drizzle-orm";
import { produce } from "immer";
import { z } from "zod";
import { authorize, COMMANDS, CommandError, makeCtx, type CommandType, type QueuedCommand } from "@/lib/commands";
import type { AppState } from "@/lib/state";
import type { Role } from "@/lib/types";
import { db, schema, withTenant, type Tx } from "./db";
import { enforcePlanLimits } from "./billing/limits";
import { runPostApplyHooks } from "./notify/hooks";
import { loadWorkingSet, persistChanges } from "./state-io";

const { commandLog, orders, auditLog, businesses } = schema;

export type CommandOutcome = { id: string; status: "applied" | "duplicate" | "rejected"; error?: string; code?: string; result?: unknown };

const money = z.number().finite().min(0).max(1e9);
const qty = z.number().int().min(0).max(1e6);
const cartLine = z.object({ variantId: z.string().min(1), productId: z.string().min(1), qty: qty.min(1), price: money, discount: money }).passthrough();

/** Extra validation for commands that move money or stock. */
const PAYLOAD_SCHEMAS: Partial<Record<CommandType, z.ZodType>> = {
  "order.create": z.object({
    mode: z.enum(["draft", "confirm", "complete"]),
    input: z
      .object({
        lines: z.array(cartLine).min(1).max(200),
        deliveryCharge: money,
        otherCharges: money,
        discount: z.object({ type: z.enum(["flat", "pct"]), value: money }),
        payments: z.array(z.object({ method: z.string(), amount: money }).passthrough()).max(20),
        settlement: z.enum(["cod", "due"]),
      })
      .passthrough(),
  }),
  "order.updateLines": z.object({ orderId: z.string(), lines: z.array(cartLine).min(1).max(200) }),
  "order.payment": z.object({ orderId: z.string(), payment: z.object({ method: z.string(), amount: money.gt(0) }).passthrough() }),
  "order.return": z.object({ orderId: z.string(), fee: money, refund: money, lines: z.array(z.object({ lineId: z.string(), qty: qty, condition: z.enum(["restock", "damaged"]) })) }).passthrough(),
  "stock.in": z.object({ lines: z.array(z.object({ variantId: z.string(), productId: z.string(), qty: qty.min(1), unitCost: money })).min(1).max(500), paid: money }).passthrough(),
  "stock.adjust": z.object({ variantId: z.string(), newOnHand: z.number().int().min(-1e6).max(1e7), reason: z.enum(["adjust", "damage"]) }).passthrough(),
  "expense.add": z.object({ amount: money.gt(0), category: z.string(), method: z.string(), date: z.string() }).passthrough(),
  "supplier.pay": z.object({ supplierId: z.string(), amount: money.gt(0) }),
  "product.save": z.object({ product: z.object({ id: z.string().min(1), name: z.string().min(1).max(200), variants: z.array(z.object({ id: z.string(), sku: z.string().min(1).max(64), price: money, cost: money }).passthrough()).min(1).max(300) }).passthrough() }).passthrough(),
};

export const commandEnvelope = z.object({
  id: z.string().min(6).max(80),
  type: z.string().refine((t): t is CommandType => t in COMMANDS, "Unknown command"),
  at: z.string().datetime({ offset: true }),
  payload: z.unknown(),
});

/** Actions the owner can review later (FR-AUD-01). */
const AUDITED: Partial<Record<CommandType, string>> = {
  "product.save": "product.saved",
  "product.delete": "product.deleted",
  "stock.adjust": "stock.adjusted",
  "staff.add": "staff.invited",
  "staff.update": "staff.role_changed",
  "staff.remove": "staff.removed",
  "expense.delete": "expense.deleted",
  "order.deleteDraft": "order.draft_deleted",
  "order.return": "order.returned",
  "supplier.pay": "supplier.paid",
};

async function monthlyOrderCount(tx: Tx) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(gte(orders.createdAt, start), ne(orders.status, "draft")));
  return n;
}

function auditEntry(type: CommandType, payload: unknown, before: AppState, after: AppState) {
  const p = payload as Record<string, unknown>;
  switch (type) {
    case "product.save": {
      const prod = (p.product as { id: string; name: string; variants: { id: string; price: number }[] }) ?? { id: "", name: "", variants: [] };
      const old = before.products.find((x) => x.id === prod.id);
      const priceChanges = prod.variants.filter((v) => old && old.variants.find((o) => o.id === v.id)?.price !== v.price).map((v) => ({ variant: v.id, from: old?.variants.find((o) => o.id === v.id)?.price, to: v.price }));
      if (old && !priceChanges.length) return null; // only price edits and new products are audited
      return { entity: "product", entityId: prod.id, before: old ? { prices: priceChanges.map((c) => c.from) } : null, after: { name: prod.name, priceChanges } };
    }
    case "stock.adjust": {
      const vid = p.variantId as string;
      const v = before.products.flatMap((x) => x.variants).find((x) => x.id === vid);
      return { entity: "variant", entityId: vid, before: { onHand: v?.onHand }, after: { onHand: p.newOnHand, reason: p.reason, note: p.note } };
    }
    case "staff.update":
      return { entity: "staff", entityId: p.id as string, before: before.staff.find((x) => x.id === p.id) ?? null, after: after.staff.find((x) => x.id === p.id) ?? null };
    default:
      return { entity: type.split(".")[0], entityId: (p?.id ?? p?.orderId ?? p?.supplierId ?? null) as string | null, before: null, after: p as object };
  }
}

export async function applyCommand(
  auth: { businessId: string; userId: string; userName: string; role: Role },
  raw: unknown,
): Promise<CommandOutcome> {
  const parsed = commandEnvelope.safeParse(raw);
  const id = (raw as { id?: string })?.id ?? "unknown";
  if (!parsed.success) return { id, status: "rejected", code: "invalid", error: "Malformed command" };
  const cmd = parsed.data as QueuedCommand;

  try {
    const outcome: CommandOutcome = await withTenant(auth.businessId, async (tx): Promise<CommandOutcome> => {
      const [seen] = await tx.select().from(commandLog).where(eq(commandLog.id, cmd.id));
      if (seen) return { id: cmd.id, status: seen.status === "applied" ? "duplicate" : "rejected", error: seen.error ?? undefined, result: seen.result ?? undefined };

      const schemaFor = PAYLOAD_SCHEMAS[cmd.type];
      if (schemaFor) {
        const r = schemaFor.safeParse(cmd.payload);
        if (!r.success) throw new CommandError(`Invalid ${cmd.type}: ${r.error.issues[0]?.path.join(".")} ${r.error.issues[0]?.message}`, "invalid");
      }

      const state = await loadWorkingSet(tx, auth.businessId, cmd.type, cmd.payload);
      authorize(cmd.type, cmd.payload, auth.role, state);
      await enforcePlanLimits(tx, auth.businessId, cmd.type, cmd.payload, state);

      if (cmd.type === "order.create" && (cmd.payload as { mode: string }).mode !== "draft") {
        if ((await monthlyOrderCount(tx)) >= state.plan.orderLimit)
          throw new CommandError(`You've reached this month's ${state.plan.orderLimit} orders on the ${state.plan.name} plan. Upgrade to keep taking orders — your existing orders stay available.`, "limit");
      }

      // Never trust a device clock that runs ahead.
      const at = new Date(cmd.at) > new Date(Date.now() + 5 * 60_000) ? new Date().toISOString() : new Date(cmd.at).toISOString();
      const before = structuredClone(state) as AppState;
      let result: unknown;
      const after = produce(state, (draft) => {
        const fn = COMMANDS[cmd.type] as (s: AppState, p: unknown, ctx: ReturnType<typeof makeCtx>) => unknown;
        result = fn(draft as AppState, cmd.payload, makeCtx(cmd.id, at, { id: auth.userId, name: auth.userName, role: auth.role }));
      });
      await persistChanges(tx, auth.businessId, before, after);

      const audited = AUDITED[cmd.type];
      if (audited) {
        const entry = auditEntry(cmd.type, cmd.payload, before, after);
        if (entry) await tx.insert(auditLog).values({ businessId: auth.businessId, userId: auth.userId, userName: auth.userName, action: audited, entity: entry.entity, entityId: entry.entityId, before: entry.before, after: entry.after });
      }
      await tx.insert(commandLog).values({ businessId: auth.businessId, id: cmd.id, userId: auth.userId, type: cmd.type, payload: cmd.payload as object, status: "applied", result: (result ?? null) as object, clientAt: new Date(cmd.at) });
      return { id: cmd.id, status: "applied", result };
    });
    // SMS, push and outbound webhooks run after the transaction commits, never inside it.
    if (outcome.status === "applied") void runPostApplyHooks({ ...auth, command: cmd, result: outcome.result });
    return outcome;
  } catch (e) {
    const err = e instanceof CommandError ? e : null;
    const message = err ? err.message : "This change couldn't be saved";
    if (!err) console.error("command failed", cmd.type, e);
    // Record the rejection so a retry gets the same answer instead of re-running.
    await withTenant(auth.businessId, (tx) =>
      tx.insert(commandLog).values({ businessId: auth.businessId, id: cmd.id, userId: auth.userId, type: cmd.type, payload: cmd.payload as object, status: "rejected", error: message, clientAt: new Date(cmd.at) }).onConflictDoNothing(),
    );
    return { id: cmd.id, status: "rejected", code: err?.code ?? "error", error: message };
  }
}

export async function businessPlan(businessId: string) {
  const [b] = await db.select({ plan: businesses.plan, limit: businesses.planOrderLimit }).from(businesses).where(eq(businesses.id, businessId));
  return b;
}

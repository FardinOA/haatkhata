import "server-only";
/**
 * Custom roles (FR-AUTH-06): stored per business, registered into the shared
 * permission registry (src/lib/domain.ts) whenever a request resolves a role.
 */
import { randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { BUILTIN_ROLES, registerCustomRoles } from "@/lib/domain";
import type { CustomRoleDef, CustomRoleKey, Permission, Role } from "@/lib/types";
import { db, schema } from "../db";
import { HttpError } from "../http";
import { customRoles } from "../db/schema-billing";

const { memberships } = schema;

export const PERMISSIONS: Permission[] = ["create_order", "pack_ship", "deliver_return", "edit_stock", "edit_price", "big_discount", "delete_order", "view_cost", "reports", "settings", "billing"];

export const roleInput = z.object({
  name: z.string().trim().min(2).max(40),
  nameBn: z.string().trim().max(40).optional(),
  // Billing stays with the owner — a custom role can never manage the subscription.
  permissions: z.array(z.enum(PERMISSIONS.filter((p) => p !== "billing") as [Permission, ...Permission[]])).max(PERMISSIONS.length),
  maxDiscountPct: z.number().int().min(0).max(100),
});

export const roleKey = (businessId: string, id: string) => `custom:${businessId}:${id}` as CustomRoleKey;

const toDef = (r: typeof customRoles.$inferSelect): CustomRoleDef => ({
  key: roleKey(r.businessId, r.id),
  id: r.id,
  businessId: r.businessId,
  name: r.name,
  nameBn: r.nameBn ?? undefined,
  permissions: r.permissions as Permission[],
  maxDiscountPct: r.maxDiscountPct,
});

export async function listCustomRoles(businessId: string) {
  const rows = await db.select().from(customRoles).where(eq(customRoles.businessId, businessId)).orderBy(customRoles.createdAt);
  const defs = rows.map(toDef);
  registerCustomRoles(defs, { businessId, replace: true });
  return defs;
}

/**
 * Turns a membership's stored role into the role used for permission checks.
 * Custom keys must belong to this business and exist; anything else gets no access.
 */
export async function resolveRole(businessId: string, stored: string): Promise<Role> {
  if ((BUILTIN_ROLES as string[]).includes(stored)) return stored as Role;
  const prefix = `custom:${businessId}:`;
  if (!stored.startsWith(prefix)) return `custom:${businessId}:invalid` as CustomRoleKey;
  const id = stored.slice(prefix.length);
  const [row] = await db.select().from(customRoles).where(and(eq(customRoles.businessId, businessId), eq(customRoles.id, id)));
  if (!row) return `custom:${businessId}:invalid` as CustomRoleKey;
  registerCustomRoles([toDef(row)]);
  return toDef(row).key;
}

export async function saveCustomRole(businessId: string, input: z.infer<typeof roleInput>, id?: string) {
  const rid = id ?? `cr${randomBytes(6).toString("base64url")}`;
  const values = { businessId, id: rid, name: input.name, nameBn: input.nameBn ?? null, permissions: input.permissions, maxDiscountPct: input.maxDiscountPct, updatedAt: new Date() };
  await db.insert(customRoles).values(values).onConflictDoUpdate({ target: [customRoles.businessId, customRoles.id], set: { name: values.name, nameBn: values.nameBn, permissions: values.permissions, maxDiscountPct: values.maxDiscountPct, updatedAt: values.updatedAt } });
  await listCustomRoles(businessId);
  return roleKey(businessId, rid);
}

export async function deleteCustomRole(businessId: string, id: string) {
  const inUse = await db.select({ u: memberships.userId }).from(memberships).where(and(eq(memberships.businessId, businessId), eq(memberships.role, roleKey(businessId, id)), inArray(memberships.status, ["active", "invited"])));
  if (inUse.length) throw new HttpError(409, `${inUse.length} team member${inUse.length > 1 ? "s use" : " uses"} this role. Give them another role first.`);
  await db.delete(customRoles).where(and(eq(customRoles.businessId, businessId), eq(customRoles.id, id)));
  await listCustomRoles(businessId);
}

import "server-only";
import { requireBusiness } from "@/server/auth/session";
import { requireRole } from "@/server/business";
import type { Actor } from "@/server/integrations/couriers/service";
import type { Role } from "@/lib/types";

export async function actor(roles?: Role[]): Promise<Actor> {
  const a = await requireBusiness();
  if (roles) await requireRole(a.role, roles);
  return { businessId: a.businessId, userId: a.user.id, userName: a.user.name || a.user.phone, role: a.role };
}

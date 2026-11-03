import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireBusiness } from "@/server/auth/session";
import { withTenant } from "@/server/db";
import { notificationPrefs, pushSubscriptions } from "@/server/db/schema-platform";
import { json, route } from "@/server/http";
import { pushConfigured } from "@/server/notify/push";

const DEFAULTS = { dailySummary: true, summaryHour: 21, via: "push", lang: "bn", lowStockDigest: true, pushNewOrders: true, pushLowStock: true, pushCodOverdue: true };

/** This user's notification settings in the current business. */
export const GET = route(async () => {
  const a = await requireBusiness();
  return withTenant(a.businessId, async (tx) => {
    const [p] = await tx.select().from(notificationPrefs).where(and(eq(notificationPrefs.userId, a.user.id)));
    const devices = await tx.select({ id: pushSubscriptions.id, userAgent: pushSubscriptions.userAgent, createdAt: pushSubscriptions.createdAt, endpoint: pushSubscriptions.endpoint }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, a.user.id));
    return { prefs: { ...DEFAULTS, ...(p ?? {}) }, devices, pushAvailable: pushConfigured(), smsDriver: process.env.SMS_DRIVER ?? "console" };
  });
});

export const PUT = route(async (req: Request) => {
  const a = await requireBusiness();
  const patch = await json(
    req,
    z.object({
      dailySummary: z.boolean().optional(),
      summaryHour: z.number().int().min(0).max(23).optional(),
      via: z.enum(["push", "sms", "both"]).optional(),
      lang: z.enum(["en", "bn"]).optional(),
      lowStockDigest: z.boolean().optional(),
      pushNewOrders: z.boolean().optional(),
      pushLowStock: z.boolean().optional(),
      pushCodOverdue: z.boolean().optional(),
    }),
  );
  await withTenant(a.businessId, (tx) => tx.insert(notificationPrefs).values({ businessId: a.businessId, userId: a.user.id, ...patch }).onConflictDoUpdate({ target: [notificationPrefs.businessId, notificationPrefs.userId], set: patch }));
  return { ok: true };
});

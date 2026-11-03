import { and, desc, eq, isNull } from "drizzle-orm";
import { requireAuth } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { route } from "@/server/http";

/** Devices signed in to this account (FR-AUTH-07). */
export const GET = route(async () => {
  const a = await requireAuth();
  const rows = await db
    .select({ id: schema.sessions.id, userAgent: schema.sessions.userAgent, ip: schema.sessions.ip, createdAt: schema.sessions.createdAt, lastSeenAt: schema.sessions.lastSeenAt })
    .from(schema.sessions)
    .where(and(eq(schema.sessions.userId, a.user.id), isNull(schema.sessions.revokedAt)))
    .orderBy(desc(schema.sessions.lastSeenAt));
  return { sessions: rows.map((r) => ({ ...r, current: r.id === a.sessionId })) };
});

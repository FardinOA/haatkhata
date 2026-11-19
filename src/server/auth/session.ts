import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { normalizePhone } from "@/lib/domain";
import type { Role } from "@/lib/types";
import { db, schema } from "../db";
import { sendSms } from "../integrations/sms";
import { expireLapsedPlan } from "../billing/service";
import { HttpError } from "../http";
import { resolveRole } from "./roles";

const { users, sessions, otpCodes, memberships, businesses } = schema;

export const SESSION_COOKIE = "bk_session";
const SESSION_DAYS = 30;
/** The admin console (its own app and domain) signs in separately, on its own cookie, for a working day at most. */
export const ADMIN_COOKIE = "bk_admin";
const ADMIN_SESSION_HOURS = 12;
const HANDOFF_TTL_MS = 60_000;
const OTP_TTL_MS = 5 * 60_000; // NFR-SEC-03
const OTP_PER_PHONE_PER_HOUR = 5;
const OTP_PER_IP_PER_HOUR = 30;
const OTP_MAX_ATTEMPTS = 5;

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
  return s ?? "dev-only-secret";
};
const hmac = (v: string) => createHmac("sha256", secret()).update(v).digest("hex");
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const newId = (prefix: string) => `${prefix}${randomBytes(9).toString("base64url")}`;

/* ------------------------------------------------------------ OTP */

export async function requestOtp(rawPhone: string, ip: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new HttpError(400, "Enter a Bangladeshi mobile number like 017XXXXXXXX");
  const hourAgo = new Date(Date.now() - 3_600_000);
  const [{ n: perPhone }] = await db.select({ n: sql<number>`count(*)::int` }).from(otpCodes).where(and(eq(otpCodes.phone, phone), gt(otpCodes.createdAt, hourAgo)));
  if (perPhone >= OTP_PER_PHONE_PER_HOUR) throw new HttpError(429, "Too many codes for this number. Try again in an hour.");
  const [{ n: perIp }] = await db.select({ n: sql<number>`count(*)::int` }).from(otpCodes).where(and(eq(otpCodes.ip, ip), gt(otpCodes.createdAt, hourAgo)));
  if (perIp >= OTP_PER_IP_PER_HOUR) throw new HttpError(429, "Too many requests from this network. Try again later.");

  const code = String(randomInt(100000, 1000000));
  await db.insert(otpCodes).values({ phone, codeHash: hmac(`${phone}:${code}`), ip, expiresAt: new Date(Date.now() + OTP_TTL_MS) });
  const sms = await sendSms(phone, `HaatKhata code: ${code}. It expires in 5 minutes. Don't share it with anyone.`);
  if (!sms.ok) throw new HttpError(502, "We couldn't send the SMS. Try again in a moment.");
  // Dev convenience: with the console driver (never in production) the code comes back in the response.
  return { phone, devCode: process.env.SMS_DRIVER === "console" && process.env.NODE_ENV !== "production" ? code : undefined };
}

export async function verifyOtp(rawPhone: string, code: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone || !/^\d{6}$/.test(code)) throw new HttpError(400, "Enter the 6-digit code");
  const [row] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!row) throw new HttpError(400, "That code has expired. Ask for a new one.");
  if (row.attempts >= OTP_MAX_ATTEMPTS) throw new HttpError(429, "Too many wrong tries. Ask for a new code.");
  const ok = timingSafeEqual(Buffer.from(row.codeHash), Buffer.from(hmac(`${phone}:${code}`)));
  if (!ok) {
    await db.update(otpCodes).set({ attempts: row.attempts + 1 }).where(eq(otpCodes.id, row.id));
    throw new HttpError(400, "That code isn't right. Check the SMS and try again.");
  }
  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, row.id));

  let [user] = await db.select().from(users).where(eq(users.phone, phone));
  if (!user) [user] = await db.insert(users).values({ id: newId("u_"), phone }).returning();
  // Accept any pending staff invites for this phone (FR-AUTH-04).
  await db.update(memberships).set({ status: "active", updatedAt: new Date() }).where(and(eq(memberships.userId, user.id), eq(memberships.status, "invited")));
  return user;
}

/* ------------------------------------------------------------ sessions */

export async function createSession(
  userId: string,
  meta: { ip?: string; userAgent?: string; businessId?: string | null; impersonatedBy?: string },
  cookie: { name: string; maxAge: number } = { name: SESSION_COOKIE, maxAge: SESSION_DAYS * 86_400 },
) {
  const token = randomBytes(32).toString("base64url");
  // undefined = open the user's first shop; null = no shop (admin sessions).
  const businessId =
    meta.businessId !== undefined
      ? meta.businessId
      : ((await db.select({ id: memberships.businessId }).from(memberships).where(and(eq(memberships.userId, userId), eq(memberships.status, "active"))).orderBy(memberships.createdAt).limit(1))[0]?.id ?? null);
  await db.insert(sessions).values({ id: newId("s_"), tokenHash: sha256(token), userId, businessId, ip: meta.ip, userAgent: meta.userAgent?.slice(0, 300), impersonatedBy: meta.impersonatedBy });
  const jar = await cookies();
  jar.set(cookie.name, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: cookie.maxAge });
  return token;
}

export function createAdminSession(userId: string, meta: { ip?: string; userAgent?: string }) {
  return createSession(userId, { ...meta, businessId: null }, { name: ADMIN_COOKIE, maxAge: ADMIN_SESSION_HOURS * 3600 });
}

export type AuthContext = {
  sessionId: string;
  user: typeof users.$inferSelect;
  businessId: string | null;
  role: Role | null;
  impersonatedBy: string | null;
};

export async function getAuth(token?: string): Promise<AuthContext | null> {
  const t = token ?? (await cookies()).get(SESSION_COOKIE)?.value;
  if (!t) return null;
  const [row] = await db
    .select({ s: sessions, u: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(t)), isNull(sessions.revokedAt)));
  if (!row) return null;
  if (Date.now() - row.s.lastSeenAt.getTime() > SESSION_DAYS * 86_400_000) return null;
  if (Date.now() - row.s.lastSeenAt.getTime() > 5 * 60_000) await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, row.s.id));
  let role: Role | null = null;
  if (row.s.businessId) {
    const [m] = await db.select().from(memberships).where(and(eq(memberships.businessId, row.s.businessId), eq(memberships.userId, row.u.id), eq(memberships.status, "active")));
    // Custom roles (FR-AUTH-06) are validated against this business and registered for permission checks.
    role = m ? await resolveRole(row.s.businessId, m.role) : row.s.impersonatedBy ? "owner" : null;
  }
  return { sessionId: row.s.id, user: row.u, businessId: role ? row.s.businessId : null, role, impersonatedBy: row.s.impersonatedBy };
}

/** The admin console's session, read only from its own cookie and only while it's younger than a working day. */
export async function getAdminAuth(): Promise<AuthContext | null> {
  const t = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!t) return null;
  const a = await getAuth(t);
  if (!a) return null;
  const [s] = await db.select({ createdAt: sessions.createdAt }).from(sessions).where(eq(sessions.id, a.sessionId));
  return s && Date.now() - s.createdAt.getTime() <= ADMIN_SESSION_HOURS * 3_600_000 ? a : null;
}

export async function clearAdminCookie() {
  (await cookies()).delete(ADMIN_COOKIE);
}

/**
 * A one-minute, signed ticket the admin console hands to the shop app so an
 * admin can open a shop as its owner in a new tab. The console's own session
 * never changes hands; the shop app turns the ticket into an owner session.
 */
export type Handoff = { owner: string; admin: string; business: string; nonce: string; exp: number };

export function signHandoff(p: Pick<Handoff, "owner" | "admin" | "business">, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ ...p, nonce: randomBytes(12).toString("base64url"), exp: now + HANDOFF_TTL_MS })).toString("base64url");
  return `${body}.${hmac(`handoff:${body}`)}`;
}

/** The ticket's contents if the signature holds and it hasn't expired; single use is checked by the caller. */
export function readHandoff(ticket: string, now = Date.now()): Handoff | null {
  const [body, sig] = ticket.split(".");
  if (!body || !sig) return null;
  const want = hmac(`handoff:${body}`);
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Handoff;
    return p.exp > now ? p : null;
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<AuthContext> {
  const a = await getAuth();
  if (!a) throw new HttpError(401, "Please sign in");
  return a;
}

export async function requireBusiness(): Promise<AuthContext & { businessId: string; role: Role }> {
  const a = await requireAuth();
  if (!a.businessId || !a.role) throw new HttpError(403, "Choose or create a business first");
  await expireTrial(a.businessId);
  await expireLapsedPlan(a.businessId);
  return a as AuthContext & { businessId: string; role: Role };
}

export async function switchBusiness(sessionId: string, userId: string, businessId: string) {
  const [m] = await db.select().from(memberships).where(and(eq(memberships.businessId, businessId), eq(memberships.userId, userId), eq(memberships.status, "active")));
  if (!m) throw new HttpError(403, "You're not a member of that business");
  await db.update(sessions).set({ businessId }).where(eq(sessions.id, sessionId));
}

export async function revokeSession(userId: string, sessionId: string) {
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** 7-day Business trial, then no plan until they pay (FR-SUB-04). Data stays readable and exportable. */
export async function expireTrial(businessId: string) {
  await db
    .update(businesses)
    .set({ plan: "expired", planOrderLimit: 0, updatedAt: new Date() })
    .where(and(eq(businesses.id, businessId), eq(businesses.plan, "trial"), sql`${businesses.trialEndsAt} < now()`));
}

import "server-only";
/**
 * Quick-unlock PIN for a shared counter device (FR-AUTH-08). The PIN is tied
 * to one session (one device), stored as an scrypt hash, and five wrong tries
 * sign the device out so the full phone code is needed again.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { sessionPins } from "../db/schema-billing";
import { HttpError } from "../http";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
export const PIN_MAX_FAILS = 5;

export async function hashPin(pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new HttpError(400, "Use exactly 4 digits");
  if (/^(\d)\1{3}$/.test(pin) || ["1234", "4321", "0123", "9876"].includes(pin)) throw new HttpError(400, "Pick a PIN that's harder to guess");
  const salt = randomBytes(16);
  const hash = await scrypt(pin, salt, 32);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function checkPin(pin: string, stored: string) {
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const got = await scrypt(pin, Buffer.from(salt, "base64"), 32);
  const want = Buffer.from(hash, "base64");
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function setPin(sessionId: string, userId: string, pin: string) {
  const pinHash = await hashPin(pin);
  await db.insert(sessionPins).values({ sessionId, userId, pinHash }).onConflictDoUpdate({ target: sessionPins.sessionId, set: { pinHash, failed: 0, updatedAt: new Date() } });
}

export async function clearPin(sessionId: string) {
  await db.delete(sessionPins).where(eq(sessionPins.sessionId, sessionId));
}

export async function hasPin(sessionId: string) {
  const [row] = await db.select({ s: sessionPins.sessionId }).from(sessionPins).where(eq(sessionPins.sessionId, sessionId));
  return !!row;
}

/** Returns ok, or how many tries are left; after the last one the session is revoked. */
export async function verifyPin(sessionId: string, pin: string): Promise<{ ok: true } | { ok: false; left: number; locked: boolean }> {
  const [row] = await db.select().from(sessionPins).where(eq(sessionPins.sessionId, sessionId));
  if (!row) throw new HttpError(404, "No PIN is set on this device");
  if (/^\d{4}$/.test(pin) && (await checkPin(pin, row.pinHash))) {
    if (row.failed) await db.update(sessionPins).set({ failed: 0, updatedAt: new Date() }).where(eq(sessionPins.sessionId, sessionId));
    return { ok: true };
  }
  const failed = row.failed + 1;
  if (failed >= PIN_MAX_FAILS) {
    await db.delete(sessionPins).where(eq(sessionPins.sessionId, sessionId));
    await db.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.id, sessionId));
    return { ok: false, left: 0, locked: true };
  }
  await db.update(sessionPins).set({ failed, updatedAt: new Date() }).where(eq(sessionPins.sessionId, sessionId));
  return { ok: false, left: PIN_MAX_FAILS - failed, locked: false };
}

import "server-only";
/**
 * Encrypts integration credentials at rest with AES-256-GCM. The key is
 * derived from AUTH_SECRET (HKDF), so rotating AUTH_SECRET requires
 * reconnecting integrations.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
  // Pre-rename salt; changing it makes saved courier/payment keys unreadable.
  return Buffer.from(hkdfSync("sha256", secret ?? "dev-only-secret", "bechakena", "integration-credentials", 32));
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptJson<T>(blob: string): T {
  const [v, iv, tag, data] = blob.split(".");
  if (v !== "v1") throw new Error("Unknown credential format");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8")) as T;
}

/** Shows the last 4 characters only, for settings screens. */
export const mask = (s: string | undefined) => (s ? `••••${s.slice(-4)}` : "");

import "server-only";
/**
 * Public API keys: `bk_live_<random>`. Only a SHA-256 hash is stored; the key
 * is shown once. Scopes: read, write. Each key belongs to one business, and
 * every query it makes runs inside that business's row-level-security scope.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, withTenant } from "../db";
import { apiKeys } from "../db/schema-platform";
import { HttpError } from "../http";

export type Scope = "read" | "write";
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export async function createApiKey(businessId: string, input: { name: string; scopes: Scope[]; createdBy: string }) {
  const secret = `bk_live_${randomBytes(24).toString("base64url")}`;
  const id = `key_${randomBytes(8).toString("base64url")}`;
  await withTenant(businessId, (tx) => tx.insert(apiKeys).values({ businessId, id, name: input.name, prefix: secret.slice(0, 14), keyHash: sha256(secret), scopes: input.scopes, createdBy: input.createdBy }));
  return { id, key: secret, prefix: secret.slice(0, 14) };
}

export async function revokeApiKey(businessId: string, id: string) {
  await withTenant(businessId, (tx) => tx.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id)));
}

export async function listApiKeys(businessId: string) {
  return withTenant(businessId, (tx) =>
    tx.select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, scopes: apiKeys.scopes, createdAt: apiKeys.createdAt, lastUsedAt: apiKeys.lastUsedAt, revokedAt: apiKeys.revokedAt }).from(apiKeys),
  );
}

/* Simple per-key rate limit: 120 requests a minute (per server instance). */
const buckets = new Map<string, { n: number; reset: number }>();
const LIMIT = 120;

export type ApiKeyAuth = { businessId: string; keyId: string; name: string; scopes: Scope[] };

export async function authenticateApiKey(req: Request, need: Scope): Promise<ApiKeyAuth> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token.startsWith("bk_live_")) throw new HttpError(401, "Missing or malformed API key. Send `Authorization: Bearer bk_live_…`.", "unauthorized");
  // Global lookup by hash (owner connection); everything after runs tenant-scoped.
  const [k] = await db.select().from(apiKeys).where(and(eq(apiKeys.keyHash, sha256(token)), isNull(apiKeys.revokedAt)));
  if (!k) throw new HttpError(401, "This API key is invalid or was revoked.", "unauthorized");
  if (!k.scopes.includes(need)) throw new HttpError(403, `This key doesn't have the "${need}" scope.`, "forbidden");
  const now = Date.now();
  const b = buckets.get(k.id);
  if (!b || b.reset < now) buckets.set(k.id, { n: 1, reset: now + 60_000 });
  else if (++b.n > LIMIT) throw new HttpError(429, "Rate limit reached (120 requests a minute). Try again shortly.", "rate_limited");
  if (!k.lastUsedAt || now - k.lastUsedAt.getTime() > 60_000) await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, k.id));
  return { businessId: k.businessId, keyId: k.id, name: k.name, scopes: k.scopes };
}

import "server-only";
/** Shared pieces of the public REST API (/api/v1). */
import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "../http";
import { authenticateApiKey, type ApiKeyAuth, type Scope } from "./index";

/** Wraps a v1 handler: API-key auth with a scope, Stripe-style `{ error: { type, message } }` errors. */
export function v1<Args extends unknown[]>(scope: Scope, fn: (auth: ApiKeyAuth, req: Request, ...rest: Args) => Promise<unknown>) {
  return async (req: Request, ...rest: Args) => {
    try {
      const auth = await authenticateApiKey(req, scope);
      const out = await fn(auth, req, ...rest);
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e) {
      unstable_rethrow(e);
      if (e instanceof HttpError) return NextResponse.json({ error: { type: e.code ?? "invalid_request", message: e.message } }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: { type: "invalid_request", message: "Invalid parameters", issues: e.issues.slice(0, 5) } }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: { type: "server_error", message: "Something went wrong on our side." } }, { status: 500 });
    }
  };
}

export function pageParams(req: Request) {
  const u = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(u.searchParams.get("limit") ?? 50) || 50));
  const before = u.searchParams.get("created_before");
  return { limit, before: before ? new Date(before) : null, url: u };
}

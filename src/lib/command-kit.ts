/**
 * Building blocks shared by every command module (core and feature
 * extensions in ./commands-ext). Kept free of imports from commands.ts so
 * feature modules can use it without circular dependencies.
 */
import type { AppState } from "./state";
import type { Permission, Product, Role, Variant } from "./types";

export type Actor = { id: string; name: string; role: Role };

export type Ctx = {
  /** ISO time the command was issued on the device. */
  now: string;
  actor: Actor;
  /** Deterministic id generator: same command → same ids on device and server. */
  id: (prefix: string) => string;
};

export function makeCtx(commandId: string, now: string, actor: Actor): Ctx {
  let n = 0;
  return { now, actor, id: (prefix) => `${prefix}${commandId}${(n++).toString(36)}` };
}

export class CommandError extends Error {
  constructor(
    message: string,
    public code: "forbidden" | "invalid" | "not_found" | "limit" | "conflict" = "invalid",
  ) {
    super(message);
  }
}

export type CommandFn = (s: AppState, p: never, ctx: Ctx) => unknown;

/** A feature module: its commands and who may run them. */
export type CommandModule<C extends Record<string, CommandFn>> = { commands: C; permissions: { [K in keyof C]: Permission | null } };

export function findVariant(s: AppState, variantId: string): { p: Product; v: Variant } | null {
  for (const p of s.products) {
    const v = p.variants.find((x) => x.id === variantId);
    if (v) return { p, v };
  }
  return null;
}

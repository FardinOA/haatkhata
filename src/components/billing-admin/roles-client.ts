"use client";
/**
 * Custom roles on the device (FR-AUTH-06). In account mode definitions come
 * from /api/roles (cached for offline use); in the demo they live only on this
 * device. Either way they're registered into the shared permission registry,
 * so every `useCan()` check honours them.
 */
import { create } from "zustand";
import { registerCustomRoles } from "@/lib/domain";
import { useStore } from "@/lib/store";
import type { CustomRoleDef, Permission } from "@/lib/types";

const CACHE = "bk-custom-roles";
const DEMO_BIZ = "demo";

type RolesState = { roles: CustomRoleDef[]; available: boolean; loaded: boolean; error?: string };
export const useRoles = create<RolesState>(() => ({ roles: [], available: true, loaded: false }));

function read(): Record<string, CustomRoleDef[]> {
  try {
    return JSON.parse(localStorage.getItem(CACHE) ?? "{}");
  } catch {
    return {};
  }
}
function write(bizId: string, roles: CustomRoleDef[]) {
  try {
    localStorage.setItem(CACHE, JSON.stringify({ ...read(), [bizId]: roles }));
  } catch {
    /* storage unavailable */
  }
}

const bizId = () => {
  const s = useStore.getState().sync;
  return s.mode === "account" ? (s.businessId ?? "") : DEMO_BIZ;
};

function publish(id: string, roles: CustomRoleDef[], available: boolean) {
  registerCustomRoles(roles, { businessId: id, replace: true });
  useRoles.setState({ roles, available, loaded: true, error: undefined });
}

let inflight: Promise<void> | null = null;
let lastLoad = 0;

/** Loads definitions once (and at most every 60s). Cheap to call from many places. */
export function ensureRolesLoaded(force = false) {
  if (typeof window === "undefined") return Promise.resolve();
  if (inflight) return inflight;
  if (!force && Date.now() - lastLoad < 60_000 && useRoles.getState().loaded) return Promise.resolve();
  lastLoad = Date.now();
  const id = bizId();
  // Show cached definitions immediately (works offline).
  const cached = read()[id];
  if (cached) publish(id, cached, useRoles.getState().available);
  if (id === DEMO_BIZ || !id) {
    publish(id || DEMO_BIZ, cached ?? [], true);
    return Promise.resolve();
  }
  inflight = fetch("/api/roles")
    .then(async (r) => {
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Couldn't load roles");
      const d = (await r.json()) as { roles: CustomRoleDef[]; available: boolean };
      write(id, d.roles);
      publish(id, d.roles, d.available);
    })
    .catch((e) => useRoles.setState({ loaded: true, error: (e as Error).message }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export type RoleDraft = { name: string; nameBn?: string; permissions: Permission[]; maxDiscountPct: number };

/** Creates or updates a role; returns its key. */
export async function saveRole(draft: RoleDraft, id?: string): Promise<string> {
  const b = bizId();
  if (b === DEMO_BIZ) {
    const rid = id ?? `cr${Math.random().toString(36).slice(2, 9)}`;
    const def: CustomRoleDef = { key: `custom:${DEMO_BIZ}:${rid}`, id: rid, businessId: DEMO_BIZ, ...draft };
    const roles = [...useRoles.getState().roles.filter((r) => r.id !== rid), def];
    write(DEMO_BIZ, roles);
    publish(DEMO_BIZ, roles, true);
    return def.key;
  }
  const res = await fetch(id ? `/api/roles/${id}` : "/api/roles", { method: id ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ?? "Couldn't save the role");
  await ensureRolesLoaded(true);
  return d.key as string;
}

export async function deleteRole(id: string) {
  const b = bizId();
  if (b === DEMO_BIZ) {
    const inUse = useStore.getState().staff.some((s) => s.role === `custom:${DEMO_BIZ}:${id}`);
    if (inUse) throw new Error("Someone on the team has this role. Give them another role first.");
    const roles = useRoles.getState().roles.filter((r) => r.id !== id);
    write(DEMO_BIZ, roles);
    publish(DEMO_BIZ, roles, true);
    return;
  }
  const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't delete the role");
  await ensureRolesLoaded(true);
}

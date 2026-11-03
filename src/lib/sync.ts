"use client";
/**
 * Device ↔ server sync (account mode).
 *
 * push: send queued commands oldest-first; the server applies each exactly once.
 * pull: fetch everything changed since the last cursor and merge it by id —
 *       the server's version wins.
 * rebase: commands still waiting (made while we were syncing or offline) are
 *       re-applied on top, so the screen never loses what the user just did.
 */
import { COMMANDS, makeCtx, type QueuedCommand } from "./commands";
import { initialState, type AppState } from "./state";
import { useStore } from "./store";
import type { Staff } from "./types";

type Pulled = {
  cursor: string;
  full: boolean;
  businessId: string;
  me: { id: string; name: string; role: Staff["role"] };
  business?: Pick<AppState, "business" | "theme" | "invoice" | "pos" | "monthlyGoal" | "plan" | "nextOrderNo" | "nextInvoiceNo" | "nextPurchaseNo">;
  staff?: Staff[];
  categories?: AppState["categories"];
  deleted: { entity: string; id: string }[];
} & Pick<AppState, "products" | "customers" | "orders" | "movements" | "suppliers" | "purchases" | "expenses" | "notices">;

type Outcome = { id: string; status: "applied" | "duplicate" | "rejected"; error?: string };

const listeners = new Set<(rejected: { type: string; error: string }) => void>();
export function onSyncRejected(fn: (r: { type: string; error: string }) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers }, credentials: "same-origin" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), { status: res.status });
  return body as T;
}

const COLLECTIONS = ["products", "customers", "orders", "movements", "suppliers", "purchases", "expenses", "notices"] as const;
const ENTITY_TO_COLLECTION: Record<string, (typeof COLLECTIONS)[number]> = { product: "products", order: "orders", expense: "expenses", customer: "customers" };

function merge(s: AppState, p: Pulled) {
  if (p.full) for (const c of COLLECTIONS) (s[c] as unknown[]) = [];
  for (const c of COLLECTIONS) {
    const incoming = p[c] as { id: string }[];
    if (!incoming.length) continue;
    const list = s[c] as { id: string }[];
    const index = new Map(list.map((x, i) => [x.id, i]));
    for (const item of incoming) {
      const i = index.get(item.id);
      if (i === undefined) list.push(item);
      else list[i] = item;
    }
  }
  for (const d of p.deleted) {
    const c = ENTITY_TO_COLLECTION[d.entity];
    if (c) (s[c] as { id: string }[]) = (s[c] as { id: string }[]).filter((x) => x.id !== d.id);
  }
  s.orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  s.movements.sort((a, b) => a.at.localeCompare(b.at));
  if (p.business) Object.assign(s, p.business);
  if (p.staff) s.staff = p.staff.length ? p.staff : s.staff;
  if (p.categories) s.categories = p.categories;
  s.currentUserId = p.me.id;
  if (!s.staff.some((x) => x.id === p.me.id)) s.staff.unshift({ id: p.me.id, name: p.me.name, phone: "", role: p.me.role, color: "#0E6B53" });
}

function rebase(s: AppState) {
  const me = s.staff.find((x) => x.id === s.currentUserId) ?? s.staff[0];
  for (const c of s.outbox) {
    try {
      const fn = COMMANDS[c.type] as (s: AppState, p: unknown, ctx: ReturnType<typeof makeCtx>) => unknown;
      fn(s, structuredClone(c.payload), makeCtx(c.id, c.at, { id: me.id, name: me.name, role: me.role }));
    } catch {
      /* the server will give the definitive answer */
    }
  }
}

let running: Promise<void> | null = null;
let again = false;

/** Push then pull. Safe to call often — concurrent calls coalesce. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    const st = useStore.getState();
    if (st.sync.mode !== "account") return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      st.setSync({ status: "offline" });
      return;
    }
    st.setSync({ status: "syncing", error: undefined });
    try {
      // push, in batches, oldest first
      let hadRejections = false;
      for (let guard = 0; guard < 20; guard++) {
        const batch = useStore.getState().outbox.slice(0, 100);
        if (!batch.length) break;
        const { results } = await api<{ results: Outcome[] }>("/api/sync/push", { method: "POST", body: JSON.stringify({ commands: batch }) });
        const done = new Set(results.map((r) => r.id));
        const rejected = results.filter((r) => r.status === "rejected");
        useStore.setState((s) => {
          s.outbox = s.outbox.filter((c) => !done.has(c.id));
          for (const r of rejected) {
            const c = batch.find((x) => x.id === r.id);
            s.sync.rejected.unshift({ id: r.id, type: c?.type ?? "?", error: r.error ?? "Rejected", at: new Date().toISOString() });
          }
          s.sync.rejected = s.sync.rejected.slice(0, 50);
        });
        if (rejected.length) hadRejections = true;
        rejected.forEach((r) => listeners.forEach((l) => l({ type: batch.find((x) => x.id === r.id)?.type ?? "", error: r.error ?? "Rejected" })));
      }
      // Only pull once everything local has reached the server; otherwise
      // unsent optimistic changes would be merged twice. Try again shortly.
      if (useStore.getState().outbox.length) {
        again = true;
        return;
      }
      // A rejection leaves optimistic effects on this device that the server
      // never accepted — reload everything to get back to the truth.
      const since = hadRejections ? undefined : useStore.getState().sync.cursor;
      const pulled = await api<Pulled>(`/api/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ""}`);
      useStore.setState((s) => {
        merge(s, pulled);
        // Anything queued while the pull was in flight was wiped by a full
        // reload, so re-apply it on top.
        if (pulled.full) rebase(s);
        s.sync.cursor = pulled.cursor;
        s.sync.businessId = pulled.businessId;
        s.sync.lastSyncAt = new Date().toISOString();
        s.sync.status = s.outbox.length ? "syncing" : "idle";
      });
    } catch (e) {
      const status = (e as { status?: number }).status;
      useStore.getState().setSync({ status: status ? "error" : "offline", error: status === 401 ? "signed_out" : (e as Error).message });
    }
  })().finally(() => {
    running = null;
    if (again) {
      again = false;
      void syncNow();
    }
  });
  return running;
}

/** Switches this device into account mode for the signed-in business and loads its data. */
export async function enterAccount(userId: string) {
  useStore.setState((s) => {
    const keep = { lang: s.lang, numerals: s.numerals, dashboard: s.dashboard, theme: s.theme, printer: s.printer };
    // Same person signing back in (e.g. after a PIN lockout): keep unsynced work.
    const outbox = s.sync.mode === "account" && s.sync.userId === userId ? s.outbox : [];
    Object.assign(s, initialState(), keep, { outbox });
    s.seeded = true;
    s.staff = [];
    s.sync = { mode: "account", userId, status: "syncing", rejected: [] };
  });
  await syncNow();
}

/** Signs out and returns this device to the local demo. */
export async function leaveAccount() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  useStore.setState((s) => Object.assign(s, initialState()));
  await useStore.getState().seed();
}

let started = false;
/** Background sync loop: on load, every 20s, when back online/visible, and shortly after each change. */
export function startSyncLoop() {
  if (started || typeof window === "undefined") return;
  started = true;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  useStore.subscribe((s, prev) => {
    if (s.sync.mode === "account" && s.outbox.length > prev.outbox.length) {
      clearTimeout(debounce);
      debounce = setTimeout(() => void syncNow(), 600);
    }
  });
  window.addEventListener("online", () => void syncNow());
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void syncNow());
  setInterval(() => void syncNow(), 20_000);
  void syncNow();
}

export type { QueuedCommand };

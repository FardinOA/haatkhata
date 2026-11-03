"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { can as canDo, customRolesVersion, subscribeCustomRoles } from "./domain";
import { ensureRolesLoaded } from "@/components/billing-admin/roles-client";
import { makeFormatters } from "./format";
import { pick, type Bi } from "./labels";
import { currentActor, useStore } from "./store";
import type { Permission } from "./types";

/**
 * Inline bilingual strings: `t("New order", "নতুন অর্ডার")`.
 * Keeps translations next to the UI they belong to.
 */
function makeT(lang: "en" | "bn") {
  return Object.assign((en: string, bn: string) => (lang === "bn" ? bn : en), {
    pick: (b: Bi) => pick(b, lang),
    lang,
  });
}
export type T = ReturnType<typeof makeT>;

export function useT() {
  const lang = useStore((s) => s.lang);
  return useMemo(() => makeT(lang), [lang]);
}

export function useFmt() {
  const lang = useStore((s) => s.lang);
  const numerals = useStore((s) => s.numerals);
  return useMemo(() => makeFormatters({ lang, numerals }), [lang, numerals]);
}

export function useCan() {
  const role = useStore((s) => currentActor(s).role);
  // Re-evaluate when custom role definitions load or change (FR-AUTH-06).
  const version = useSyncExternalStore(subscribeCustomRoles, customRolesVersion, customRolesVersion);
  const scope = useStore((s) => `${s.sync.mode}:${s.sync.businessId ?? ""}`);
  useEffect(() => {
    if (role.startsWith("custom:")) void ensureRolesLoaded();
  }, [role, scope]);
  return useMemo(() => {
    void version;
    return (p: Permission) => canDo(role, p);
  }, [role, version]);
}

const hydrationListeners = new Set<() => void>();
let hydrated = false;
// Rehydrating sets state, which re-renders subscribers and re-subscribes useHydrated;
// without this guard each re-subscribe would start another rehydrate, forever.
let hydrating = false;

/** Rehydrates the persisted store once on the client and seeds demo data on first run. */
export function hydrateStore() {
  if (hydrated || hydrating || typeof window === "undefined") return;
  hydrating = true;
  Promise.resolve(useStore.persist.rehydrate()).then(async () => {
    if (!useStore.getState().seeded) await useStore.getState().seed();
    hydrated = true;
    hydrationListeners.forEach((l) => l());
  });
}

export function useHydrated() {
  return useSyncExternalStore(
    (cb) => {
      hydrationListeners.add(cb);
      hydrateStore();
      return () => hydrationListeners.delete(cb);
    },
    () => hydrated,
    () => false,
  );
}

/** A clock that ticks every `ms`; for "2m ago" labels. */
export function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function useMediaQuery(q: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(q);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(q).matches,
    () => false,
  );
}

export function useDebounced<T>(value: T, ms = 150) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Global keyboard shortcut. Ignores typing in inputs unless `allowInInputs`. */
export function useHotkey(key: string, handler: (e: KeyboardEvent) => void, opts: { meta?: boolean; allowInInputs?: boolean; enabled?: boolean } = {}) {
  const { meta = false, allowInInputs = false, enabled = true } = opts;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      if (meta && !(e.metaKey || e.ctrlKey)) return;
      const tgt = e.target as HTMLElement | null;
      const typing = tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable);
      if (typing && !allowInInputs && !meta && !key.startsWith("F")) return;
      handler(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, handler, meta, allowInInputs, enabled]);
}

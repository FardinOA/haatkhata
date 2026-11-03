"use client";
/**
 * Device quick-unlock PIN (FR-AUTH-08).
 * Account mode: the server holds the scrypt hash per session and signs the
 * device out after 5 wrong tries. A PBKDF2 copy is kept on the device so the
 * counter can still be unlocked while offline (same 5-try limit).
 * Demo mode: device-only.
 */
import { create } from "zustand";
import { useStore } from "@/lib/store";

const LOCAL = "bk-pin";
const IDLE = "bk-pin-idle";
/** The lock survives reloads and navigation; only the PIN or a fresh phone sign-in clears it. */
const LOCKED = "bk-pin-locked";
export const PIN_TRIES = 5;

type Local = { salt: string; hash: string; failed: number };
type PinState = { enabled: boolean; locked: boolean; idleMinutes: number };

const readLocal = (): Local | null => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL) ?? "null");
  } catch {
    return null;
  }
};
const writeLocal = (v: Local | null) => {
  try {
    if (v) localStorage.setItem(LOCAL, JSON.stringify(v));
    else localStorage.removeItem(LOCAL);
  } catch {
    /* storage unavailable */
  }
};

function idleFromStorage() {
  try {
    return Number(localStorage.getItem(IDLE) ?? 5) || 5;
  } catch {
    return 5;
  }
}

export const usePin = create<PinState>(() => ({ enabled: false, locked: false, idleMinutes: 5 }));

usePin.subscribe((s, prev) => {
  if (s.locked === prev.locked) return;
  try {
    if (s.locked) localStorage.setItem(LOCKED, "1");
    else localStorage.removeItem(LOCKED);
  } catch {
    /* ignore */
  }
});

export function initPin() {
  const local = readLocal();
  let locked = false;
  try {
    locked = localStorage.getItem(LOCKED) === "1";
  } catch {
    /* ignore */
  }
  usePin.setState({ enabled: !!local, idleMinutes: idleFromStorage(), locked });
  // A new session (fresh phone sign-in) has no PIN on the server: the old one no longer applies.
  if (accountMode() && navigator.onLine)
    fetch("/api/pin")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { hasPin: boolean } | null) => {
        if (d && !d.hasPin) {
          writeLocal(null);
          usePin.setState({ enabled: false, locked: false });
        }
      })
      .catch(() => {});
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: 150_000 }, key, 256);
  return b64(new Uint8Array(bits));
}

const accountMode = () => useStore.getState().sync.mode === "account";

export function weakPin(pin: string) {
  return !/^\d{4}$/.test(pin) || /^(\d)\1{3}$/.test(pin) || ["1234", "4321", "0123", "9876"].includes(pin);
}

export async function enablePin(pin: string) {
  if (weakPin(pin)) throw new Error("Pick 4 digits that are harder to guess");
  if (accountMode()) {
    const r = await fetch("/api/pin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Couldn't save the PIN");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  writeLocal({ salt: b64(salt), hash: await derive(pin, salt), failed: 0 });
  usePin.setState({ enabled: true });
}

export async function disablePin() {
  if (accountMode()) await fetch("/api/pin", { method: "DELETE" }).catch(() => {});
  writeLocal(null);
  usePin.setState({ enabled: false, locked: false });
}

export function setIdleMinutes(m: number) {
  try {
    localStorage.setItem(IDLE, String(m));
  } catch {
    /* ignore */
  }
  usePin.setState({ idleMinutes: m });
}

export const lockNow = () => usePin.getState().enabled && usePin.setState({ locked: true });

export type VerifyResult = { ok: true } | { ok: false; left: number; signedOut: boolean };

/** Checks with the server when online, else against the device copy. */
export async function unlock(pin: string): Promise<VerifyResult> {
  const local = readLocal();
  if (accountMode() && navigator.onLine) {
    try {
      const r = await fetch("/api/pin/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
      if (r.status !== 404 && r.status !== 401) {
        const d = (await r.json()) as { ok: boolean; left?: number; locked?: boolean };
        if (d.ok) {
          if (local) writeLocal({ ...local, failed: 0 });
          usePin.setState({ locked: false });
          return { ok: true };
        }
        if (d.locked) {
          writeLocal(null);
          usePin.setState({ enabled: false, locked: false });
          return { ok: false, left: 0, signedOut: true };
        }
        return { ok: false, left: d.left ?? 0, signedOut: false };
      }
      if (r.status === 401) {
        writeLocal(null);
        usePin.setState({ enabled: false, locked: false });
        return { ok: false, left: 0, signedOut: true };
      }
    } catch {
      /* offline — fall through to the device copy */
    }
  }
  if (!local) return { ok: false, left: 0, signedOut: true };
  if ((await derive(pin, unb64(local.salt))) === local.hash) {
    writeLocal({ ...local, failed: 0 });
    usePin.setState({ locked: false });
    return { ok: true };
  }
  const failed = local.failed + 1;
  if (failed >= PIN_TRIES) {
    writeLocal(null);
    usePin.setState({ enabled: false, locked: false });
    return { ok: false, left: 0, signedOut: true };
  }
  writeLocal({ ...local, failed });
  return { ok: false, left: PIN_TRIES - failed, signedOut: false };
}

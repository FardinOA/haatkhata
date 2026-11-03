"use client";
/**
 * Lock screen for shared counter devices (FR-AUTH-08). Mount once in the app
 * shell: <PinLock />. Locks after the chosen idle time; unlocks with a
 * 4-digit PIN. Nothing on the device is lost while locked.
 */
import { Backspace, LockSimple, SignIn } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "../bits";
import { Avatar, cn } from "../ui/core";
import { useT } from "@/lib/hooks";
import { useMe, useStore } from "@/lib/store";
import { initPin, lockNow, unlock, usePin } from "./pin-client";

const LAST = "bk-last-active";

export function PinLock() {
  const enabled = usePin((s) => s.enabled);
  const locked = usePin((s) => s.locked);
  const idle = usePin((s) => s.idleMinutes);

  useEffect(() => {
    initPin();
    try {
      const last = Number(localStorage.getItem(LAST) ?? 0);
      if (usePin.getState().enabled && last && Date.now() - last > usePin.getState().idleMinutes * 60_000) lockNow();
    } catch {
      /* ignore */
    }
  }, []);

  // Idle timer: any interaction resets it.
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    let lastWrite = 0;
    const bump = () => {
      clearTimeout(timer);
      timer = setTimeout(lockNow, idle * 60_000);
      if (Date.now() - lastWrite > 15_000) {
        lastWrite = Date.now();
        try {
          localStorage.setItem(LAST, String(lastWrite));
        } catch {
          /* ignore */
        }
      }
    };
    const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    bump();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [enabled, idle]);

  return locked ? <LockScreen /> : null;
}

function LockScreen() {
  const t = useT();
  const me = useMe();
  const business = useStore((s) => s.business);
  const accountMode = useStore((s) => s.sync.mode === "account");
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const submit = useCallback(
    async (pin: string) => {
      setBusy(true);
      const r = await unlock(pin);
      setBusy(false);
      if (r.ok) return;
      setDigits("");
      setShake(true);
      setTimeout(() => setShake(false), 420);
      if (r.signedOut) {
        setSignedOut(true);
        setMessage(t("Too many wrong tries. Sign in with your phone to continue — nothing on this device was lost.", "অনেকবার ভুল হয়েছে। ফোন দিয়ে সাইন ইন করুন — এই ডিভাইসের কিছুই হারায়নি।"));
      } else setMessage(t(`Wrong PIN. ${r.left} ${r.left === 1 ? "try" : "tries"} left.`, `ভুল পিন। আর ${r.left} বার চেষ্টা করা যাবে।`));
    },
    [t],
  );

  const press = useCallback(
    (d: string) => {
      if (busy || signedOut) return;
      setMessage(null);
      setDigits((cur) => {
        const next = (cur + d).slice(0, 4);
        if (next.length === 4) void submit(next);
        return next;
      });
    },
    [busy, signedOut, submit],
  );

  useEffect(() => {
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setDigits((d) => d.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [press]);

  return (
    <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t("Device locked", "ডিভাইস লক")} className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto bg-canvas px-6 py-10 focus:outline-none">
      <div className="relative flex w-full max-w-[340px] flex-col items-center text-center">
        <BrandMark size={52} />
        <p className="mt-3 font-display text-lg font-semibold text-ink">{business.name}</p>
        <div className="mt-8 flex items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4 shadow-1">
          <Avatar name={me.name} color={me.color} size={30} />
          <span className="text-sm font-medium text-ink">{me.name}</span>
          <LockSimple className="size-4 text-ink-3" />
        </div>
        <p className="mt-6 text-[15px] text-ink-2">{t("Enter your 4-digit PIN", "৪ সংখ্যার পিন দিন")}</p>
        <div className={cn("mt-4 flex gap-4", shake && "animate-[pinshake_0.4s]")} aria-live="polite" aria-label={t(`${digits.length} of 4 digits entered`, `৪টির মধ্যে ${digits.length}টি দেওয়া হয়েছে`)}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn("size-3.5 rounded-full border-2 transition-all duration-150", i < digits.length ? "scale-110 border-brand bg-brand" : "border-line-strong bg-surface")} />
          ))}
        </div>
        <p className={cn("mt-4 min-h-10 text-[13px]", signedOut ? "text-danger" : "text-danger")} role="alert">
          {message}
        </p>
        {signedOut ? (
          <Link href="/login" className="mt-2 inline-flex h-12 items-center gap-2 rounded-md bg-brand px-5 text-[15px] font-semibold text-brand-contrast">
            <SignIn className="size-5" />
            {t("Sign in with phone", "ফোন দিয়ে সাইন ইন")}
          </Link>
        ) : (
          <div className="mt-1 grid w-full grid-cols-3 gap-3" role="group" aria-label={t("Keypad", "কিপ্যাড")}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"].map((k, i) =>
              k === "" ? (
                <span key={i} />
              ) : (
                <button
                  key={i}
                  type="button"
                  disabled={busy}
                  onClick={() => (k === "back" ? setDigits((d) => d.slice(0, -1)) : press(k))}
                  aria-label={k === "back" ? t("Delete digit", "মুছুন") : k}
                  className="grid h-16 place-items-center rounded-lg border border-line bg-surface font-display text-2xl font-semibold text-ink shadow-1 transition-all hover:bg-surface-2 active:scale-95 active:bg-sunken disabled:opacity-50"
                >
                  {k === "back" ? <Backspace className="size-6 text-ink-2" /> : k}
                </button>
              ),
            )}
          </div>
        )}
        {!signedOut && accountMode && (
          <Link href="/login" className="mt-6 text-[13px] font-medium text-brand-ink hover:underline">
            {t("Not you? Sign in with a phone code", "আপনি নন? ফোন কোড দিয়ে সাইন ইন")}
          </Link>
        )}
      </div>
      <style>{`@keyframes pinshake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
    </div>
  );
}

"use client";

import { DeviceMobile } from "@phosphor-icons/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/core";
import { useToast } from "@/components/ui/overlays";
import { useT } from "@/lib/hooks";
import type { ScanOutcome } from "./camera-scanner";
import { PhoneLinkSheet, usePhoneLink, type PhoneLink } from "./phone-link";

type Target = (code: string) => ScanOutcome;
type Ctx = { link: PhoneLink; open: (opts?: { onUseCamera?: () => void }) => void; register: (t: { current: Target }) => () => void };

const PhoneScannerCtx = createContext<Ctx | null>(null);

const TYPABLE = new Set(["", "text", "search", "tel", "number", "url", "email"]);

/** The focused text box, if a scanner could type into it. */
function focusedField() {
  const el = document.activeElement;
  if (el instanceof HTMLTextAreaElement) return el.readOnly || el.disabled ? null : el;
  if (el instanceof HTMLInputElement) return TYPABLE.has(el.type) && !el.readOnly && !el.disabled ? el : null;
  return null;
}

/** Does what a USB keyboard-wedge scanner does: types the code where the cursor is, then presses Enter. */
function typeInto(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setValue = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  let start = el.value.length;
  let end = start;
  try {
    start = el.selectionStart ?? start;
    end = el.selectionEnd ?? start;
  } catch {
    /* number inputs have no selection */
  }
  // The native setter, so React's controlled inputs see the change.
  setValue.call(el, el.value.slice(0, start) + text + el.value.slice(end));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  const enter = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true });
  el.dispatchEvent(enter);
  el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
  // Synthetic keys don't submit forms by themselves; a real Enter would.
  if (!enter.defaultPrevented && el instanceof HTMLInputElement) el.form?.requestSubmit();
}

/**
 * One phone-scanner connection for the whole app (mounted in the shell), so
 * a phone paired once keeps scanning as the cashier moves between screens.
 * Screens that know what a scan means register a target; anywhere else the
 * phone behaves like a USB scanner and types into the focused box.
 */
export function PhoneScannerProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const toast = useToast();
  const targets = useRef<{ current: Target }[]>([]);
  const [sheet, setSheet] = useState<{ onUseCamera?: () => void } | null>(null);

  const link = usePhoneLink((code) => {
    const target = targets.current.at(-1);
    if (target) {
      const r = target.current(code);
      toast({ title: r.title, body: r.detail, tone: r.ok ? "ok" : "warn" });
      return r;
    }
    const field = focusedField();
    if (field) {
      typeInto(field, code);
      const name = field.getAttribute("aria-label") || field.placeholder;
      return { ok: true, title: t("Typed on the computer", "কম্পিউটারে লেখা হয়েছে"), detail: name ? `${code} → ${name}` : code };
    }
    const r = { ok: false, title: t("Click a box on the computer first", "আগে কম্পিউটারে একটি ঘরে ক্লিক করুন"), detail: t(`Or open the order screen — scans go into the cart there. (${code})`, `অথবা অর্ডার স্ক্রিন খুলুন — সেখানে কার্টে যাবে। (${code})`) };
    toast({ title: t("A scan from the phone had nowhere to go", "ফোনের স্ক্যান কোথাও যায়নি"), body: t("Click a search or code box, then scan again.", "একটি সার্চ বা কোডের ঘরে ক্লিক করে আবার স্ক্যান করুন।"), tone: "warn" });
    return r;
  });

  const register = useCallback((target: { current: Target }) => {
    targets.current.push(target);
    return () => {
      targets.current = targets.current.filter((x) => x !== target);
    };
  }, []);
  const open = useCallback((opts?: { onUseCamera?: () => void }) => setSheet(opts ?? {}), []);
  const value = useMemo(() => ({ link, open, register }), [link, open, register]);

  return (
    <PhoneScannerCtx.Provider value={value}>
      {children}
      <PhoneLinkSheet open={!!sheet} onClose={() => setSheet(null)} link={link} onUseCamera={sheet?.onUseCamera} />
    </PhoneScannerCtx.Provider>
  );
}

export function usePhoneScanner() {
  const ctx = useContext(PhoneScannerCtx);
  if (!ctx) throw new Error("usePhoneScanner needs PhoneScannerProvider (the app shell)");
  return ctx;
}

/** While mounted, phone scans go to `handler` instead of the focused box. */
export function usePhoneScanTarget(handler: Target) {
  const { register } = usePhoneScanner();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => register(ref), [register]);
}

/** Top-bar entry: pair a phone from any screen; the dot shows it's live. */
export function PhoneScannerButton({ className }: { className?: string }) {
  const t = useT();
  const { link, open } = usePhoneScanner();
  return (
    <button
      type="button"
      onClick={() => open()}
      className={cn("relative grid size-9 place-items-center rounded-full text-ink-2 transition-colors hover:bg-sunken hover:text-ink", className)}
      aria-label={link.phone ? t("Phone scanner — connected", "ফোন স্ক্যানার — যুক্ত") : t("Use your phone as a scanner", "ফোনকে স্ক্যানার বানান")}
      title={link.phone ? t("Phone scanner connected", "ফোন স্ক্যানার যুক্ত") : t("Use your phone as a scanner", "ফোনকে স্ক্যানার বানান")}
    >
      <DeviceMobile className="size-[18px]" />
      {link.phone && <span className="absolute right-1 top-1 size-2 rounded-full bg-ok ring-2 ring-surface" />}
    </button>
  );
}

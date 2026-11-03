"use client";

import { Barcode, Stop } from "@phosphor-icons/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, cn } from "@/components/ui/core";
import { makeT } from "@/lib/hooks";
import { primeScanFeedback, ScanLog, Viewfinder, type ScanLogEntry, type ScanOutcome } from "./camera-scanner";

/** How long the phone waits for the counter to say what it did with a scan. */
const ANSWER_MS = 6000;

/**
 * The phone half of the phone-as-scanner pair (opened from the QR on the
 * order screen). Codes go up to the counter; the counter's answer — added,
 * out of stock, unknown — comes back and is beeped, flashed and logged here.
 */
export function PhoneScanner({ token, lang }: { token: string; lang: "en" | "bn" }) {
  const t = makeT(lang);
  const [counter, setCounter] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [log, setLog] = useState<ScanLogEntry[]>([]);
  const pending = useRef(new Map<string, (r: ScanOutcome) => void>());
  // Answers go to every phone on the link, so ids carry a per-page prefix.
  const ids = useRef({ prefix: "", n: 0 });
  const added = log.filter((l) => l.ok).length;
  const secure = useSyncExternalStore(
    () => () => {},
    () => window.isSecureContext,
    () => null,
  );

  useEffect(() => {
    ids.current.prefix = Math.random().toString(36).slice(2, 10);
    const es = new EventSource(`/api/scan/${token}/phone`);
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as { type: "desktop"; connected: boolean } | ({ type: "result"; id: string } & ScanOutcome);
      if (e.type === "desktop") setCounter(e.connected);
      else {
        pending.current.get(e.id)?.({ ok: e.ok, title: e.title, detail: e.detail });
        pending.current.delete(e.id);
      }
    };
    es.onerror = () => setCounter(es.readyState === EventSource.CLOSED ? false : null);
    return () => es.close();
  }, [token]);

  const offline: ScanOutcome = { ok: false, title: t("The counter isn't connected", "কাউন্টার যুক্ত নেই"), detail: t("Open the order screen on the computer and tap Scan.", "কম্পিউটারে অর্ডার স্ক্রিন খুলে স্ক্যান চাপুন।") };

  const send = async (code: string): Promise<ScanOutcome> => {
    if (counter === false) return offline;
    const id = `${ids.current.prefix}-${++ids.current.n}`;
    const res = await fetch(`/api/scan/${token}/phone`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, code }) })
      .then((r) => (r.ok ? (r.json() as Promise<{ delivered: boolean }>) : null))
      .catch(() => null);
    if (!res) return { ok: false, title: t("No internet on the phone", "ফোনে ইন্টারনেট নেই"), detail: code };
    if (!res.delivered) return offline;
    return new Promise((resolve) => {
      pending.current.set(id, resolve);
      setTimeout(() => {
        if (pending.current.delete(id)) resolve({ ok: false, title: t("The counter didn't answer", "কাউন্টার সাড়া দেয়নি"), detail: code });
      }, ANSWER_MS);
    });
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-canvas px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(14px,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-3">
        <span className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">BechaKena</span>
        <span
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium",
            counter ? "border-ok/25 bg-ok-soft text-ok" : counter === false ? "border-line bg-surface text-ink-3" : "border-line bg-surface text-ink-2",
          )}
          aria-live="polite"
        >
          <span className={cn("size-1.5 rounded-full", counter ? "bg-ok" : counter === false ? "bg-ink-4" : "animate-pulse bg-warn")} />
          {counter ? t("Counter connected", "কাউন্টার যুক্ত") : counter === false ? t("Counter offline", "কাউন্টার বন্ধ") : t("Connecting…", "যুক্ত হচ্ছে…")}
        </span>
      </header>

      {scanning ? (
        <div className="mt-4 flex flex-1 flex-col gap-4">
          <Viewfinder lang={lang} className="aspect-[3/4] max-h-[62dvh] w-full" onCode={send} onResult={(r) => setLog((l) => [{ ...r, id: Date.now() }, ...l].slice(0, 12))} />
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-ink-3">
              <span className="tnum font-display text-[22px] font-semibold text-ink">{added}</span> {t("added to the cart", "টি কার্টে যোগ হয়েছে")}
            </p>
            <Button size="sm" icon={<Stop className="size-4" weight="fill" />} onClick={() => setScanning(false)}>
              {t("Stop", "থামান")}
            </Button>
          </div>
          <ScanLog lang={lang} log={log} empty={t("Point at a label. Each beep means the counter got it.", "লেবেলে ক্যামেরা ধরুন। প্রতিটি বিপ মানে কাউন্টারে পৌঁছেছে।")} />
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center py-10">
          <span className="grid size-14 place-items-center rounded-xl bg-ink text-white">
            <Barcode className="size-7" />
          </span>
          <h1 className="mt-5 font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">{t("This phone is the counter's scanner", "এই ফোনই কাউন্টারের স্ক্যানার")}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
            {t("Scan a product's barcode and it goes straight into the cart on the computer. Keep this page open while you sell.", "পণ্যের বারকোড স্ক্যান করলেই কম্পিউটারের কার্টে চলে যাবে। বিক্রির সময় পেজটি খোলা রাখুন।")}
          </p>
          {counter === false && <p className="mt-4 rounded-md border border-warn/25 bg-warn-soft px-3 py-2.5 text-[13px] text-warn">{offline.detail}</p>}
          {secure === false && (
            <p className="mt-4 rounded-md border border-warn/25 bg-warn-soft px-3 py-2.5 text-[13px] text-warn">
              {t("This page isn't on https, so the phone won't allow the camera. Open the link that starts with https://.", "পেজটি https এ নেই, তাই ফোন ক্যামেরা চালু করতে দেবে না। https:// দিয়ে শুরু হওয়া লিংকটি খুলুন।")}
            </p>
          )}
          <Button
            variant="primary"
            size="lg"
            className="mt-8 w-full"
            onClick={() => {
              primeScanFeedback();
              setScanning(true);
            }}
          >
            {t("Start scanning", "স্ক্যান শুরু করুন")}
          </Button>
          <p className="mt-3 text-center text-xs text-ink-3">{t("Tip: add this page to your home screen to open it in one tap.", "টিপ: হোম স্ক্রিনে যোগ করলে এক ট্যাপে খুলবে।")}</p>
        </div>
      )}
    </main>
  );
}

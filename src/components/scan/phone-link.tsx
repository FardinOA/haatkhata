"use client";

import { ArrowsClockwise, Camera, CheckCircle, CopySimple, DeviceMobile } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { useQr } from "@/components/invoice/documents";
import { Button, cn } from "@/components/ui/core";
import { Sheet, useToast } from "@/components/ui/overlays";
import { useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import type { ScanOutcome } from "./camera-scanner";

const TOKEN_KEY = "bk-scan-link";
const ON_KEY = "bk-scan-link-on";

type Status = "off" | "connecting" | "ready" | "retrying" | "signedout";

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* private mode: the link just won't survive a reload */
  }
};

/** A new link from the server — or why not: signed out (`auth`) or unreachable (`null`). */
async function pair(): Promise<{ token: string } | { auth: true } | null> {
  const res = await fetch("/api/scan/pair", { method: "POST" }).catch(() => null);
  if (res?.status === 401 || res?.status === 403) return { auth: true };
  if (!res?.ok) return null;
  const { token } = (await res.json()) as { token: string };
  write(TOKEN_KEY, token);
  return { token };
}

/**
 * Lets a phone act as this computer's barcode scanner. Once switched on it
 * stays on (reconnecting after reloads, server restarts and dropped Wi-Fi)
 * and keeps the same link, so the phone the cashier paired keeps working.
 */
export function usePhoneLink(onCode: (code: string) => ScanOutcome) {
  const [token, setToken] = useState<string | null>(() => read(TOKEN_KEY));
  const [on, setOn] = useState(() => read(ON_KEY) === "1");
  const [status, setStatus] = useState<Status>("off");
  const [phone, setPhone] = useState(false);
  const [gen, setGen] = useState(0);

  const handle = useEffectEvent((id: string, code: string, tk: string) => {
    const r = onCode(code);
    void fetch(`/api/scan/${tk}/desktop`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...r }) }).catch(() => {});
  });

  useEffect(() => {
    if (!on) return;
    let dead = false;
    let es: EventSource | null = null;
    let timer = 0;
    let delay = 1000;
    let tk = token;

    const later = () => {
      setStatus("retrying");
      clearTimeout(timer);
      timer = window.setTimeout(start, delay);
      delay = Math.min(delay * 2, 30_000);
    };

    async function start() {
      if (dead) return;
      es?.close();
      es = null;
      if (tk) {
        // Why did the last stream end? Only a link for another shop needs replacing.
        const check = await fetch(`/api/scan/${tk}/desktop?check=1`).then((r) => r.status, () => 0);
        if (dead) return;
        if (check === 401 || check === 403) return setStatus("signedout");
        if (check === 404) tk = null;
        else if (check !== 200) return later();
      }
      if (!tk) {
        const p = await pair();
        if (dead) return;
        if (!p) return later();
        if ("auth" in p) return setStatus("signedout");
        tk = p.token;
        setToken(tk);
      }
      const link = tk;
      const src = new EventSource(`/api/scan/${link}/desktop`);
      es = src;
      src.onopen = () => {
        delay = 1000;
        setStatus("ready");
      };
      src.onmessage = (m) => {
        const e = JSON.parse(m.data) as { type: "code"; id: string; code: string } | { type: "phone"; connected: boolean };
        if (e.type === "phone") setPhone(e.connected);
        else handle(e.id, e.code, link);
      };
      src.onerror = () => {
        setPhone(false);
        // CONNECTING: the browser is already retrying. CLOSED: it gave up, so we take over.
        if (src.readyState === EventSource.CLOSED) later();
        else setStatus("retrying");
      };
    }

    const wake = () => {
      if (es?.readyState === EventSource.OPEN) return;
      delay = 1000;
      clearTimeout(timer);
      void start();
    };
    window.addEventListener("online", wake);
    void (async () => {
      setStatus("connecting");
      await start();
    })();
    return () => {
      dead = true;
      clearTimeout(timer);
      es?.close();
      window.removeEventListener("online", wake);
      setPhone(false);
      setStatus("off");
    };
    // `token` changes only when this effect itself re-pairs, or on reset (which bumps `gen`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, gen]);

  const enable = useCallback(() => {
    write(ON_KEY, "1");
    setOn(true);
  }, []);
  const disable = useCallback(() => {
    write(ON_KEY, null);
    setOn(false);
  }, []);
  /** Reconnects right away instead of waiting out the back-off. */
  const retry = useCallback(() => setGen((g) => g + 1), []);
  /** Retires the old link (a lost phone, a leaked QR) and issues a new one. */
  const reset = useCallback(async () => {
    const p = await pair();
    if (!p || "auth" in p) return false;
    setToken(p.token);
    write(ON_KEY, "1");
    setOn(true);
    setGen((g) => g + 1);
    return true;
  }, []);

  return { token, on, status, phone, enable, disable, retry, reset };
}

export type PhoneLink = ReturnType<typeof usePhoneLink>;

/** QR + link the cashier opens on their phone; shows when the phone is live. */
export function PhoneLinkSheet({ open, onClose, link, onUseCamera }: { open: boolean; onClose: () => void; link: PhoneLink; onUseCamera?: () => void }) {
  const t = useT();
  const toast = useToast();
  const lang = useStore((s) => s.lang);
  // The server knows the address a phone can reach (on localhost, this machine's Wi-Fi IP).
  const [base, setBase] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    fetch("/api/scan/pair")
      .then((r) => (r.ok ? (r.json() as Promise<{ base: string }>) : null))
      .then((j) => live && j?.base && setBase(j.base))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open]);
  // The sheet only renders on the client, after a tap.
  const url = link.token ? `${base ?? window.location.origin}/scan/${link.token}${lang === "bn" ? "?lang=bn" : ""}` : "";
  const insecure = url.startsWith("http://");
  const qr = useQr(url || " ");
  const { enable, retry } = link;
  const stuck = link.status === "retrying" || link.status === "signedout";

  useEffect(() => {
    if (open) enable();
  }, [open, enable]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: t("Link copied", "লিংক কপি হয়েছে"), body: t("Send it to the phone on WhatsApp or Messenger.", "WhatsApp বা Messenger এ ফোনে পাঠান।") });
    } catch {
      toast({ title: t("Couldn't copy — select the link and copy it", "কপি হয়নি — লিংকটি সিলেক্ট করে কপি করুন"), tone: "warn" });
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      width={460}
      title={t("Scan with your phone", "ফোন দিয়ে স্ক্যান")}
      sub={t("Your phone works like a wireless barcode scanner for this computer — on the order screen scans go into the cart, anywhere else they're typed into the box you've clicked.", "ফোন হবে এই কম্পিউটারের তারবিহীন বারকোড স্ক্যানার — অর্ডার স্ক্রিনে স্ক্যান কার্টে যাবে, অন্য জায়গায় যে ঘরে ক্লিক করা আছে সেখানে লেখা হবে।")}
      footer={
        <>
          {onUseCamera && (
            <Button
              variant="ghost"
              icon={<Camera className="size-4" />}
              onClick={() => {
                onClose();
                onUseCamera();
              }}
            >
              {t("Use this computer's camera", "এই কম্পিউটারের ক্যামেরা")}
            </Button>
          )}
          <Button variant="primary" className="ml-auto" onClick={onClose}>
            {t("Done", "শেষ")}
          </Button>
        </>
      }
    >
      <div className="space-y-5 p-5">
        <div className={cn("flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors", link.phone ? "border-ok/30 bg-ok-soft" : "border-line bg-surface-2")} aria-live="polite">
          {link.phone ? <CheckCircle className="size-6 shrink-0 text-ok" weight="fill" /> : <DeviceMobile className="size-6 shrink-0 text-ink-3" />}
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-ink">
              {link.phone
                ? t("Phone connected — start scanning", "ফোন যুক্ত — স্ক্যান শুরু করুন")
                : link.status === "signedout"
                  ? t("You're signed out on this computer", "এই কম্পিউটারে লগইন নেই")
                  : link.status === "retrying"
                    ? t("Reconnecting to the server…", "সার্ভারে আবার যুক্ত হচ্ছে…")
                    : t("Waiting for your phone…", "ফোনের অপেক্ষায়…")}
            </p>
            <p className="text-xs text-ink-3">
              {link.status === "signedout" ? (
                <>
                  {t("The phone scanner needs your BechaKena account, and each web address signs in separately.", "ফোন স্ক্যানারের জন্য BechaKena অ্যাকাউন্ট লাগবে, আর প্রতিটি ওয়েব ঠিকানায় আলাদা লগইন হয়।")}{" "}
                  <Link href="/login" className="font-medium text-brand-ink underline-offset-2 hover:underline">
                    {t("Sign in", "লগইন করুন")}
                  </Link>
                </>
              ) : link.status === "retrying" ? (
                t("Check the internet connection — it keeps trying by itself.", "ইন্টারনেট দেখুন — নিজে থেকেই চেষ্টা করছে।")
              ) : (
                t("You can close this — the phone stays connected while BechaKena is open on this computer.", "এটি বন্ধ করতে পারেন — এই কম্পিউটারে BechaKena খোলা থাকলে ফোন যুক্ত থাকবে।")
              )}
            </p>
          </div>
          {stuck ? (
            <Button size="sm" onClick={retry}>
              {t("Try again", "আবার চেষ্টা")}
            </Button>
          ) : (
            !link.phone && <span className="size-2 shrink-0 animate-pulse rounded-full bg-warn" aria-hidden />
          )}
        </div>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="grid size-44 shrink-0 place-items-center rounded-lg border border-line bg-white p-3">
            {url && qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- a generated data: URL
              <img src={qr} alt={t("QR code for the phone scanner link", "ফোন স্ক্যানার লিংকের QR কোড")} className="size-full [image-rendering:pixelated]" />
            ) : stuck ? (
              <p className="px-2 text-center text-xs leading-relaxed text-ink-3">
                {link.status === "signedout"
                  ? t("The QR code appears once you're signed in on this address.", "এই ঠিকানায় লগইন করলে QR কোড দেখাবে।")
                  : t("The QR code appears once the server is reachable.", "সার্ভারে যুক্ত হলে QR কোড দেখাবে।")}
              </p>
            ) : (
              <div className="skeleton size-full rounded-sm" />
            )}
          </div>
          <ol className="space-y-2.5 text-[13.5px] text-ink-2">
            {[
              t("Open the camera on your phone and point it at this code.", "ফোনের ক্যামেরা খুলে এই কোডে ধরুন।"),
              t("Tap the link that pops up, then tap Start scanning.", "যে লিংক আসবে তাতে ট্যাপ করে স্ক্যান শুরু করুন।"),
              t("Scan barcodes — they arrive here, and the phone shows what happened.", "বারকোড স্ক্যান করুন — এখানে পৌঁছাবে, ফোনেও দেখাবে।"),
            ].map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="tnum grid size-5 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-3">{t("Or send this link to the phone", "অথবা এই লিংকটি ফোনে পাঠান")}</p>
          <div className="flex items-center gap-2">
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={t("Phone scanner link", "ফোন স্ক্যানার লিংক")} className="h-9 min-w-0 flex-1 truncate rounded-sm border border-line bg-surface-2 px-3 font-mono text-[12px] text-ink-2" />
            <Button size="sm" icon={<CopySimple className="size-4" />} onClick={copy} disabled={!url}>
              {t("Copy", "কপি")}
            </Button>
          </div>
          {insecure && (
            <p className="mt-2 rounded-sm border border-warn/25 bg-warn-soft px-3 py-2 text-xs text-warn">
              {t("This link isn't https, so the phone's browser won't open the camera. Open BechaKena on its https address (or start the dev server with npm run dev:https) and reopen this.", "লিংকটি https নয়, তাই ফোনের ব্রাউজার ক্যামেরা খুলবে না। BechaKena এর https ঠিকানায় খুলুন (অথবা npm run dev:https চালান), তারপর আবার খুলুন।")}
            </p>
          )}
          <p className="mt-2 text-xs text-ink-3">
            {t("Anyone with this link can add items to this counter's cart. Lost a phone?", "এই লিংক যার কাছে আছে সে এই কাউন্টারের কার্টে পণ্য যোগ করতে পারবে। ফোন হারিয়েছে?")}{" "}
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium text-brand-ink underline-offset-2 hover:underline"
              onClick={async () => {
                const ok = await link.reset();
                toast(ok ? { title: t("New link ready — the old one no longer works", "নতুন লিংক তৈরি — পুরনোটি আর চলবে না") } : { title: t("Couldn't make a new link. Try again.", "নতুন লিংক হয়নি। আবার চেষ্টা করুন।"), tone: "warn" });
              }}
            >
              <ArrowsClockwise className="size-3.5" />
              {t("Make a new link", "নতুন লিংক")}
            </button>
          </p>
        </div>

        {link.on && (
          <button type="button" onClick={link.disable} className="text-xs font-medium text-ink-3 underline-offset-2 hover:text-ink hover:underline">
            {t("Stop using a phone on this computer", "এই কম্পিউটারে ফোন স্ক্যানার বন্ধ করুন")}
          </button>
        )}
      </div>
    </Sheet>
  );
}

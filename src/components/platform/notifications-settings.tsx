"use client";

import { Bell, BellSlash, ChartLineUp, DeviceMobile, PaperPlaneTilt } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { Badge, Button, Segmented, Select, Switch } from "../ui/core";
import { useToast } from "../ui/overlays";
import { useFmt, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";

type Prefs = { dailySummary: boolean; summaryHour: number; via: "push" | "sms" | "both"; lang: "en" | "bn"; lowStockDigest: boolean; pushNewOrders: boolean; pushLowStock: boolean; pushCodOverdue: boolean };
type Device = { id: string; userAgent: string | null; createdAt: string; endpoint: string };

function keyToBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function deviceName(ua: string | null) {
  if (!ua) return "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Device";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}

function Row({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        {sub && <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Push on this device, what to be told about, and the daily summary (FR-NOT-02, FR-RPT-09). */
export function NotificationsSettings() {
  const t = useT();
  const f = useFmt();
  const toast = useToast();
  const account = useStore((s) => s.sync.mode === "account");
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [pushAvailable, setPushAvailable] = useState(false);
  const [thisEndpoint, setThisEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  const load = useCallback(
    () =>
      Promise.all([
        api<{ prefs: Prefs; devices: Device[]; pushAvailable: boolean }>("/api/push/prefs"),
        supported ? navigator.serviceWorker.getRegistration("/").then((reg) => reg?.pushManager.getSubscription() ?? null) : Promise.resolve(null),
      ]).then(([r, sub]) => {
        setPrefs(r.prefs);
        setDevices(r.devices);
        setPushAvailable(r.pushAvailable);
        setThisEndpoint(sub?.endpoint ?? null);
      }),
    [supported],
  );

  useEffect(() => {
    if (account) void load().catch(() => {});
  }, [account, load]);

  const save = async (patch: Partial<Prefs>) => {
    setPrefs((p) => (p ? { ...p, ...patch } : p));
    await api("/api/push/prefs", { method: "PUT", json: patch }).catch((e) => toast({ tone: "warn", title: (e as Error).message }));
  };

  const enable = async () => {
    setBusy(true);
    try {
      const { publicKey } = await api<{ publicKey: string | null }>("/api/push/key");
      if (!publicKey) throw new Error(t("Push isn't set up on this server yet.", "এই সার্ভারে পুশ এখনো চালু হয়নি।"));
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error(t("Notifications are blocked in this browser's settings.", "ব্রাউজারের সেটিংসে নোটিফিকেশন বন্ধ আছে।"));
      const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
      await api("/api/push/subscribe", { method: "POST", json: sub.toJSON() });
      toast({ title: t("Notifications on for this device", "এই ডিভাইসে নোটিফিকেশন চালু") });
      await load();
    } catch (e) {
      toast({ tone: "warn", title: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api("/api/push/subscribe", { method: "DELETE", json: { endpoint: sub.endpoint } });
      await sub.unsubscribe();
    }
    await load();
  };

  if (!account) return <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-3">{t("Sign in to your shop account to get notifications on your phone.", "ফোনে নোটিফিকেশন পেতে দোকানের অ্যাকাউন্টে সাইন ইন করুন।")}</p>;
  if (!prefs) return <div className="skeleton h-48 rounded-lg" />;
  const subscribedHere = !!thisEndpoint && devices.some((d) => d.endpoint === thisEndpoint);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-brand-50 text-brand-ink">{subscribedHere ? <Bell className="size-5" weight="fill" /> : <BellSlash className="size-5" />}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{subscribedHere ? t("This device gets notifications", "এই ডিভাইসে নোটিফিকেশন আসে") : t("Get notified on this device", "এই ডিভাইসে নোটিফিকেশন পান")}</p>
            <p className="text-[13px] text-ink-3">{supported ? t("New orders from staff, low stock and late COD — even when the app is closed.", "স্টাফের নতুন অর্ডার, স্টক কম আর দেরির COD — অ্যাপ বন্ধ থাকলেও।") : t("This browser can't receive push notifications. Install the app on Android Chrome.", "এই ব্রাউজারে পুশ আসে না। অ্যান্ড্রয়েড ক্রোমে অ্যাপ ইনস্টল করুন।")}</p>
          </div>
          {supported &&
            (subscribedHere ? (
              <div className="flex gap-2">
                <Button size="sm" icon={<PaperPlaneTilt className="size-4" />} onClick={() => api("/api/push/test", { method: "POST" }).then(() => toast({ title: t("Test sent", "টেস্ট পাঠানো হয়েছে") }), (e) => toast({ tone: "warn", title: (e as Error).message }))}>
                  {t("Send a test", "টেস্ট পাঠান")}
                </Button>
                <Button size="sm" variant="ghost" onClick={disable}>
                  {t("Turn off", "বন্ধ")}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="primary" loading={busy} disabled={!pushAvailable} onClick={enable}>
                {t("Turn on", "চালু করুন")}
              </Button>
            ))}
        </div>
        {!pushAvailable && <p className="mt-3 text-xs text-warn">{t("The server has no VAPID keys yet, so push can't be turned on.", "সার্ভারে VAPID কী নেই, তাই পুশ চালু করা যাচ্ছে না।")}</p>}
        {devices.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {devices.map((d) => (
              <li key={d.id}>
                <Badge>
                  <DeviceMobile className="size-3.5" />
                  {deviceName(d.userAgent)}
                  {d.endpoint === thisEndpoint && ` · ${t("this one", "এটি")}`}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-line px-4 py-1">
        <Row title={t("New orders from staff", "স্টাফের নতুন অর্ডার")}>
          <Switch checked={prefs.pushNewOrders} onChange={(v) => save({ pushNewOrders: v })} label={t("New orders", "নতুন অর্ডার")} />
        </Row>
        <Row title={t("Running low on stock", "স্টক কমে আসছে")}>
          <Switch checked={prefs.pushLowStock} onChange={(v) => save({ pushLowStock: v })} label={t("Low stock", "স্টক কম")} />
        </Row>
        <Row title={t("Courier cash overdue", "কুরিয়ারের টাকা দেরি")} sub={t("COD not paid out 5 days after delivery.", "ডেলিভারির ৫ দিন পরও COD আসেনি।")}>
          <Switch checked={prefs.pushCodOverdue} onChange={(v) => save({ pushCodOverdue: v })} label={t("COD overdue", "COD দেরি")} />
        </Row>
      </section>

      <section className="rounded-lg border border-line p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cash-soft text-cash-ink">
            <ChartLineUp className="size-5" weight="bold" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{t("Daily summary", "দৈনিক হিসাব")}</p>
              <Switch checked={prefs.dailySummary} onChange={(v) => save({ dailySummary: v })} label={t("Daily summary", "দৈনিক হিসাব")} />
            </div>
            <p className="mt-0.5 text-[13px] text-ink-3">{t("Sales, orders, profit, returns and cash with couriers — once a day.", "বিক্রি, অর্ডার, লাভ, ফেরত আর কুরিয়ারের টাকা — দিনে একবার।")}</p>
            {prefs.dailySummary && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-medium text-ink-3">
                  {t("Time", "সময়")}
                  <Select className="mt-1" inputSize="sm" value={prefs.summaryHour} onChange={(e) => save({ summaryHour: Number(e.target.value) })}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {f.time(new Date(2026, 0, 1, h))}
                      </option>
                    ))}
                  </Select>
                </label>
                <div className="text-xs font-medium text-ink-3">
                  {t("Send by", "যেভাবে পাঠাবে")}
                  <Segmented<Prefs["via"]>
                    size="sm"
                    className="mt-1 w-full"
                    value={prefs.via}
                    onChange={(v) => save({ via: v })}
                    options={[
                      { value: "push", label: t("Push", "পুশ") },
                      { value: "sms", label: "SMS" },
                      { value: "both", label: t("Both", "দুটো") },
                    ]}
                  />
                </div>
                <div className="text-xs font-medium text-ink-3">
                  {t("Language", "ভাষা")}
                  <Segmented<Prefs["lang"]> size="sm" className="mt-1 w-full" value={prefs.lang} onChange={(v) => save({ lang: v })} options={[{ value: "bn", label: "বাংলা" }, { value: "en", label: "English" }]} />
                </div>
                <label className="flex items-center justify-between gap-3 text-[13px] text-ink-2 sm:col-span-3">
                  {t("Include items running low", "স্টক কম পণ্যও জানাবে")}
                  <Switch size="sm" checked={prefs.lowStockDigest} onChange={(v) => save({ lowStockDigest: v })} label={t("Low stock digest", "স্টক কম তালিকা")} />
                </label>
              </div>
            )}
          </div>
        </div>
        {prefs.dailySummary && (
          <pre className="mt-4 whitespace-pre-wrap rounded-md bg-surface-2 px-3.5 py-3 font-sans text-[13px] leading-relaxed text-ink-2">
            {prefs.lang === "bn"
              ? "রংধনু বুটিক — আজকের হিসাব\nবিক্রি ৳২৪,৬৮০ · ১১টি অর্ডার\nমোট লাভ ৳৯,২১০\nকুরিয়ারের কাছে ৳৪৫,১৩০\nস্টক কম: জামদানি লাল (০), হিজাব বেইজ (৩)"
              : "Rongdhonu Boutique — today\nSales ৳24,680 · 11 orders\nGross profit ৳9,210\nWith couriers ৳45,130\nLow stock: Jamdani Red (0), Hijab Beige (3)"}
          </pre>
        )}
      </section>
    </div>
  );
}

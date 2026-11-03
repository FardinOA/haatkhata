"use client";

import { CheckCircle, Copy, Crown, Truck, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, cn } from "../ui/core";
import { Sheet, useToast } from "../ui/overlays";
import { api, loadPrefs } from "./client";
import { codFor, PROVIDERS, sandboxBook, scoreCouriers, type CourierScore } from "./courier-meta";
import { useCan, useFmt, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { syncNow } from "@/lib/sync";
import type { CourierProvider, Order } from "@/lib/types";

type Result = { orderId: string; ok: boolean; no?: number; consignmentId?: string; trackingCode?: string; fee?: number; error?: string };

/** Book one or many orders with a courier; they move to Shipped with tracking. */
export function BookCourierSheet({ open, onClose, orderIds }: { open: boolean; onClose: () => void; orderIds: string[] }) {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const toast = useToast();
  const mode = useStore((s) => s.sync.mode);
  const allOrders = useStore((s) => s.orders);
  const transition = useStore((s) => s.transition);
  const [accountCouriers, setAccountCouriers] = useState<CourierProvider[] | null>(null);
  const [network, setNetwork] = useState<{ courier: string; delivered: number; returned: number; avgFee: number | null }[]>([]);
  const [pick, setPick] = useState<CourierProvider | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  const orders = useMemo(() => orderIds.map((id) => allOrders.find((o) => o.id === id)).filter((o): o is Order => !!o), [orderIds, allOrders]);
  const { bookable, skipped, district } = useMemo(() => {
    const ok = orders.filter((o) => (o.status === "confirmed" || o.status === "packed") && !o.courier?.consignmentId && o.customer?.address?.line);
    const counts = new Map<string, number>();
    for (const o of ok) counts.set(o.customer!.address!.district, (counts.get(o.customer!.address!.district) ?? 0) + 1);
    return { bookable: ok, skipped: orders.filter((o) => !ok.includes(o)), district: [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Dhaka" };
  }, [orders]);

  useEffect(() => {
    if (!open || mode !== "account") return;
    let live = true;
    Promise.all([api<{ sandboxAllowed: boolean; accounts: { provider: CourierProvider; status: string }[] }>("/api/couriers/accounts"), loadPrefs(), api<{ couriers: typeof network }>(`/api/couriers/insights?district=${encodeURIComponent(district)}`).catch(() => ({ couriers: [] }))])
      .then(([acc, prefs, ins]) => {
        if (!live) return;
        const list = acc.accounts.filter((a) => a.status === "connected").map((a) => a.provider);
        if (acc.sandboxAllowed && !list.includes("sandbox")) list.push("sandbox");
        setAccountCouriers(list);
        setNetwork(ins.couriers);
        setPick((cur) => cur ?? (prefs.defaultProvider && list.includes(prefs.defaultProvider as CourierProvider) ? (prefs.defaultProvider as CourierProvider) : null));
      })
      .catch(() => live && setAccountCouriers([]));
    return () => {
      live = false;
    };
  }, [open, mode, district]);

  // Demo mode only has the test courier, which books on this device.
  const connected = useMemo<CourierProvider[] | null>(() => (mode === "account" ? accountCouriers : ["sandbox"]), [mode, accountCouriers]);
  const close = () => {
    setResults(null);
    onClose();
  };

  const scores: CourierScore[] = useMemo(() => (connected ? scoreCouriers(allOrders, district, connected.filter((p) => p !== "sandbox"), network).concat(connected.includes("sandbox") ? scoreCouriers([], district, ["sandbox"]) : []) : []), [connected, allOrders, district, network]);
  const best = scores.find((s) => s.successRate !== null)?.provider;
  const chosen = pick ?? best ?? scores[0]?.provider ?? null;
  const totalCod = bookable.reduce((s, o) => s + codFor(o), 0);

  const book = async () => {
    if (!chosen || !bookable.length) return;
    setBusy(true);
    try {
      if (mode !== "account") {
        // Demo: the test courier books on this device.
        const out: Result[] = bookable.map((o) => {
          const b = sandboxBook(o.id, codFor(o), o.customer!.address!.district);
          const ok = transition(o.id, "shipped", { courier: { name: PROVIDERS.sandbox.name, tracking: b.trackingCode, fee: b.fee, provider: "sandbox", consignmentId: b.consignmentId } });
          return { orderId: o.id, no: o.no, ok, consignmentId: b.consignmentId, trackingCode: b.trackingCode, fee: b.fee, error: ok ? undefined : t("Couldn't ship this order", "অর্ডারটি পাঠানো যায়নি") };
        });
        setResults(out);
      } else {
        const r = await api<{ results: Result[] }>("/api/couriers/book", { method: "POST", json: { orderIds: bookable.map((o) => o.id), provider: chosen } });
        setResults(r.results);
        await syncNow();
      }
    } catch (e) {
      toast({ tone: "warn", title: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const okCount = results?.filter((r) => r.ok).length ?? 0;

  return (
    <Sheet
      open={open}
      onClose={close}
      width={540}
      title={results ? t(`${okCount} of ${results.length} booked`, `${f.num(results.length)}টির মধ্যে ${f.num(okCount)}টি বুক হয়েছে`) : bookable.length === 1 ? t(`Book #${bookable[0].no} with a courier`, `#${f.num(bookable[0].no)} কুরিয়ারে বুক করুন`) : t(`Book ${bookable.length} parcels`, `${f.num(bookable.length)}টি পার্সেল বুক করুন`)}
      sub={results ? t("Orders are now Shipped with tracking codes.", "অর্ডারগুলো এখন ট্র্যাকিং কোডসহ পাঠানো হয়েছে।") : t(`Ranked by delivery success in ${district}`, `${district}-এ ডেলিভারি সফলতা অনুযায়ী`)}
      footer={
        results ? (
          <Button variant="primary" className="ml-auto" onClick={close}>
            {t("Done", "সম্পন্ন")}
          </Button>
        ) : (
          <>
            <p className="tnum mr-auto text-[13px] text-ink-3">
              {t("COD to collect", "আদায় করতে হবে")} <b className="font-semibold text-cash-ink">{f.money(totalCod)}</b>
            </p>
            <Button variant="ghost" onClick={close}>
              {t("Cancel", "বাতিল")}
            </Button>
            <Button variant="primary" loading={busy} disabled={!chosen || !bookable.length || !can("pack_ship")} icon={<Truck className="size-4" />} onClick={book}>
              {bookable.length > 1 ? t(`Book ${bookable.length} parcels`, `${f.num(bookable.length)}টি বুক করুন`) : t("Book parcel", "পার্সেল বুক করুন")}
            </Button>
          </>
        )
      }
    >
      {results ? (
        <ul className="divide-y divide-line">
          {results.map((r) => (
            <li key={r.orderId} className="flex items-center gap-3 px-5 py-3">
              {r.ok ? <CheckCircle className="size-5 shrink-0 text-ok" weight="fill" /> : <WarningCircle className="size-5 shrink-0 text-danger" weight="fill" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">#{f.digits(String(r.no ?? ""))}</p>
                <p className={cn("truncate text-[13px]", r.ok ? "text-ink-3" : "text-danger")}>{r.ok ? `${t("Tracking", "ট্র্যাকিং")} ${r.trackingCode}${r.fee ? ` · ${t("fee", "চার্জ")} ${f.money(r.fee)}` : ""}` : r.error}</p>
              </div>
              {r.ok && r.trackingCode && (
                <button type="button" className="grid size-8 place-items-center rounded-sm text-ink-3 hover:bg-sunken" aria-label={t("Copy tracking code", "ট্র্যাকিং কোড কপি")} onClick={() => navigator.clipboard?.writeText(r.trackingCode!)}>
                  <Copy className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-5 p-5">
          {connected && connected.length === 0 ? (
            <div className="rounded-md border border-dashed border-line-strong p-5 text-center">
              <p className="text-sm font-medium text-ink">{t("No courier connected yet", "এখনো কোনো কুরিয়ার যুক্ত নেই")}</p>
              <p className="mt-1 text-[13px] text-ink-3">{t("Connect Steadfast, Pathao or RedX once, then book in one tap.", "একবার স্টেডফাস্ট, পাঠাও বা রেডএক্স যুক্ত করুন, তারপর এক ট্যাপে বুক করুন।")}</p>
              <Link href="/settings?tab=couriers" className="mt-3 inline-block text-[13px] font-semibold text-brand-ink hover:underline">
                {t("Connect a courier", "কুরিয়ার যুক্ত করুন")}
              </Link>
            </div>
          ) : (
            <div role="radiogroup" aria-label={t("Courier", "কুরিয়ার")} className="space-y-2">
              {(connected === null ? [] : scores).map((s) => {
                const on = chosen === s.provider;
                const meta = PROVIDERS[s.provider];
                return (
                  <button
                    key={s.provider}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setPick(s.provider)}
                    className={cn("flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all", on ? "border-brand bg-brand-50/60 shadow-[var(--ring)]" : "border-line bg-surface hover:border-line-strong")}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-md text-[13px] font-bold text-white" style={{ background: meta.color }}>
                      {meta.name.slice(0, 2)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{meta.name}</span>
                        {s.provider === best && (
                          <Badge tone="brand">
                            <Crown className="size-3" weight="fill" />
                            {t("Best here", "এখানে সেরা")}
                          </Badge>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-3">
                        {s.successRate === null
                          ? s.provider === "sandbox"
                            ? t("Simulated booking for testing", "পরীক্ষার জন্য নকল বুকিং")
                            : t("Not enough deliveries here yet to compare", "তুলনার মতো যথেষ্ট ডেলিভারি নেই")
                          : t.lang === "bn"
                            ? `${f.pct(s.successRate)} সফল · ${f.num(s.delivered + s.returned)}টি পার্সেল${s.source === "network" ? " (সব দোকান)" : ""}`
                            : `${f.pct(s.successRate)} delivered · ${f.num(s.delivered + s.returned)} parcels${s.source === "network" ? " across shops" : " of yours"}`}
                      </span>
                    </span>
                    {s.successRate !== null && (
                      <span className="hidden w-20 shrink-0 sm:block" aria-hidden>
                        <span className="block h-1.5 overflow-hidden rounded-full bg-sunken">
                          <span className="block h-full rounded-full bg-ok" style={{ width: `${s.successRate * 100}%` }} />
                        </span>
                      </span>
                    )}
                    <span className="tnum w-14 shrink-0 text-right text-[13px] font-semibold text-ink-2">{s.avgFee ? f.money(s.avgFee) : "—"}</span>
                  </button>
                );
              })}
              {connected === null && <div className="skeleton h-16 rounded-lg" />}
            </div>
          )}

          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-2">{t("Parcels", "পার্সেল")}</p>
            <ul className="divide-y divide-line rounded-md border border-line">
              {bookable.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                  <span className="tnum font-semibold text-ink">#{f.digits(String(o.no))}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-2">
                    {o.customer?.name} · {o.customer?.address?.area}, {o.customer?.address?.district}
                  </span>
                  <span className="tnum shrink-0 font-medium text-cash-ink">{f.money(codFor(o))}</span>
                </li>
              ))}
              {skipped.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px] text-ink-3">
                  <span className="tnum font-semibold">#{f.digits(String(o.no))}</span>
                  <span className="flex-1 truncate">{o.courier?.consignmentId ? t("Already booked", "আগেই বুক হয়েছে") : !o.customer?.address?.line ? t("No delivery address", "ঠিকানা নেই") : t("Not confirmed or packed", "নিশ্চিত বা প্যাক হয়নি")}</span>
                  <Badge>{t("Skipped", "বাদ")}</Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Sheet>
  );
}

"use client";

import { ArrowsClockwise, Copy, LinkSimple, Truck } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button, cn } from "../ui/core";
import { useToast } from "../ui/overlays";
import { BookCourierSheet } from "./book-courier";
import { api } from "./client";
import { PROVIDERS, providerFromName, sandboxStatus, STATUS_TEXT, type CourierStatus } from "./courier-meta";
import { PaymentLinkSheet } from "./payment-link";
import { orderTotals } from "@/lib/domain";
import { useCan, useFmt, useNow, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { syncNow } from "@/lib/sync";
import type { Order } from "@/lib/types";

/** Order-sheet actions: book with a courier, ask the buyer to pay online. */
export function CourierActions({ order }: { order: Order }) {
  const t = useT();
  const can = useCan();
  const [sheet, setSheet] = useState<"book" | "pay" | null>(null);
  const canBook = (order.status === "confirmed" || order.status === "packed") && !order.courier?.consignmentId && can("pack_ship") && !!order.customer?.address?.line;
  const canAsk = orderTotals(order).remaining > 0 && order.customer && !["cancelled", "returned", "delivered", "partially_returned"].includes(order.status);
  if (!canBook && !canAsk) return null;
  return (
    <>
      {canBook && (
        <Button variant="soft" icon={<Truck className="size-4" />} onClick={() => setSheet("book")}>
          {t("Book courier", "কুরিয়ার বুক")}
        </Button>
      )}
      {canAsk && (
        <Button variant="ghost" icon={<LinkSimple className="size-4" />} onClick={() => setSheet("pay")}>
          {t("Ask to pay online", "অনলাইনে পেমেন্ট চান")}
        </Button>
      )}
      <BookCourierSheet open={sheet === "book"} onClose={() => setSheet(null)} orderIds={[order.id]} />
      <PaymentLinkSheet open={sheet === "pay"} onClose={() => setSheet(null)} order={order} />
    </>
  );
}

type Consignment = { id: string; provider: string; consignmentId: string; trackingCode: string | null; status: CourierStatus; rawStatus: string | null; history: { at: string; status: CourierStatus; raw?: string }[] };

const TONE: Record<CourierStatus, string> = { booked: "var(--color-st-confirmed)", in_transit: "var(--color-st-shipped)", hold: "var(--color-warn)", delivered: "var(--color-st-delivered)", partial: "var(--color-warn)", returned: "var(--color-st-returned)", cancelled: "var(--ink-4)" };

/** Live courier status for a booked parcel. */
export function CourierTracking({ order }: { order: Order }) {
  const t = useT();
  const f = useFmt();
  const toast = useToast();
  const nowMs = useNow(30_000);
  const mode = useStore((s) => s.sync.mode);
  const [rows, setRows] = useState<Consignment[]>([]);
  const [busy, setBusy] = useState(false);
  const c = order.courier;

  useEffect(() => {
    if (mode !== "account" || !c?.consignmentId) return;
    let live = true;
    api<{ consignments: Consignment[] }>(`/api/couriers/consignments?orderId=${order.id}`)
      .then((r) => live && setRows(r.consignments))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [mode, order.id, c?.consignmentId, order.status]);

  if (!c?.consignmentId) return null;
  const provider = c.provider ?? providerFromName(c.name) ?? "sandbox";
  const row = rows[0];
  // Demo mode: the test courier's status is computed from the booking time.
  const status: CourierStatus = row?.status ?? (provider === "sandbox" ? sandboxStatus(c.consignmentId, nowMs) : "in_transit");
  const history = row?.history ?? [];

  const refresh = async () => {
    setBusy(true);
    try {
      const r = await api<{ changed: number }>("/api/couriers/sync", { method: "POST" });
      await syncNow();
      const fresh = await api<{ consignments: Consignment[] }>(`/api/couriers/consignments?orderId=${order.id}`);
      setRows(fresh.consignments);
      toast({ title: r.changed ? t("Courier status updated", "কুরিয়ারের অবস্থা আপডেট হয়েছে") : t("No change from the courier yet", "কুরিয়ার থেকে নতুন কিছু নেই") });
    } catch (e) {
      toast({ tone: "warn", title: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-line bg-surface-2 p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md text-xs font-bold text-white" style={{ background: PROVIDERS[provider].color }}>
          {PROVIDERS[provider].name.slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            {PROVIDERS[provider].name}
            <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: TONE[status] }}>
              <span className="size-1.5 rounded-full bg-current" />
              {t.pick(STATUS_TEXT[status])}
            </span>
          </p>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(c.tracking ?? c.consignmentId!)} className="tnum mt-0.5 inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
            {c.tracking ?? c.consignmentId}
            <Copy className="size-3" />
          </button>
        </div>
        {mode === "account" && (
          <Button size="sm" variant="ghost" loading={busy} icon={<ArrowsClockwise className="size-4" />} onClick={refresh}>
            {t("Check", "দেখুন")}
          </Button>
        )}
      </div>
      {history.length > 1 && (
        <ol className="mt-3 space-y-1.5 border-t border-line pt-3">
          {[...history].reverse().map((h, i) => (
            <li key={`${h.at}${i}`} className="flex items-center gap-2 text-xs">
              <span className={cn("size-1.5 shrink-0 rounded-full")} style={{ background: TONE[h.status] }} />
              <span className="font-medium text-ink-2">{t.pick(STATUS_TEXT[h.status])}</span>
              {h.raw && !h.raw.startsWith("sandbox") && <span className="truncate text-ink-4">“{h.raw}”</span>}
              <span className="ml-auto shrink-0 text-ink-4">{f.relative(h.at, nowMs)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

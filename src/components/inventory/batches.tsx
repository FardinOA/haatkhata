"use client";

import { CalendarX, Hourglass } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ProductThumb } from "../bits";
import { Badge, cn, EmptyState, Panel, PanelHeader, Segmented } from "../ui/core";
import { useFmt, useNow, useT } from "@/lib/hooks";
import { expiringSoon } from "@/lib/stock-ops";
import { useStore } from "@/lib/store";

/** Expiry tab (FR-STK-12): batches by expiry, sold first-expiry-first-out. */
export function Batches() {
  const t = useT();
  const f = useFmt();
  const nowMs = useNow(3_600_000);
  const products = useStore((s) => s.products);
  const [within, setWithin] = useState<"30" | "60" | "90">("30");
  const soon = useMemo(() => expiringSoon(products, Number(within), new Date(nowMs)), [products, within, nowMs]);
  const tracked = products.filter((p) => p.trackBatches);
  const today = new Date(nowMs);
  const daysLeft = (iso: string) => Math.ceil((new Date(`${iso}T23:59:59`).getTime() - today.getTime()) / 86_400_000);

  if (!tracked.length)
    return (
      <Panel>
        <EmptyState
          icon={<Hourglass />}
          title={t("No products track expiry yet", "কোনো পণ্যে মেয়াদ ট্র্যাক হচ্ছে না")}
          body={t("For cosmetics, food or medicine, turn on “Track batches & expiry” in the product. We'll then sell the oldest batch first and warn you before anything expires.", "কসমেটিকস, খাবার বা ওষুধের জন্য পণ্যে “ব্যাচ ও মেয়াদ ট্র্যাক” চালু করুন। তখন পুরোনো ব্যাচ আগে বিক্রি হবে আর মেয়াদ শেষের আগে জানাব।")}
        />
      </Panel>
    );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel className="overflow-hidden">
        <PanelHeader
          title={t("Expiring soon", "শীঘ্রই মেয়াদ শেষ")}
          sub={t("Sell or discount these first.", "এগুলো আগে বিক্রি বা ছাড় দিন।")}
          action={
            <Segmented<"30" | "60" | "90">
              size="sm"
              value={within}
              onChange={setWithin}
              options={[
                { value: "30", label: t("30 days", "৩০ দিন") },
                { value: "60", label: t("60 days", "৬০ দিন") },
                { value: "90", label: t("90 days", "৯০ দিন") },
              ]}
            />
          }
        />
        {soon.length ? (
          <ul className="mt-3 divide-y divide-line">
            {soon.map(({ p, v, b, expired }) => {
              const d = daysLeft(b.expiry!);
              return (
                <li key={b.id} className="flex items-center gap-3 px-5 py-3">
                  <ProductThumb product={p} size={38} rounded="sm" />
                  <Link href={`/products/${p.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink">{t.lang === "bn" ? p.nameBn || p.name : p.name}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {t("Batch", "ব্যাচ")} {b.code} · {Object.values(v.options).join(" / ") || v.sku}
                    </span>
                  </Link>
                  <span className="text-right">
                    <span className="tnum block text-sm font-semibold text-ink">{t(`${b.qty} left`, `${f.num(b.qty)}টি`)}</span>
                    <Badge tone={expired ? "danger" : d <= 14 ? "warn" : "neutral"} className="mt-0.5">
                      {expired ? t("Expired", "মেয়াদ শেষ") : t(`${d} days`, `${f.num(d)} দিন`)}
                    </Badge>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<CalendarX />} title={t("Nothing expires in this window", "এই সময়ে কিছুর মেয়াদ শেষ হচ্ছে না")} />
        )}
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader title={t("All batches", "সব ব্যাচ")} sub={t("In the order they'll be sold.", "যে ক্রমে বিক্রি হবে।")} />
        <div className="mt-3 divide-y divide-line">
          {tracked.map((p) =>
            p.variants.map((v) => {
              const batches = [...(v.batches ?? [])].sort((a, b) => (a.expiry ?? "9").localeCompare(b.expiry ?? "9"));
              const inBatches = batches.reduce((s, b) => s + b.qty, 0);
              return (
                <div key={v.id} className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <ProductThumb product={p} size={32} rounded="sm" />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
                      {t.lang === "bn" ? p.nameBn || p.name : p.name}
                      {Object.values(v.options).length > 0 && <span className="font-normal text-ink-3"> · {Object.values(v.options).join(" / ")}</span>}
                    </span>
                    <span className="tnum text-xs text-ink-3">{t(`${v.onHand} on hand`, `হাতে ${f.num(v.onHand)}টি`)}</span>
                  </div>
                  <ol className="mt-2.5 flex flex-wrap gap-1.5 pl-11">
                    {batches.map((b, i) => {
                      const d = b.expiry ? daysLeft(b.expiry) : null;
                      return (
                        <li key={b.id} className={cn("rounded-md border px-2.5 py-1.5 text-xs", i === 0 ? "border-brand-200 bg-brand-50" : "border-line bg-surface-2")}>
                          <span className="font-semibold text-ink">{b.code}</span>
                          <span className="tnum ml-1.5 text-ink-2">× {f.num(b.qty)}</span>
                          <span className={cn("tnum ml-1.5", d !== null && d < 0 ? "text-danger" : d !== null && d <= 30 ? "text-warn" : "text-ink-3")}>{b.expiry ? f.date(b.expiry) : t("no expiry", "মেয়াদ নেই")}</span>
                          {i === 0 && <span className="ml-1.5 font-medium text-brand-ink">{t("sells next", "পরেরটি")}</span>}
                        </li>
                      );
                    })}
                    {inBatches < v.onHand && <li className="rounded-md border border-dashed border-line-strong px-2.5 py-1.5 text-xs text-ink-3">{t(`${v.onHand - inBatches} without a batch`, `${f.num(v.onHand - inBatches)}টি ব্যাচ ছাড়া`)}</li>}
                    {!batches.length && inBatches >= v.onHand && <li className="text-xs text-ink-4">{t("No batches yet — add one on your next stock in.", "এখনো ব্যাচ নেই — পরের স্টক ইনে যোগ করুন।")}</li>}
                  </ol>
                </div>
              );
            }),
          )}
        </div>
      </Panel>
    </div>
  );
}

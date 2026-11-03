"use client";

import { DownloadSimple, MagnifyingGlass, Scroll, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ProductThumb } from "../bits";
import { downloadText, toCSV } from "../products/utils";
import { Badge, Button, cn, EmptyState, IconButton, Input, Panel, Segmented, Select, type Tone } from "../ui/core";
import { useDebounced, useFmt, useT } from "@/lib/hooks";
import { daysAgo, sameDay } from "@/lib/format";
import { REASON_LABEL } from "@/lib/labels";
import { useStore } from "@/lib/store";
import type { MovementReason } from "@/lib/types";

const PAGE = 40;
const REASON_TONE: Record<MovementReason, Tone> = { opening: "neutral", purchase: "brand", sale: "info", return: "ok", adjust: "warn", damage: "danger", transfer: "neutral" };

export function Ledger({ productId, onClearProduct }: { productId?: string; onClearProduct: () => void }) {
  const t = useT();
  const f = useFmt();
  const products = useStore((s) => s.products);
  const movements = useStore((s) => s.movements);
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 120);
  const [reason, setReason] = useState<MovementReason | "all">("all");
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("30d");
  const [limit, setLimit] = useState(PAGE);

  const index = useMemo(() => {
    const m = new Map<string, { name: string; nameBn?: string; label: string; sku: string; product: (typeof products)[number] }>();
    for (const p of products) for (const v of p.variants) m.set(v.id, { name: p.name, nameBn: p.nameBn, label: Object.values(v.options).join(" / "), sku: v.sku, product: p });
    return m;
  }, [products]);

  const rows = useMemo(() => {
    const from = period === "all" ? null : daysAgo(period === "7d" ? 6 : 29);
    const needle = dq.trim().toLowerCase();
    return movements
      .filter((m) => {
        if (productId && m.productId !== productId) return false;
        if (reason !== "all" && m.reason !== reason) return false;
        if (from && new Date(m.at) < from) return false;
        if (!needle) return true;
        const i = index.get(m.variantId);
        return `${i?.name ?? ""} ${i?.nameBn ?? ""} ${i?.sku ?? ""} ${i?.label ?? ""} ${m.refLabel ?? ""} ${m.by}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [movements, productId, reason, period, dq, index]);

  const inUnits = rows.filter((m) => m.delta > 0).reduce((s, m) => s + m.delta, 0);
  const outUnits = rows.filter((m) => m.delta < 0).reduce((s, m) => s - m.delta, 0);
  const shown = rows.slice(0, limit);
  // Day headers make a long ledger scannable.
  const isNewDay = (i: number) => i === 0 || !sameDay(new Date(shown[i - 1].at), new Date(shown[i].at));
  const filteredProduct = productId ? products.find((p) => p.id === productId) : undefined;

  const exportCsv = () =>
    downloadText(
      `stock-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV([
        ["time", "product", "variant", "sku", "reason", "change", "balance", "reference", "by", "note"],
        ...rows.map((m) => {
          const i = index.get(m.variantId);
          return [m.at, i?.name ?? "", i?.label ?? "", i?.sku ?? "", REASON_LABEL[m.reason][0], m.delta, m.balance, m.refLabel ?? "", m.by, m.note ?? ""];
        }),
      ]),
    );


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="min-w-0 flex-1 basis-60"
          leading={<MagnifyingGlass className="size-4" />}
          placeholder={t("Product, SKU, order or person", "পণ্য, SKU, অর্ডার বা ব্যক্তি")}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(PAGE);
          }}
          aria-label={t("Search the ledger", "লেজারে খুঁজুন")}
        />
        <Select className="w-44" value={reason} onChange={(e) => {
            setReason(e.target.value as MovementReason | "all");
            setLimit(PAGE);
          }} aria-label={t("Reason", "কারণ")}>
          <option value="all">{t("All reasons", "সব কারণ")}</option>
          {(Object.keys(REASON_LABEL) as MovementReason[]).map((r) => (
            <option key={r} value={r}>
              {t.pick(REASON_LABEL[r])}
            </option>
          ))}
        </Select>
        <Segmented
          value={period}
          onChange={(p) => {
            setPeriod(p);
            setLimit(PAGE);
          }}
          ariaLabel={t("Period", "সময়")}
          options={[
            { value: "7d", label: t("7 days", "৭ দিন") },
            { value: "30d", label: t("30 days", "৩০ দিন") },
            { value: "all", label: t("All", "সব") },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
        {filteredProduct && (
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-1.5">
            <ProductThumb product={filteredProduct} size={22} rounded="full" />
            <span className="font-medium text-ink">{t.lang === "bn" ? filteredProduct.nameBn || filteredProduct.name : filteredProduct.name}</span>
            <IconButton label={t("Show all products", "সব পণ্য দেখুন")} size="sm" className="size-6" onClick={onClearProduct}>
              <X className="size-3.5" />
            </IconButton>
          </span>
        )}
        <span className="tnum text-ink-3">
          {t(`${f.num(rows.length)} movements`, `${f.num(rows.length)}টি পরিবর্তন`)} · <span className="font-medium text-ok">+{f.num(inUnits)} {t("in", "ঢুকেছে")}</span> · <span className="font-medium text-danger">−{f.num(outUnits)} {t("out", "বেরিয়েছে")}</span>
        </span>
        {rows.length > 0 && (
          <Button size="sm" variant="ghost" className="ml-auto" icon={<DownloadSimple className="size-4" />} onClick={exportCsv}>
            CSV
          </Button>
        )}
      </div>

      <Panel className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={<Scroll />} title={t("No stock movements here", "এখানে কোনো স্টক পরিবর্তন নেই")} body={t("Try a longer period or clear the search.", "বেশি সময় বাছুন বা খোঁজা মুছুন।")} />
        ) : (
          <>
            <div className="hidden grid-cols-[72px_minmax(0,2fr)_120px_minmax(0,1fr)_72px_72px_minmax(0,1fr)] gap-4 border-b border-line bg-surface-2 px-5 py-2.5 text-xs font-medium text-ink-3 md:grid">
              <span>{t("Time", "সময়")}</span>
              <span>{t("Item", "পণ্য")}</span>
              <span>{t("Reason", "কারণ")}</span>
              <span>{t("Reference", "রেফারেন্স")}</span>
              <span className="text-right">{t("Change", "পরিবর্তন")}</span>
              <span className="text-right">{t("Balance", "ব্যালেন্স")}</span>
              <span>{t("By", "যিনি")}</span>
            </div>
            <ul>
              {shown.map((m, n) => {
                const i = index.get(m.variantId);
                const d = new Date(m.at);
                const header = isNewDay(n);
                const ref = m.refId?.startsWith("o_") ? (
                  <Link href={`/orders?id=${m.refId}`} className="font-medium text-brand-ink hover:underline">
                    {m.refLabel}
                  </Link>
                ) : (
                  <span className="text-ink-2">{m.refLabel ?? "—"}</span>
                );
                return (
                  <li key={m.id}>
                    {header && <p className="border-b border-line bg-surface-2/70 px-5 py-1.5 text-xs font-medium text-ink-3">{sameDay(d, new Date()) ? t("Today", "আজ") : f.dateShort(d)}</p>}
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-line px-5 py-3 text-[13px] last:border-0 md:grid-cols-[72px_minmax(0,2fr)_120px_minmax(0,1fr)_72px_72px_minmax(0,1fr)] md:items-center md:gap-4">
                      <span className="tnum hidden text-ink-3 md:block">{f.time(d)}</span>
                      <span className="flex min-w-0 items-center gap-2.5">
                        {i && <ProductThumb product={i.product} size={28} rounded="sm" />}
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">{i ? (t.lang === "bn" ? i.nameBn || i.name : i.name) : t("Deleted product", "মুছে ফেলা পণ্য")}</span>
                          <span className="block truncate text-xs text-ink-3">
                            {i?.label || i?.sku}
                            <span className="md:hidden">
                              {" "}
                              · {f.time(d)}
                            </span>
                          </span>
                        </span>
                      </span>
                      <span className="flex flex-col items-end md:hidden">
                        <span className={cn("tnum text-sm font-semibold", m.delta > 0 ? "text-ok" : "text-danger")}>
                          {m.delta > 0 ? "+" : "−"}
                          {f.num(Math.abs(m.delta))}
                        </span>
                        <span className="tnum text-xs text-ink-3">= {f.num(m.balance)}</span>
                      </span>
                      <span className="col-span-2 flex flex-wrap items-center gap-2 md:contents">
                        <span>
                          <Badge tone={REASON_TONE[m.reason]}>{t.pick(REASON_LABEL[m.reason])}</Badge>
                        </span>
                        <span className="min-w-0 truncate" title={m.note}>
                          {ref}
                          {m.note && <span className="block truncate text-xs text-ink-3">{m.note}</span>}
                        </span>
                        <span className={cn("tnum hidden text-right text-sm font-semibold md:block", m.delta > 0 ? "text-ok" : "text-danger")}>
                          {m.delta > 0 ? "+" : "−"}
                          {f.num(Math.abs(m.delta))}
                        </span>
                        <span className="tnum hidden text-right text-ink-2 md:block">{f.num(m.balance)}</span>
                        <span className="truncate text-xs text-ink-3 md:text-[13px]">{m.by}</span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            {rows.length > limit && (
              <div className="flex items-center justify-center gap-3 border-t border-line bg-surface-2 px-5 py-3">
                <span className="tnum text-xs text-ink-3">{t(`Showing ${shown.length} of ${rows.length}`, `${f.num(rows.length)}টির মধ্যে ${f.num(shown.length)}টি`)}</span>
                <Button size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                  {t("Show more", "আরও দেখুন")}
                </Button>
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

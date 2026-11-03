"use client";

import { ClipboardText, MagnifyingGlass } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { ProductThumb } from "../bits";
import { Button, cn, EmptyState, Input, Panel, Segmented, Select } from "../ui/core";
import { useConfirm, useToast } from "../ui/overlays";
import { useCan, useDebounced, useFmt, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";

/** Count many SKUs, review the differences, then post them all at once (SRS FR-STK-09). */
export function StockTake() {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const toast = useToast();
  const [confirm, confirmNode] = useConfirm();
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const adjustStock = useStore((s) => s.adjustStock);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 120);
  const [show, setShow] = useState<"all" | "diff">("all");
  const [counts, setCounts] = useState<Record<string, string>>({});

  const rows = useMemo(
    () =>
      products
        .filter((p) => p.status === "active" && (cat === "all" || p.categoryId === cat))
        .flatMap((p) => p.variants.filter((v) => v.active).map((v) => ({ p, v })))
        .filter(({ p, v }) => {
          const n = dq.trim().toLowerCase();
          return !n || `${p.name} ${p.nameBn ?? ""} ${v.sku} ${Object.values(v.options).join(" ")}`.toLowerCase().includes(n);
        }),
    [products, cat, dq],
  );

  const all = useMemo(() => products.flatMap((p) => p.variants.map((v) => ({ p, v }))), [products]);
  const entered = all.filter(({ v }) => counts[v.id] !== undefined && counts[v.id] !== "");
  const diffs = entered.map(({ p, v }) => ({ p, v, counted: parseInt(counts[v.id], 10), delta: parseInt(counts[v.id], 10) - v.onHand })).filter((d) => d.delta !== 0);
  const net = diffs.reduce((s, d) => s + d.delta, 0);
  const visible = show === "diff" ? rows.filter(({ v }) => diffs.some((d) => d.v.id === v.id)) : rows;

  if (!can("edit_stock"))
    return (
      <Panel>
        <EmptyState icon={<ClipboardText />} title={t("Your role can't post a stock count", "আপনার ভূমিকায় স্টক গণনা পোস্ট করা যায় না")} body={t("Ask an owner or manager to run the count.", "মালিক বা ম্যানেজারকে বলুন।")} />
      </Panel>
    );

  const post = async () => {
    if (!diffs.length) return;
    const ok = await confirm({
      title: t(`Post ${diffs.length} adjustments?`, `${f.num(diffs.length)}টি সমন্বয় পোস্ট করবেন?`),
      body: t(`On-hand stock changes by ${net > 0 ? "+" : ""}${net} units in total. Each change is saved in the ledger as “Stock take”.`, `মোট ${net > 0 ? "+" : ""}${f.num(net)}টি বদলাবে। প্রতিটি লেজারে “স্টক গণনা” হিসেবে থাকবে।`),
      confirm: t("Post adjustments", "পোস্ট করুন"),
      cancel: t("Keep counting", "গণনা চালিয়ে যান"),
    });
    if (!ok) return;
    const stamp = new Date().toLocaleDateString("en-GB");
    diffs.forEach((d) => adjustStock(d.v.id, d.counted, "adjust", `Stock take ${stamp}`));
    toast({ title: t(`${diffs.length} counts posted`, `${f.num(diffs.length)}টি গণনা পোস্ট হয়েছে`) });
    setCounts({});
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="min-w-0 flex-1 basis-56" leading={<MagnifyingGlass className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Find an item", "পণ্য খুঁজুন")} aria-label={t("Find an item", "পণ্য খুঁজুন")} />
        <Select className="w-44" value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t("Category", "ক্যাটাগরি")}>
          <option value="all">{t("All categories", "সব ক্যাটাগরি")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {t(c.name, c.nameBn)}
            </option>
          ))}
        </Select>
        <Segmented
          value={show}
          onChange={setShow}
          ariaLabel={t("Show", "দেখান")}
          options={[
            { value: "all", label: t("Everything", "সব") },
            { value: "diff", label: t(`Differences ${diffs.length ? `(${diffs.length})` : ""}`, `পার্থক্য ${diffs.length ? `(${f.num(diffs.length)})` : ""}`) },
          ]}
        />
      </div>

      <Panel className="overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,1fr)_88px_120px_88px] gap-4 border-b border-line bg-surface-2 px-5 py-2.5 text-xs font-medium text-ink-3 sm:grid">
          <span>{t("Item", "পণ্য")}</span>
          <span className="text-right">{t("System", "সিস্টেমে")}</span>
          <span>{t("Counted", "গণনা")}</span>
          <span className="text-right">{t("Difference", "পার্থক্য")}</span>
        </div>
        {visible.length === 0 ? (
          <EmptyState icon={<ClipboardText />} title={show === "diff" ? t("No differences yet", "এখনো কোনো পার্থক্য নেই") : t("No items match", "কিছু মেলেনি")} body={show === "diff" ? t("Enter counts for items on the shelf. Only mismatches appear here.", "শেলফের গণনা দিন। শুধু অমিলগুলো এখানে দেখাবে।") : undefined} />
        ) : (
          <ul className="divide-y divide-line" data-stocktake>
            {visible.map(({ p, v }) => {
              const val = counts[v.id] ?? "";
              const d = val === "" ? null : parseInt(val, 10) - v.onHand;
              return (
                <li key={v.id} className={cn("grid grid-cols-[minmax(0,1fr)_100px] items-center gap-x-4 gap-y-1 px-5 py-2.5 sm:grid-cols-[minmax(0,1fr)_88px_120px_88px]", d !== null && d !== 0 && "bg-warn-soft/40")}>
                  <span className="flex min-w-0 items-center gap-3 max-sm:col-span-2">
                    <ProductThumb product={p} size={32} rounded="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{t.lang === "bn" ? p.nameBn || p.name : p.name}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {Object.values(v.options).join(" / ") || t("Default", "ডিফল্ট")} · <span className="font-mono">{v.sku}</span>
                        <span className="sm:hidden"> · {t(`system ${v.onHand}`, `সিস্টেমে ${f.num(v.onHand)}`)}</span>
                      </span>
                    </span>
                  </span>
                  <span className="tnum hidden text-right text-sm text-ink-2 sm:block">{f.num(v.onHand)}</span>
                  <Input
                    inputSize="sm"
                    inputMode="numeric"
                    className="tnum"
                    aria-label={t(`Counted for ${v.sku}`, `${v.sku} গণনা`)}
                    placeholder="—"
                    value={val}
                    onChange={(e) => setCounts((c) => ({ ...c, [v.id]: e.target.value.replace(/\D/g, "") }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const inputs = [...document.querySelectorAll<HTMLInputElement>("[data-stocktake] input")];
                        inputs[inputs.indexOf(e.currentTarget) + 1]?.focus();
                      }
                    }}
                  />
                  <span className={cn("tnum text-right text-sm font-semibold", d === null ? "text-ink-4" : d > 0 ? "text-ok" : d < 0 ? "text-danger" : "text-ink-3")}>{d === null ? "" : d === 0 ? "✓" : `${d > 0 ? "+" : "−"}${f.num(Math.abs(d))}`}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 md:bottom-5">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface/95 py-2.5 pl-4 pr-2.5 shadow-3 backdrop-blur-md">
          <p className="tnum min-w-0 flex-1 text-[13px] text-ink-2">
            {t(`${entered.length} counted · ${diffs.length} differ`, `${f.num(entered.length)}টি গণনা · ${f.num(diffs.length)}টি অমিল`)}
            {diffs.length > 0 && (
              <span className={cn("ml-2 font-semibold", net >= 0 ? "text-ok" : "text-danger")}>
                {t("net", "নিট")} {net > 0 ? "+" : net < 0 ? "−" : ""}
                {f.num(Math.abs(net))}
              </span>
            )}
          </p>
          {entered.length > 0 && (
            <Button variant="ghost" onClick={() => setCounts({})}>
              {t("Clear", "মুছুন")}
            </Button>
          )}
          <Button variant="primary" disabled={!diffs.length} onClick={post}>
            {t("Post adjustments", "সমন্বয় পোস্ট")}
          </Button>
        </div>
      </div>
      {confirmNode}
    </div>
  );
}

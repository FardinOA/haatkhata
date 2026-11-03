"use client";

import { ArrowDownLeft, ClipboardText, Hourglass, MapPin, Plus, Receipt, Scroll, SlidersHorizontal, SquaresFour, Storefront } from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "../bits";
import { Button, cn } from "../ui/core";
import { Adjust } from "./adjust";
import { Batches } from "./batches";
import { Locations } from "./locations";
import { PurchaseOrders } from "./purchase-orders";
import { Ledger } from "./ledger";
import { InventoryOverview } from "./overview";
import { StockIn } from "./stock-in";
import { StockTake } from "./stocktake";
import { Suppliers } from "./suppliers";
import { useT } from "@/lib/hooks";

type Tab = "overview" | "stock-in" | "purchase-orders" | "adjust" | "locations" | "expiry" | "ledger" | "suppliers" | "count";
const TABS: Tab[] = ["overview", "stock-in", "purchase-orders", "adjust", "count", "locations", "expiry", "ledger", "suppliers"];

export function InventoryPage() {
  const t = useT();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const raw = params.get("action") === "stock-in" ? "stock-in" : params.get("tab");
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : "overview";
  const prefill = (params.get("v") ?? "").split(",").filter(Boolean);
  const productFilter = params.get("product") ?? undefined;

  const go = (next: Tab, extra: Record<string, string> = {}) => {
    const q = new URLSearchParams({ tab: next, ...extra });
    if (next === "overview" && !Object.keys(extra).length) router.replace(path, { scroll: false });
    else router.replace(`${path}?${q.toString()}`, { scroll: false });
  };

  const meta: Record<Tab, { en: string; bn: string; icon: React.ReactNode }> = {
    overview: { en: "Overview", bn: "সারসংক্ষেপ", icon: <SquaresFour className="size-4" /> },
    "stock-in": { en: "Stock in", bn: "স্টক ইন", icon: <ArrowDownLeft className="size-4" /> },
    adjust: { en: "Adjust", bn: "সমন্বয়", icon: <SlidersHorizontal className="size-4" /> },
    count: { en: "Stock take", bn: "স্টক গণনা", icon: <ClipboardText className="size-4" /> },
    ledger: { en: "Ledger", bn: "লেজার", icon: <Scroll className="size-4" /> },
    suppliers: { en: "Suppliers", bn: "সাপ্লায়ার", icon: <Storefront className="size-4" /> },
    "purchase-orders": { en: "Purchase orders", bn: "ক্রয় অর্ডার", icon: <Receipt className="size-4" /> },
    locations: { en: "Locations", bn: "লোকেশন", icon: <MapPin className="size-4" /> },
    expiry: { en: "Expiry", bn: "মেয়াদ", icon: <Hourglass className="size-4" /> },
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title={t("Stock", "স্টক")}
        sub={t("What you have, what's coming in, and every change to it.", "কী আছে, কী আসছে, আর প্রতিটি পরিবর্তন।")}
        actions={
          tab !== "stock-in" ? (
            <Button variant="primary" icon={<Plus className="size-4" weight="bold" />} onClick={() => go("stock-in")}>
              {t("Stock in", "স্টক ইন")}
            </Button>
          ) : undefined
        }
      />
      <nav className="no-scrollbar -mx-4 mt-6 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label={t("Stock sections", "স্টক বিভাগ")}>
        <div role="tablist" className="inline-flex min-w-max gap-1 border-b border-line">
          {TABS.map((k) => {
            const on = k === tab;
            return (
              <button
                key={k}
                role="tab"
                type="button"
                aria-selected={on}
                onClick={() => go(k)}
                className={cn(
                  "relative inline-flex h-11 items-center gap-2 px-3 text-[13.5px] font-medium transition-colors",
                  on ? "text-ink" : "text-ink-3 hover:text-ink",
                )}
              >
                <span className={on ? "text-brand-ink" : ""}>{meta[k].icon}</span>
                {t(meta[k].en, meta[k].bn)}
                <span className={cn("absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors", on ? "bg-brand" : "bg-transparent")} />
              </button>
            );
          })}
        </div>
      </nav>
      <div className="mt-6" role="tabpanel">
        {tab === "overview" && <InventoryOverview onRestock={(ids) => go("stock-in", { v: ids.join(",") })} />}
        {tab === "stock-in" && <StockIn key={prefill.join(",")} prefill={prefill} />}
        {tab === "adjust" && <Adjust />}
        {tab === "count" && <StockTake />}
        {tab === "ledger" && <Ledger productId={productFilter} onClearProduct={() => go("ledger")} />}
        {tab === "suppliers" && <Suppliers onStockIn={() => go("stock-in")} />}
        {tab === "purchase-orders" && <PurchaseOrders />}
        {tab === "locations" && <Locations />}
        {tab === "expiry" && <Batches />}
      </div>
    </div>
  );
}

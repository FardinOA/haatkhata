"use client";

import { DownloadSimple, HandCoins, Kanban, Package, Plus, Printer, Rows, Sticker, Truck, X } from "@phosphor-icons/react";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { PageHeader } from "../bits";
import { Button, EmptyState, IconButton, Segmented } from "../ui/core";
import { useToast } from "../ui/overlays";
import { CodDialog, ShipDialog } from "./dialogs";
import { BookCourierSheet } from "../couriers/book-courier";
import { FilterBar } from "./filter-bar";
import { JourneyStrip } from "./journey-strip";
import { OrderBoard } from "./order-board";
import { OrderList } from "./order-list";
import { usePrint } from "../invoice/print-dialog";
import { OrderSheet } from "./order-sheet";
import { DEFAULT_FILTERS, downloadText, filterBase, matchStatus, ordersCsv, payState, stamp, type OrderFilters } from "./util";
import { canTransition, orderTotals } from "@/lib/domain";
import { useCan, useFmt, useT } from "@/lib/hooks";
import { useMe, useStore } from "@/lib/store";
import type { OrderStatus } from "@/lib/types";

type View = "list" | "board";

function initialFilters(params: URLSearchParams): OrderFilters {
  const f = { ...DEFAULT_FILTERS };
  if (params.get("view") === "cod") {
    f.pay = "cod_pending";
    f.range = "all";
  }
  const s = params.get("status");
  if (s) f.status = s as OrderFilters["status"];
  return f;
}

export function OrdersScreen() {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const me = useMe();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openId = params.get("id");

  const orders = useStore((s) => s.orders);
  const products = useStore((s) => s.products);
  const staffNames = useStore((s) => s.staff.map((x) => x.name).join("|"));
  const transition = useStore((s) => s.transition);
  const printing = usePrint();
  const markCod = useStore((s) => s.markCodReceived);

  const [filters, setFilters] = useState<OrderFilters>(() => initialFilters(params));
  const [view, setView] = useState<View>("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<"ship" | "cod" | null>(null);
  const [bookIds, setBookIds] = useState<string[]>([]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const staff = useMemo(() => [...new Set([...staffNames.split("|"), ...orders.map((o) => o.createdBy)])].filter(Boolean), [orders, staffNames]);
  const base = useMemo(() => filterBase(orders, filters), [orders, filters]);
  const visible = useMemo(
    () => base.filter((o) => matchStatus(o, filters.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [base, filters.status],
  );
  const visibleValue = visible.filter((o) => o.status !== "cancelled").reduce((s, o) => s + orderTotals(o).total, 0);
  const toShip = orders.filter((o) => o.status === "confirmed" || o.status === "packed").length;
  const codOut = orders.filter((o) => payState(o) === "cod_with_courier").reduce((s, o) => s + orderTotals(o).remaining, 0);

  const open = useCallback((id: string) => router.replace(`${pathname}?id=${id}`, { scroll: false }), [router, pathname]);
  const close = useCallback(() => router.replace(pathname, { scroll: false }), [router, pathname]);

  const sel = visible.filter((o) => selected.has(o.id));
  const selIds = sel.map((o) => o.id);
  const canPack = sel.filter((o) => canTransition(o.status, "packed", me.role));
  const canShip = sel.filter((o) => canTransition(o.status, "shipped", me.role));
  const codSel = sel.filter((o) => payState(o) === "cod_with_courier");
  const clearSel = () => setSelected(new Set());

  const bulkPack = () => {
    let n = 0;
    for (const o of canPack) if (transition(o.id, "packed")) n++;
    toast({ title: t(`${n} order${n === 1 ? "" : "s"} marked packed`, `${f.num(n)}টি অর্ডার প্যাক হয়েছে`), body: sel.length > n ? t(`${sel.length - n} skipped — not ready for packing`, `${f.num(sel.length - n)}টি বাদ — প্যাকের জন্য তৈরি নয়`) : undefined });
    clearSel();
  };

  // Walk-in sales have no address, so they never get a parcel label.
  const print = (doc: "invoice" | "label") => printing.choose(doc === "label" ? sel.filter((o) => o.customer).map((o) => o.id) : selIds, doc, { labels: false });

  const exportCsv = (list = visible) => {
    downloadText(`orders-${stamp()}.csv`, ordersCsv(list));
    toast({ title: t(`Exported ${list.length} orders`, `${f.num(list.length)}টি অর্ডার এক্সপোর্ট হয়েছে`) });
  };

  const pickStage = (s: OrderFilters["status"]) => {
    setFilters((x) => ({ ...x, status: s }));
    clearSel();
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-5 md:px-8 md:pt-7">
      <PageHeader
        title={t("Orders", "অর্ডার")}
        sub={
          toShip || codOut ? (
            <>
              {toShip > 0 && <>{t(`${toShip} waiting to be packed or shipped`, `${f.num(toShip)}টি প্যাক বা পাঠানোর অপেক্ষায়`)}</>}
              {toShip > 0 && codOut > 0 && " · "}
              {codOut > 0 && (
                <button type="button" onClick={() => setFilters({ ...DEFAULT_FILTERS, pay: "cod_pending", range: "all", status: "delivered" })} className="font-medium text-cash-ink underline-offset-2 hover:underline">
                  {t(`${f.money(codOut)} COD still with couriers`, `${f.money(codOut)} COD কুরিয়ারের কাছে`)}
                </button>
              )}
            </>
          ) : (
            t("Everything's moving", "সব ঠিকঠাক চলছে")
          )
        }
        actions={
          <>
            <Button variant="secondary" icon={<DownloadSimple className="size-4" />} onClick={() => exportCsv()} className="max-sm:hidden">
              {t("Export", "এক্সপোর্ট")}
            </Button>
            <Link href="/pos" className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-brand-contrast shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(0_0_0/0.12)] hover:brightness-[1.07]">
              <Plus className="size-4" weight="bold" />
              {t("New order", "নতুন অর্ডার")}
            </Link>
          </>
        }
      />

      <div className="mt-5">
        <JourneyStrip orders={base} active={filters.status} onPick={pickStage} />
      </div>

      <div className="mt-5">
        <FilterBar value={filters} onChange={(v) => (setFilters(v), clearSel())} staff={staff} />
      </div>

      <div className="mb-3 mt-4 flex items-center justify-between gap-3">
        <p className="text-[13px] text-ink-3" aria-live="polite">
          <span className="tnum font-medium text-ink">{f.num(visible.length)}</span>
          {t(" orders", "টি অর্ডার")} ·{" "}
          <span className="tnum font-medium text-ink">{f.money(visibleValue)}</span>
        </p>
        <Segmented<View>
          size="sm"
          ariaLabel={t("View", "ভিউ")}
          value={view}
          onChange={(v) => (setView(v), clearSel())}
          options={[
            { value: "list", label: t("List", "লিস্ট"), icon: <Rows className="size-3.5" /> },
            { value: "board", label: t("Board", "বোর্ড"), icon: <Kanban className="size-3.5" /> },
          ]}
        />
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            icon={<Package />}
            title={t("No orders yet", "এখনো কোনো অর্ডার নেই")}
            body={t("Take your first order from a chat or the counter. It takes about 20 seconds.", "চ্যাট বা দোকান থেকে প্রথম অর্ডার নিন। মাত্র ২০ সেকেন্ড লাগে।")}
            action={
              <Link href="/pos" className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-brand-contrast">
                <Plus className="size-4" weight="bold" /> {t("Take first order", "প্রথম অর্ডার নিন")}
              </Link>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong bg-surface/60">
          <EmptyState
            title={t("No orders match these filters", "এই ফিল্টারে কোনো অর্ডার নেই")}
            body={t("Try a wider date range, or clear filters to see everything.", "সময় বাড়িয়ে দেখুন, অথবা ফিল্টার মুছে সব দেখুন।")}
            action={
              <Button variant="secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
                {t("Clear filters", "ফিল্টার মুছুন")}
              </Button>
            }
          />
        </div>
      ) : view === "list" ? (
        <OrderList
          orders={visible}
          products={productMap}
          selected={selected}
          onOpen={open}
          onSelect={(id, on) =>
            setSelected((s) => {
              const n = new Set(s);
              if (on) n.add(id);
              else n.delete(id);
              return n;
            })
          }
          onSelectAll={(on) => setSelected(on ? new Set(visible.map((o) => o.id)) : new Set())}
        />
      ) : (
        <OrderBoard orders={visible} products={productMap} onOpen={open} />
      )}

      {/* Bulk actions */}
      <AnimatePresence>
        {sel.length > 0 && (
          <m.div
            role="toolbar"
            aria-label={t("Bulk actions", "একসাথে কাজ")}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 480, damping: 36 }}
            className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[860px] items-center gap-1 rounded-xl border border-line bg-surface p-1.5 shadow-3 md:bottom-6"
          >
            <div className="flex items-center gap-2 pl-2 pr-3">
              <span className="tnum grid h-7 min-w-7 place-items-center rounded-full bg-brand px-2 text-[13px] font-semibold text-brand-contrast">{f.num(sel.length)}</span>
              <span className="hidden text-[13px] text-ink-3 sm:inline">
                {t("selected", "নির্বাচিত")} · <span className="tnum text-ink-2">{f.money(sel.reduce((s, o) => s + orderTotals(o).total, 0))}</span>
              </span>
            </div>
            <div className="no-scrollbar flex flex-1 items-center gap-1 overflow-x-auto">
              {can("pack_ship") && (
                <Button size="sm" variant="ghost" disabled={!canPack.length} onClick={bulkPack} icon={<Package className="size-4" />}>
                  {t("Packed", "প্যাক")}
                  {canPack.length > 0 && canPack.length < sel.length && <span className="tnum text-ink-4">{f.num(canPack.length)}</span>}
                </Button>
              )}
              {can("pack_ship") && (
                <Button size="sm" variant="ghost" disabled={!canShip.length} onClick={() => setBulkDialog("ship")} icon={<Truck className="size-4" />}>
                  {t("Ship", "পাঠান")}
                  {canShip.length > 0 && canShip.length < sel.length && <span className="tnum text-ink-4">{f.num(canShip.length)}</span>}
                </Button>
              )}
              {can("pack_ship") && canShip.length > 0 && (
                <Button size="sm" variant="soft" onClick={() => setBookIds(canShip.filter((o) => !o.courier?.consignmentId).map((o) => o.id))} icon={<Truck className="size-4" weight="fill" />}>
                  {t("Book courier", "কুরিয়ার বুক")}
                </Button>
              )}
              {codSel.length > 0 && can("deliver_return") && (
                <Button size="sm" variant="ghost" onClick={() => setBulkDialog("cod")} icon={<HandCoins className="size-4" />}>
                  {t("COD received", "COD পেয়েছি")}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => print("invoice")} icon={<Printer className="size-4" />}>
                {t("Invoices", "ইনভয়েস")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => print("label")} icon={<Sticker className="size-4" />}>
                {t("Labels", "লেবেল")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => exportCsv(sel)} icon={<DownloadSimple className="size-4" />}>
                CSV
              </Button>
            </div>
            <IconButton label={t("Clear selection", "নির্বাচন মুছুন")} size="sm" onClick={clearSel}>
              <X className="size-4" />
            </IconButton>
          </m.div>
        )}
      </AnimatePresence>

      <BookCourierSheet
        open={bookIds.length > 0}
        orderIds={bookIds}
        onClose={() => {
          setBookIds([]);
          clearSel();
        }}
      />
      {bulkDialog === "ship" && (
        <ShipDialog
          open
          count={canShip.length}
          onClose={() => setBulkDialog(null)}
          onConfirm={(c) => {
            let n = 0;
            for (const o of canShip) if (transition(o.id, "shipped" as OrderStatus, { courier: c })) n++;
            toast({ title: t(`${n} orders handed to ${c.name}`, `${f.num(n)}টি অর্ডার ${c.name}-এ দেওয়া হয়েছে`) });
            setBulkDialog(null);
            clearSel();
          }}
        />
      )}
      {bulkDialog === "cod" && (
        <CodDialog
          open
          count={codSel.length}
          amount={codSel.reduce((s, o) => s + orderTotals(o).remaining, 0)}
          onClose={() => setBulkDialog(null)}
          onConfirm={(ref) => {
            markCod(codSel.map((o) => o.id), ref);
            toast({ title: t(`COD received on ${codSel.length} orders`, `${f.num(codSel.length)}টি অর্ডারের COD পাওয়া গেছে`) });
            setBulkDialog(null);
            clearSel();
          }}
        />
      )}

      <OrderSheet orderId={openId} onClose={close} />
      {printing.node}
    </div>
  );
}

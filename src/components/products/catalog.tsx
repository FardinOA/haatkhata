"use client";

import {
  Barcode,
  Camera,
  CopySimple,
  DotsThree,
  DownloadSimple,
  FunnelSimple,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  ShareNetwork,
  SquaresFour,
  Rows,
  Tag,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader, ProductThumb, StockMeter } from "../bits";
import { CardArt } from "./card-art";
import { Badge, Button, Checkbox, cn, EmptyState, IconButton, Input, Segmented, Select } from "../ui/core";
import { Menu, useToast } from "../ui/overlays";
import { ImportSheet } from "./import-sheet";
import { ShareCardSheet } from "./share-card";
import { CameraScanner, primeScanFeedback } from "../scan/camera-scanner";
import { usePhoneScanTarget } from "../scan/phone-scanner-provider";
import { colourValues, downloadText, margin, priceRange, productStock, swatchFor, toCSV, avgCost } from "./utils";
import { findByCode } from "@/lib/barcode";
import { useCan, useDebounced, useFmt, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";

type StockFilter = "all" | "low" | "out";
type StatusFilter = "all" | "active" | "inactive";

const VIEW_KEY = "bk-products-view";

export function Catalog() {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const router = useRouter();
  const toast = useToast();
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const saveProduct = useStore((s) => s.saveProduct);
  const duplicateProduct = useStore((s) => s.duplicateProduct);

  const [view, setViewState] = useState<"grid" | "table">(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "grid";
    } catch {
      return "grid";
    }
  });
  const setView = (v: "grid" | "table") => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 120);
  const [cat, setCat] = useState<string>("all");
  const [stock, setStock] = useState<StockFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [share, setShare] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [scanning, setScanning] = useState(false);

  const catName = (id: string) => {
    const c = categories.find((x) => x.id === id);
    return c ? t(c.name, c.nameBn) : t("Uncategorised", "ক্যাটাগরি নেই");
  };

  const filtered = useMemo(() => {
    const needle = dq.trim().toLowerCase();
    return products.filter((p) => {
      if (cat !== "all" && p.categoryId !== cat) return false;
      if (status !== "all" && p.status !== status) return false;
      if (stock !== "all") {
        const s = productStock(p);
        if (stock === "low" && s.low + s.out === 0) return false;
        if (stock === "out" && s.out === 0) return false;
      }
      if (!needle) return true;
      const hay = `${p.name} ${p.nameBn ?? ""} ${p.tags.join(" ")} ${p.variants.map((v) => `${v.sku} ${v.barcode ?? ""}`).join(" ")}`.toLowerCase();
      return needle.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [products, dq, cat, stock, status]);

  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach((p) => m.set(p.categoryId, (m.get(p.categoryId) ?? 0) + 1));
    return m;
  }, [products]);

  const totals = useMemo(() => {
    let skus = 0;
    let value = 0;
    let low = 0;
    let out = 0;
    for (const p of products) {
      if (p.status !== "active") continue;
      const s = productStock(p);
      skus += s.variants;
      low += s.low;
      out += s.out;
      value += p.variants.filter((v) => v.active).reduce((a, v) => a + Math.max(0, v.onHand) * v.price, 0);
    }
    return { skus, value, low, out };
  }, [products]);

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const someSelected = filtered.some((p) => selected.has(p.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const selectedProducts = products.filter((p) => selected.has(p.id));

  const bulkSet = (patch: Partial<Product>, msg: string) => {
    selectedProducts.forEach((p) => saveProduct({ ...p, ...patch }));
    toast({ title: msg });
    setSelected(new Set());
  };

  const exportCsv = (list: Product[]) => {
    const rows: (string | number)[][] = [["name", "name_bn", "category", "sku", "barcode", "options", "price", ...(can("view_cost") ? ["cost"] : []), "on_hand", "reserved", "available", "status"]];
    for (const p of list)
      for (const v of p.variants)
        rows.push([
          p.name,
          p.nameBn ?? "",
          catName(p.categoryId),
          v.sku,
          v.barcode ?? "",
          Object.entries(v.options)
            .map(([k, val]) => `${k}: ${val}`)
            .join("; "),
          v.price,
          ...(can("view_cost") ? [v.cost] : []),
          v.onHand,
          v.reserved,
          v.onHand - v.reserved,
          v.active && p.status === "active" ? "active" : "inactive",
        ]);
    downloadText(`products-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
    toast({ title: t(`Exported ${list.length} products`, `${f.num(list.length)}টি পণ্য এক্সপোর্ট হয়েছে`) });
  };

  /** Keyboard-wedge scanners type the code and press Enter — jump straight to that product. */
  const openScanned = () => {
    const hit = findByCode(products, q);
    if (hit) router.push(`/products/${hit.p.id}`);
  };

  // A paired phone opens the scanned product here, like the camera button does.
  usePhoneScanTarget((code) => {
    const hit = findByCode(products, code);
    if (!hit) return { ok: false, title: t("Not one of your products", "আপনার কোনো পণ্যের সাথে মেলেনি"), detail: code };
    router.push(`/products/${hit.p.id}`);
    return { ok: true, title: t(`Opened ${hit.p.name}`, `${hit.p.nameBn ?? hit.p.name} খোলা হয়েছে`), detail: code };
  });

  const actionsFor = (p: Product) => [
    { label: t("Edit product", "পণ্য এডিট করুন"), icon: <PencilSimple />, onSelect: () => router.push(`/products/${p.id}`) },
    { label: t("Print labels", "লেবেল প্রিন্ট"), icon: <Barcode />, onSelect: () => router.push(labelsHref([p])) },
    { label: t("Share card", "শেয়ার কার্ড"), icon: <ShareNetwork />, onSelect: () => setShare(p) },
    {
      label: t("Duplicate", "কপি করুন"),
      icon: <CopySimple />,
      onSelect: () => {
        const id = duplicateProduct(p.id);
        if (id) {
          toast({ title: t("Product duplicated", "পণ্য কপি হয়েছে"), action: { label: t("Open", "খুলুন"), onClick: () => router.push(`/products/${id}`) } });
        }
      },
    },
  ];

  const filtersActive = cat !== "all" || stock !== "all" || status !== "all" || q;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title={t("Products", "পণ্য")}
        sub={
          <>
            {t(`${f.num(products.length)} products · ${f.num(totals.skus)} SKUs · ${f.money(totals.value)} at sale price`, `${f.num(products.length)}টি পণ্য · ${f.num(totals.skus)}টি SKU · বিক্রয়মূল্যে ${f.money(totals.value)}`)}
          </>
        }
        actions={
          <>
            <Button icon={<UploadSimple className="size-4" />} onClick={() => setImportOpen(true)}>
              {t("Import", "ইমপোর্ট")}
            </Button>
            <Button icon={<Barcode className="size-4" />} onClick={() => router.push("/labels")}>
              {t("Print labels", "লেবেল প্রিন্ট")}
            </Button>
            <Link href="/products/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-brand-contrast shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(0_0_0/0.12)] hover:brightness-[1.07]">
              <Plus className="size-4" weight="bold" />
              {t("Add product", "পণ্য যোগ করুন")}
            </Link>
          </>
        }
      />

      {(totals.low > 0 || totals.out > 0) && (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-warn/20 bg-warn-soft/60 px-4 py-3 text-[13.5px]">
          <span className="font-medium text-warn">
            {t(`${f.num(totals.out)} sizes or colours sold out, ${f.num(totals.low)} running low`, `${f.num(totals.out)}টি ভ্যারিয়েন্ট শেষ, ${f.num(totals.low)}টি কম আছে`)}
          </span>
          <button type="button" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink" onClick={() => setStock("low")}>
            {t("Show them", "দেখুন")}
          </button>
          <Link href="/inventory?action=stock-in" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            {t("Record stock in", "স্টক ইন করুন")}
          </Link>
        </div>
      )}

      {/* Toolbar */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="min-w-0 flex-1 basis-64"
            leading={<MagnifyingGlass className="size-4" />}
            trailing={
              q ? (
                <IconButton label={t("Clear search", "মুছুন")} size="sm" onClick={() => setQ("")}>
                  <X className="size-3.5" />
                </IconButton>
              ) : null
            }
            placeholder={t("Search by name, SKU or barcode", "নাম, SKU বা বারকোড দিয়ে খুঁজুন")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && openScanned()}
            aria-label={t("Search products", "পণ্য খুঁজুন")}
          />
          <Button
            icon={<Camera className="size-4" />}
            onClick={() => {
              primeScanFeedback();
              setScanning(true);
            }}
          >
            {t("Scan", "স্ক্যান")}
          </Button>
          <Segmented<StockFilter>
            ariaLabel={t("Stock level", "স্টকের অবস্থা")}
            value={stock}
            onChange={setStock}
            options={[
              { value: "all", label: t("All stock", "সব") },
              { value: "low", label: t("Low", "কম") },
              { value: "out", label: t("Sold out", "শেষ") },
            ]}
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="w-36" aria-label={t("Status", "অবস্থা")}>
            <option value="all">{t("Any status", "সব অবস্থা")}</option>
            <option value="active">{t("Active", "চালু")}</option>
            <option value="inactive">{t("Hidden", "বন্ধ")}</option>
          </Select>
          <Segmented<"grid" | "table">
            ariaLabel={t("Layout", "লেআউট")}
            value={view}
            onChange={setView}
            options={[
              { value: "grid", label: <span className="sr-only">{t("Grid", "গ্রিড")}</span>, icon: <SquaresFour className="size-4" weight={view === "grid" ? "fill" : "regular"} /> },
              { value: "table", label: <span className="sr-only">{t("Table", "টেবিল")}</span>, icon: <Rows className="size-4" weight={view === "table" ? "fill" : "regular"} /> },
            ]}
          />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          <CatChip active={cat === "all"} onClick={() => setCat("all")} label={t("Everything", "সব")} count={products.length} />
          {categories
            .filter((c) => catCounts.get(c.id))
            .map((c) => (
              <CatChip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} label={t(c.name, c.nameBn)} count={catCounts.get(c.id) ?? 0} />
            ))}
        </div>
      </div>

      {/* Results */}
      <div className="mt-5">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line-strong bg-surface/60">
            {products.length === 0 ? (
              <EmptyState
                icon={<Tag />}
                title={t("Add your first product", "প্রথম পণ্য যোগ করুন")}
                body={t("Products hold your prices and stock. Add one by hand or import your Excel sheet.", "পণ্যে দাম আর স্টক থাকে। হাতে যোগ করুন বা Excel ইমপোর্ট করুন।")}
                action={
                  <div className="flex gap-2">
                    <Button onClick={() => setImportOpen(true)}>{t("Import CSV", "CSV ইমপোর্ট")}</Button>
                    <Button variant="primary" onClick={() => router.push("/products/new")}>
                      {t("Add product", "পণ্য যোগ করুন")}
                    </Button>
                  </div>
                }
              />
            ) : (
              <EmptyState
                icon={<FunnelSimple />}
                title={t("No products match these filters", "এই ফিল্টারে কোনো পণ্য নেই")}
                body={q ? t(`Nothing found for “${q}”. Check the spelling or search by SKU.`, `“${q}” পাওয়া যায়নি। বানান বা SKU দেখুন।`) : undefined}
                action={
                  filtersActive ? (
                    <Button
                      onClick={() => {
                        setQ("");
                        setCat("all");
                        setStock("all");
                        setStatus("all");
                      }}
                    >
                      {t("Clear filters", "ফিল্টার মুছুন")}
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        ) : view === "grid" ? (
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} p={p} selected={selected.has(p.id)} onSelect={() => toggle(p.id)} selecting={someSelected} category={catName(p.categoryId)} menu={actionsFor(p)} />
            ))}
          </ul>
        ) : (
          <ProductTable
            list={filtered}
            selected={selected}
            toggle={toggle}
            allSelected={allSelected}
            someSelected={someSelected}
            toggleAll={() => setSelected(allSelected ? new Set() : new Set(filtered.map((p) => p.id)))}
            catName={catName}
            menuFor={actionsFor}
          />
        )}
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-3 bottom-[calc(80px+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2 pl-4 shadow-3 md:bottom-6">
          <span className="tnum mr-auto text-sm font-medium text-ink">{t(`${f.num(selected.size)} selected`, `${f.num(selected.size)}টি বাছাই`)}</span>
          <Menu
            align="end"
            width={220}
            items={[
              { type: "label", label: t("Move to category", "ক্যাটাগরিতে সরান") },
              ...categories.map((c) => ({ label: t(c.name, c.nameBn), onSelect: () => bulkSet({ categoryId: c.id }, t(`Moved to ${c.name}`, `${c.nameBn} এ সরানো হয়েছে`)) })),
            ]}
            trigger={({ toggle: tg, ref }) => (
              <Button ref={ref} size="sm" onClick={tg}>
                {t("Category", "ক্যাটাগরি")}
              </Button>
            )}
          />
          <Button size="sm" onClick={() => bulkSet({ status: "active" }, t("Products are live", "পণ্য চালু হয়েছে"))}>
            {t("Activate", "চালু")}
          </Button>
          <Button size="sm" onClick={() => bulkSet({ status: "inactive" }, t("Products hidden from the POS", "পণ্য POS থেকে লুকানো হয়েছে"))}>
            {t("Hide", "বন্ধ")}
          </Button>
          <Button size="sm" icon={<DownloadSimple className="size-4" />} onClick={() => exportCsv(selectedProducts)}>
            CSV
          </Button>
          <Link
            href={labelsHref(selectedProducts)}
            className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong/80 bg-surface px-3 text-[13px] font-medium text-ink shadow-1 hover:bg-surface-2"
          >
            <Barcode className="size-4" />
            {t("Labels", "লেবেল")}
          </Link>
          <IconButton label={t("Clear selection", "বাছাই মুছুন")} size="sm" onClick={() => setSelected(new Set())}>
            <X className="size-4" />
          </IconButton>
        </div>
      )}

      {selected.size === 0 && filtered.length > 0 && (
        <div className="mt-6 flex justify-end">
          <Button variant="ghost" size="sm" icon={<DownloadSimple className="size-4" />} onClick={() => exportCsv(filtered)}>
            {t("Export these to CSV", "CSV তে এক্সপোর্ট")}
          </Button>
        </div>
      )}

      <ShareCardSheet product={share} onClose={() => setShare(null)} />
      <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} />
      <CameraScanner
        open={scanning}
        onClose={() => setScanning(false)}
        title={t("Find by barcode", "বারকোড দিয়ে খুঁজুন")}
        sub={t("Scan a label to open that product.", "লেবেল স্ক্যান করলে পণ্যটি খুলবে।")}
        onCode={(code) => {
          const hit = findByCode(products, code);
          if (!hit) return { ok: false, title: t("Not one of your products", "আপনার কোনো পণ্যের সাথে মেলেনি"), detail: code };
          setScanning(false);
          router.push(`/products/${hit.p.id}`);
          return null;
        }}
      />
    </div>
  );
}

/** One label per active variant, ready to tweak on the labels page. */
export function labelsHref(list: Product[]) {
  return `/labels?v=${list.flatMap((p) => p.variants.filter((v) => v.active).map((v) => `${v.id}:1`)).join(",")}`;
}

function CatChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  const f = useFmt();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
        active ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
      )}
    >
      {label}
      <span className={cn("tnum text-xs", active ? "text-white/70" : "text-ink-4")}>{f.num(count)}</span>
    </button>
  );
}

/* ------------------------------------------------------------ grid card */

function ProductCard({
  p,
  selected,
  onSelect,
  selecting,
  category,
  menu,
}: {
  p: Product;
  selected: boolean;
  onSelect: () => void;
  selecting: boolean;
  category: string;
  menu: { label: string; icon: React.ReactNode; onSelect: () => void }[];
}) {
  const t = useT();
  const f = useFmt();
  const s = productStock(p);
  const range = priceRange(p);
  const mrp = p.variants.find((v) => v.mrp && v.mrp > v.price)?.mrp;
  const colours = colourValues(p);
  const name = t.lang === "bn" ? p.nameBn || p.name : p.name;
  return (
    <li className={cn("group relative flex flex-col overflow-hidden rounded-lg border bg-surface shadow-1 transition-[border-color,box-shadow] duration-150 hover:shadow-2", selected ? "border-brand ring-2 ring-brand/25" : "border-line hover:border-line-strong")}>
      <Link href={`/products/${p.id}`} className="absolute inset-0 z-0" aria-label={name} />
      <div className="relative aspect-[5/4] overflow-hidden">
        <CardArt product={p} className="absolute inset-0" />
        {p.status === "inactive" && <div className="absolute inset-0 grid place-items-center bg-surface/60 text-[13px] font-medium text-ink-2 backdrop-grayscale">{t("Hidden from POS", "POS এ লুকানো")}</div>}
        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between">
          <div className="flex flex-col items-start gap-1">
            {p.tags.includes("bestseller") && <span className="rounded-full bg-surface/95 px-2 py-0.5 text-[11px] font-semibold text-ink shadow-1">{t("Bestseller", "বেস্টসেলার")}</span>}
            {s.out > 0 && <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] font-semibold text-white">{t(`${f.num(s.out)} sold out`, `${f.num(s.out)}টি শেষ`)}</span>}
          </div>
        </div>
        <div className={cn("absolute right-2 top-2 z-10 transition-opacity", selected || selecting ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100")}>
          <span className="grid size-7 place-items-center rounded-md bg-surface/95 shadow-1">
            <Checkbox checked={selected} onChange={onSelect} label={t(`Select ${p.name}`, `${name} বাছাই`)} />
          </span>
        </div>
      </div>
      <div className="relative flex flex-1 flex-col p-3 sm:p-4">
        <div className="pointer-events-none flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-ink-3">{category}</p>
            <h3 className="mt-0.5 line-clamp-2 text-[14.5px] font-semibold leading-snug text-ink">{name}</h3>
          </div>
          <div className="pointer-events-auto relative z-10 -mr-1.5 -mt-1">
            <Menu
              width={200}
              items={menu}
              trigger={({ toggle, ref }) => (
                <IconButton ref={ref} label={t("More actions", "আরও")} size="sm" onClick={toggle}>
                  <DotsThree className="size-5" weight="bold" />
                </IconButton>
              )}
            />
          </div>
        </div>
        <div className="pointer-events-none mt-2 flex items-baseline gap-2">
          <span className="figure text-[19px] font-semibold text-ink">
            {f.money(range.min)}
            {range.max > range.min && <span className="text-ink-3">–{f.num(range.max)}</span>}
          </span>
          {mrp && <span className="tnum text-xs text-ink-4 line-through">{f.money(mrp)}</span>}
        </div>
        <div className="pointer-events-none mt-1.5 flex items-center gap-2 text-xs text-ink-3">
          {colours.length > 0 && (
            <span className="flex -space-x-1">
              {colours.slice(0, 5).map((c) => (
                <span key={c} title={c} className="size-3.5 rounded-full border-2 border-surface" style={{ background: swatchFor(c) ?? "var(--line-strong)" }} />
              ))}
            </span>
          )}
          <span>{t(`${f.num(s.variants)} variants`, `${f.num(s.variants)}টি ভ্যারিয়েন্ট`)}</span>
        </div>
        <StockMeter v={{ onHand: s.onHand, reserved: s.reserved, lowStock: s.lowStock, inTransit: s.inTransit }} className="pointer-events-none mt-auto pt-3" />
      </div>
    </li>
  );
}

/* ------------------------------------------------------------ table */

function ProductTable({
  list,
  selected,
  toggle,
  allSelected,
  someSelected,
  toggleAll,
  catName,
  menuFor,
}: {
  list: Product[];
  selected: Set<string>;
  toggle: (id: string) => void;
  allSelected: boolean;
  someSelected: boolean;
  toggleAll: () => void;
  catName: (id: string) => string;
  menuFor: (p: Product) => { label: string; icon: React.ReactNode; onSelect: () => void }[];
}) {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const showCost = can("view_cost");
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-1">
      <div
        className={cn(
          "hidden items-center gap-4 border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-medium text-ink-3 md:grid",
          showCost ? "grid-cols-[18px_minmax(0,2.4fr)_1fr_1fr_1fr_1.4fr_90px_32px]" : "grid-cols-[18px_minmax(0,2.4fr)_1fr_1fr_1.4fr_90px_32px]",
        )}
      >
        <Checkbox checked={allSelected} indeterminate={!allSelected && someSelected} onChange={toggleAll} label={t("Select all", "সব বাছাই")} />
        <span>{t("Product", "পণ্য")}</span>
        <span>{t("Category", "ক্যাটাগরি")}</span>
        <span className="text-right">{t("Price", "দাম")}</span>
        {showCost && <span className="text-right">{t("Cost · margin", "খরচ · মার্জিন")}</span>}
        <span>{t("Available · held · on the way", "আছে · রিজার্ভ · পথে")}</span>
        <span>{t("Status", "অবস্থা")}</span>
        <span />
      </div>
      <ul className="divide-y divide-line">
        {list.map((p) => {
          const s = productStock(p);
          const range = priceRange(p);
          const cost = avgCost(p);
          const m = margin((range.min + range.max) / 2, cost);
          const name = t.lang === "bn" ? p.nameBn || p.name : p.name;
          return (
            <li
              key={p.id}
              className={cn(
                "relative grid grid-cols-[18px_44px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-surface-2 md:gap-4",
                showCost ? "md:grid-cols-[18px_minmax(0,2.4fr)_1fr_1fr_1fr_1.4fr_90px_32px]" : "md:grid-cols-[18px_minmax(0,2.4fr)_1fr_1fr_1.4fr_90px_32px]",
                selected.has(p.id) && "bg-brand-50/60 hover:bg-brand-50",
              )}
            >
              <Checkbox checked={selected.has(p.id)} onChange={() => toggle(p.id)} label={t(`Select ${p.name}`, `${name} বাছাই`)} className="relative z-10" />
              <Link href={`/products/${p.id}`} className="contents md:flex md:min-w-0 md:items-center md:gap-3">
                <ProductThumb product={p} size={44} rounded="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{name}</span>
                  <span className="block truncate text-xs text-ink-3">
                    {p.variants[0]?.sku.split("-")[0]} · {t(`${f.num(s.variants)} variants`, `${f.num(s.variants)}টি ভ্যারিয়েন্ট`)}
                    <span className="md:hidden"> · {catName(p.categoryId)}</span>
                  </span>
                </span>
              </Link>
              <span className="hidden truncate text-[13px] text-ink-2 md:block">{catName(p.categoryId)}</span>
              <span className="tnum row-span-1 text-right text-sm font-medium text-ink max-md:col-start-4 max-md:row-start-1">
                {f.money(range.min)}
                {range.max > range.min && <span className="text-ink-3">–{f.num(range.max)}</span>}
              </span>
              {showCost && (
                <span className="tnum hidden text-right text-[13px] md:block">
                  <span className="text-ink-2">{f.money(Math.round(cost))}</span>
                  <span className={cn("ml-1.5", m >= 0.35 ? "text-ok" : m >= 0.2 ? "text-ink-3" : "text-danger")}>{f.pct(m)}</span>
                </span>
              )}
              <span className="tnum col-span-2 col-start-3 flex items-center gap-3 text-[13px] md:col-span-1 md:col-start-auto">
                <span className="font-semibold text-ink">{f.num(s.available)}</span>
                <span className="text-ink-4">·</span>
                <span className="text-st-confirmed">{f.num(s.reserved)}</span>
                <span className="text-ink-4">·</span>
                <span className="text-st-shipped">{f.num(s.inTransit)}</span>
                {(s.low > 0 || s.out > 0) && (
                  <Badge tone={s.out ? "danger" : "warn"} className="ml-1">
                    {s.out ? t(`${s.out} sold out`, `${f.num(s.out)}টি শেষ`) : t(`${s.low} low`, `${f.num(s.low)}টি কম`)}
                  </Badge>
                )}
              </span>
              <span className="hidden md:block">
                {p.status === "active" ? (
                  <Badge tone="ok" dot>
                    {t("Active", "চালু")}
                  </Badge>
                ) : (
                  <Badge dot>{t("Hidden", "বন্ধ")}</Badge>
                )}
              </span>
              <span className="relative z-10 hidden md:block">
                <Menu
                  width={200}
                  items={menuFor(p)}
                  trigger={({ toggle: tg, ref }) => (
                    <IconButton ref={ref} label={t("More actions", "আরও")} size="sm" onClick={tg}>
                      <DotsThree className="size-5" weight="bold" />
                    </IconButton>
                  )}
                />
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-4 border-t border-line bg-surface-2 px-4 py-2.5 text-xs text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-ink" /> {t("Available to sell", "বিক্রির জন্য আছে")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-st-confirmed" /> {t("Held for confirmed orders", "নিশ্চিত অর্ডারে রিজার্ভ")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-st-shipped" /> {t("With the courier", "কুরিয়ারের কাছে")}
        </span>
      </div>
    </div>
  );
}

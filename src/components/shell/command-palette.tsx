"use client";

import { ArrowBendDownLeft, MagnifyingGlass, Package, Plus, Receipt, UserPlus, Truck, Palette, type Icon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ProductThumb, StatusPill } from "../bits";
import { Avatar, cn, Kbd } from "../ui/core";
import { usePresence } from "../ui/overlays";
import { NAV } from "./nav";
import { useFmt, useHotkey, useT } from "@/lib/hooks";
import { orderTotals, useStore } from "@/lib/store";

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);
  useHotkey("k", (e) => {
    e.preventDefault();
    setOpen((o) => !o);
  }, { meta: true });
  useHotkey("/", (e) => {
    e.preventDefault();
    setOpen(true);
  });
  return { open, show, hide };
}

type Item = { id: string; group: string; label: ReactNode; sub?: ReactNode; leading: ReactNode; href: string; keywords: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ঀ-৿]+/g, " ").trim();

function score(hay: string, q: string) {
  if (!q) return 1;
  const h = norm(hay);
  const terms = norm(q).split(" ").filter(Boolean);
  let s = 0;
  for (const term of terms) {
    const i = h.indexOf(term);
    if (i < 0) return 0;
    s += i === 0 || h[i - 1] === " " ? 3 : 1;
  }
  return s;
}

export function CommandPalette({ open, hide }: { open: boolean; show: () => void; hide: () => void }) {
  const { present, state, onExited } = usePresence(open);
  if (typeof document === "undefined" || !present) return null;
  // The body remounts on every open, so query and selection start fresh.
  return createPortal(<PaletteBody hide={hide} state={state} onExited={onExited} />, document.body);
}

function PaletteBody({ hide, state, onExited }: { hide: () => void; state: "open" | "closed"; onExited: () => void }) {
  const t = useT();
  const f = useFmt();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const products = useStore((s) => s.products);
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);

  const items = useMemo(() => {
    const icon = (I: Icon) => (
      <span className="grid size-8 place-items-center rounded-md bg-sunken text-ink-2">
        <I className="size-4" />
      </span>
    );
    const actions: Item[] = [
      { id: "a-new", group: t("Actions", "কাজ"), label: t("New order", "নতুন অর্ডার"), leading: icon(Plus), href: "/pos", keywords: "new order sale pos create নতুন অর্ডার" },
      { id: "a-stock", group: t("Actions", "কাজ"), label: t("Stock in from supplier", "সাপ্লায়ার থেকে স্টক ইন"), leading: icon(Truck), href: "/inventory?action=stock-in", keywords: "stock in purchase supplier restock স্টক" },
      { id: "a-prod", group: t("Actions", "কাজ"), label: t("Add a product", "পণ্য যোগ করুন"), leading: icon(Package), href: "/products/new", keywords: "add product new item পণ্য" },
      { id: "a-cust", group: t("Actions", "কাজ"), label: t("Add a customer", "কাস্টমার যোগ করুন"), leading: icon(UserPlus), href: "/customers?new=1", keywords: "add customer কাস্টমার" },
      { id: "a-brand", group: t("Actions", "কাজ"), label: t("Change logo & colours", "লোগো ও রং বদলান"), leading: icon(Palette), href: "/settings?tab=brand", keywords: "brand logo colour color theme customize রং লোগো" },
    ];
    const pages: Item[] = NAV.map((n) => ({ id: `n-${n.key}`, group: t("Go to", "যান"), label: t(n.en, n.bn), leading: icon(n.icon), href: n.href, keywords: `${n.en} ${n.bn}` }));

    const query = q.trim();
    const pool: { item: Item; s: number }[] = [];
    for (const it of [...actions, ...pages]) {
      const s = score(it.keywords, query);
      if (s) pool.push({ item: it, s: s + 0.5 });
    }
    if (query.length >= 2) {
      const digits = query.replace(/\D/g, "");
      for (const o of [...orders].reverse()) {
        const hay = `${o.no} #${o.no} ${o.invoiceNo ?? ""} ${o.customer?.name ?? ""} ${o.customer?.phone ?? ""}`;
        const s = score(hay, query) || (digits.length >= 4 && o.customer?.phone.includes(digits) ? 2 : 0);
        if (s)
          pool.push({
            s,
            item: {
              id: o.id,
              group: t("Orders", "অর্ডার"),
              label: (
                <span className="flex items-center gap-2">
                  #{f.digits(String(o.no))} · {o.customer?.name ?? t("Walk-in customer", "দোকানের কাস্টমার")}
                </span>
              ),
              sub: (
                <span className="flex items-center gap-2">
                  <StatusPill status={o.status} size="sm" /> {f.money(orderTotals(o).total)} · {f.relative(o.createdAt)}
                </span>
              ),
              leading: icon(Receipt),
              href: `/orders?id=${o.id}`,
              keywords: hay,
            },
          });
      }
      for (const p of products) {
        const hay = `${p.name} ${p.nameBn ?? ""} ${p.variants.map((v) => `${v.sku} ${v.barcode ?? ""}`).join(" ")}`;
        const s = score(hay, query);
        if (s)
          pool.push({
            s: s + 0.2,
            item: {
              id: p.id,
              group: t("Products", "পণ্য"),
              label: t.lang === "bn" ? p.nameBn ?? p.name : p.name,
              sub: `${p.variants.length} ${t("variants", "ভ্যারিয়েন্ট")} · ${f.money(p.variants[0]?.price ?? 0)}`,
              leading: <ProductThumb product={p} size={32} rounded="sm" />,
              href: `/products/${p.id}`,
              keywords: hay,
            },
          });
      }
      for (const c of customers) {
        const hay = `${c.name} ${c.phone} ${c.address.area} ${c.address.district}`;
        const s = score(hay, query) || (digits.length >= 4 && c.phone.includes(digits) ? 2 : 0);
        if (s)
          pool.push({
            s: s + 0.1,
            item: {
              id: c.id,
              group: t("Customers", "কাস্টমার"),
              label: c.name,
              sub: `${f.digits(c.phone)} · ${c.address.area}, ${c.address.district}`,
              leading: <Avatar name={c.name} size={32} />,
              href: `/customers?id=${c.id}`,
              keywords: hay,
            },
          });
      }
    }
    const sorted = pool.sort((a, b) => b.s - a.s);
    const byGroup = new Map<string, Item[]>();
    for (const { item } of sorted) {
      const g = byGroup.get(item.group) ?? [];
      if (g.length < (query ? 6 : 8)) g.push(item);
      byGroup.set(item.group, g);
    }
    return [...byGroup.entries()];
  }, [q, orders, products, customers, t, f]);

  const flat = items.flatMap(([, xs]) => xs);
  const go = (it: Item | undefined) => {
    if (!it) return;
    hide();
    router.push(it.href);
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  return (
        <div className="fixed inset-0 z-[80] flex items-start justify-center px-3 pt-[10vh]">
          <div className="bk-scrim absolute inset-0 bg-[rgb(22_24_26/0.3)] backdrop-blur-[2px]" data-state={state} onClick={hide} />
          <div
            data-state={state}
            onAnimationEnd={(e) => e.target === e.currentTarget && state === "closed" && onExited()}
            role="dialog"
            aria-modal="true"
            aria-label={t("Search", "খুঁজুন")}
            className="bk-drop relative w-full max-w-[600px] overflow-hidden rounded-xl border border-line bg-surface shadow-3"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <MagnifyingGlass className="size-5 text-ink-3" />
              <input
                ref={inputRef}
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setIdx(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setIdx((i) => Math.min(flat.length - 1, i + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setIdx((i) => Math.max(0, i - 1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    go(flat[idx]);
                  } else if (e.key === "Escape") hide();
                }}
                placeholder={t("Order #, phone number, product, SKU…", "অর্ডার নং, ফোন, পণ্য, SKU…")}
                className="h-14 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-4 focus:outline-none"
                aria-activedescendant={flat[idx] ? `cmd-${flat[idx].id}` : undefined}
              />
              <Kbd>Esc</Kbd>
            </div>
            <div ref={listRef} className="scroll-thin max-h-[56vh] overflow-y-auto p-2" role="listbox">
              {flat.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-medium text-ink">{t(`Nothing matches “${q}”`, `“${q}” এর সাথে কিছু মেলেনি`)}</p>
                  <p className="mt-1 text-[13px] text-ink-3">{t("Try an order number, the last 4 digits of a phone, or a SKU.", "অর্ডার নম্বর, ফোনের শেষ ৪ সংখ্যা বা SKU দিয়ে খুঁজুন।")}</p>
                </div>
              )}
              {items.map(([group, xs]) => (
                <div key={group} className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-xs font-medium text-ink-4">{group}</p>
                  {xs.map((it) => {
                    const i = flat.indexOf(it);
                    return (
                      <button
                        key={it.id}
                        id={`cmd-${it.id}`}
                        data-idx={i}
                        role="option"
                        aria-selected={i === idx}
                        type="button"
                        onMouseMove={() => setIdx(i)}
                        onClick={() => go(it)}
                        className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left", i === idx ? "bg-brand-50" : "")}
                      >
                        {it.leading}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{it.label}</span>
                          {it.sub && <span className="mt-0.5 block truncate text-xs text-ink-3">{it.sub}</span>}
                        </span>
                        {i === idx && <ArrowBendDownLeft className="size-4 text-brand-ink" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 border-t border-line bg-surface-2 px-4 py-2.5 text-xs text-ink-3">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> {t("move", "সরান")}
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>↵</Kbd> {t("open", "খুলুন")}
              </span>
              <span className="ml-auto flex items-center gap-1.5">
                <Kbd>N</Kbd> {t("new order from anywhere", "যেকোনো জায়গা থেকে নতুন অর্ডার")}
              </span>
            </div>
          </div>
        </div>
  );
}

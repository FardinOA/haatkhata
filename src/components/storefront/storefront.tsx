"use client";

import { ArrowLeft, Check, Handbag, MagnifyingGlass, MessengerLogo, Minus, Phone, Plus, Trash, WhatsappLogo, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { makeFormatters } from "@/lib/format";
import { DISTRICTS } from "@/lib/geo";
import type { PublicCatalogue } from "@/server/public/storefront";
import { brandStyle, SellerMark, Swatch } from "./public-kit";

type Product = PublicCatalogue["products"][number];
type Line = { variantId: string; qty: number };
type Lang = "en" | "bn";

const BN_TO_LATIN = (s: string) => s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
const validPhone = (p: string) => /^01[3-9]\d{8}$/.test(BN_TO_LATIN(p).replace(/\D/g, "").replace(/^88/, ""));

export function Storefront({ data }: { data: PublicCatalogue }) {
  const [lang, setLang] = useState<Lang>("bn");
  const t = (en: string, bn: string) => (lang === "bn" ? bn : en);
  const f = useMemo(() => makeFormatters({ lang, numerals: "latin" }), [lang]);
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Product | null>(null);
  const [bag, setBag] = useState<Line[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [step, setStep] = useState<"bag" | "details" | "done">("bag");
  const [result, setResult] = useState<{ orderNo: number | null; total: number } | null>(null);

  const variantIndex = useMemo(() => {
    const m = new Map<string, { p: Product; v: Product["variants"][number] }>();
    for (const p of data.products) for (const v of p.variants) m.set(v.id, { p, v });
    return m;
  }, [data.products]);

  const shown = data.products.filter((p) => (cat === "all" || p.categoryId === cat) && (!q.trim() || `${p.name} ${p.nameBn ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())));
  const count = bag.reduce((s, l) => s + l.qty, 0);
  const subtotal = bag.reduce((s, l) => s + (variantIndex.get(l.variantId)?.v.price ?? 0) * l.qty, 0);
  const shopName = lang === "bn" && data.business.nameBn ? data.business.nameBn : data.business.name;
  const pName = (p: Product) => (lang === "bn" && p.nameBn ? p.nameBn : p.name);

  const add = (variantId: string, qty = 1) => {
    setBag((b) => {
      const hit = b.find((l) => l.variantId === variantId);
      return hit ? b.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(20, l.qty + qty) } : l)) : [...b, { variantId, qty }];
    });
  };

  const summary = bag
    .map((l) => {
      const hit = variantIndex.get(l.variantId);
      if (!hit) return "";
      const opt = Object.values(hit.v.options).join(" / ");
      return `• ${hit.p.name}${opt ? ` (${opt})` : ""} × ${l.qty} = ৳${(hit.v.price * l.qty).toLocaleString("en-IN")}`;
    })
    .join("\n");
  const waHref = data.whatsapp ? `https://wa.me/88${data.whatsapp}?text=${encodeURIComponent(`${t("Hi! I'd like to order:", "আসসালামু আলাইকুম! অর্ডার করতে চাই:")}\n${summary}`)}` : null;
  const msHref = data.messenger ? `https://m.me/${data.messenger}?text=${encodeURIComponent(`${t("I'd like to order:", "অর্ডার করতে চাই:")}\n${summary}`)}` : null;

  return (
    <div lang={lang} style={brandStyle(data.business.accent)} className="min-h-dvh bg-canvas pb-28 lg:pb-12">
      {/* Shop header */}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 py-4 md:px-8">
          <SellerMark name={data.business.name} logo={data.business.logo} shape={data.business.logoShape} size={48} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[22px] font-semibold leading-tight text-ink">{shopName}</h1>
            {data.business.tagline && <p className="truncate text-[13px] text-ink-3">{data.business.tagline}</p>}
          </div>
          {data.business.phone && (
            <a href={`tel:${data.business.phone}`} className="hidden h-10 items-center gap-2 rounded-full border border-line px-4 text-[13px] font-medium text-ink-2 hover:border-line-strong sm:inline-flex">
              <Phone className="size-4" />
              {data.business.phone}
            </a>
          )}
          <button type="button" onClick={() => setLang(lang === "bn" ? "en" : "bn")} className="h-10 rounded-full px-3 text-[13px] font-medium text-ink-2 hover:bg-sunken">
            {lang === "bn" ? "English" : "বাংলা"}
          </button>
        </div>
        {data.banner && (
          <p className="border-t border-line bg-brand-50 px-4 py-2.5 text-center text-[13.5px] font-medium text-brand-ink">{data.banner}</p>
        )}
      </header>

      <div className="mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)] gap-8 px-4 pt-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <main>
          {/* Find */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <span className="sr-only">{t("Search products", "পণ্য খুঁজুন")}</span>
              <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search products", "পণ্য খুঁজুন")} className="h-11 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:shadow-[var(--ring)] focus:outline-none" />
            </label>
          </div>
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" role="tablist" aria-label={t("Categories", "ক্যাটাগরি")}>
            {[{ id: "all", name: "All", nameBn: "সব" }, ...data.categories].map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={cat === c.id}
                onClick={() => setCat(c.id)}
                className={`h-9 shrink-0 rounded-full px-4 text-[13px] font-medium transition-colors ${cat === c.id ? "bg-ink text-white" : "border border-line bg-surface text-ink-2 hover:border-line-strong"}`}
              >
                {lang === "bn" ? c.nameBn || c.name : c.name}
              </button>
            ))}
          </div>

          {/* Products */}
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
            {shown.map((p) => {
              const prices = p.variants.map((v) => v.price);
              const min = Math.min(...prices);
              const max = Math.max(...prices);
              const soldOut = p.variants.every((v) => !v.inStock);
              const inBag = bag.filter((l) => variantIndex.get(l.variantId)?.p.id === p.id).reduce((s, l) => s + l.qty, 0);
              const mrp = p.variants[0]?.mrp;
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => setOpen(p)} className="group block w-full overflow-hidden rounded-lg border border-line bg-surface text-left shadow-1 transition-all hover:-translate-y-0.5 hover:shadow-2">
                    <span className="relative block aspect-[4/5] overflow-hidden bg-sunken">
                      {p.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0]} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                      ) : (
                        <Swatch hue={p.art.hue} pattern={p.art.pattern} label={pName(p)} tile={110} className="size-full transition-transform duration-500 group-hover:scale-[1.03]" />
                      )}
                      {soldOut && <span className="absolute inset-x-0 bottom-0 bg-ink/75 py-1.5 text-center text-xs font-semibold text-white">{t("Sold out", "স্টক শেষ")}</span>}
                      {!soldOut && p.bestseller && <span className="absolute left-2 top-2 rounded-full bg-surface/95 px-2 py-0.5 text-[11px] font-semibold text-ink">{t("Bestseller", "বেস্টসেলার")}</span>}
                      {inBag > 0 && <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-brand text-xs font-bold text-brand-contrast">{inBag}</span>}
                    </span>
                    <span className="block p-3">
                      <span className="line-clamp-2 block text-[14px] font-medium leading-snug text-ink">{pName(p)}</span>
                      <span className="mt-1.5 flex items-baseline gap-2">
                        <span className="figure text-[17px] font-semibold text-ink">{min === max ? f.money(min) : `${f.money(min)}–${f.money(max).replace("৳", "")}`}</span>
                        {mrp && mrp > min && <span className="tnum text-xs text-ink-4 line-through">{f.money(mrp)}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {shown.length === 0 && <p className="py-16 text-center text-sm text-ink-3">{t("Nothing matches that. Try another word.", "কিছু মেলেনি। অন্য শব্দে খুঁজুন।")}</p>}
        </main>

        {/* Desktop bag */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 rounded-xl border border-line bg-surface shadow-1">
            <Bag {...{ data, bag, setBag, variantIndex, f, t, lang, subtotal, step, setStep, result, setResult, waHref, msHref, pName }} />
          </div>
        </aside>
      </div>

      {/* Mobile bag bar + sheet */}
      {count > 0 && !bagOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 p-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
          <button type="button" onClick={() => setBagOpen(true)} className="flex h-12 w-full items-center gap-3 rounded-md bg-brand px-4 text-brand-contrast">
            <Handbag className="size-5" weight="fill" />
            <span className="text-sm font-semibold">{t(`${count} in your bag`, `ব্যাগে ${count}টি`)}</span>
            <span className="figure ml-auto text-lg font-semibold">{f.money(subtotal)}</span>
          </button>
        </div>
      )}
      {bagOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t("Your bag", "আপনার ব্যাগ")}>
          <div className="absolute inset-0 bg-ink/30" onClick={() => setBagOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-xl bg-surface pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-end p-2">
              <button type="button" onClick={() => setBagOpen(false)} className="grid size-10 place-items-center rounded-full text-ink-3 hover:bg-sunken" aria-label={t("Close", "বন্ধ")}>
                <X className="size-5" />
              </button>
            </div>
            <Bag {...{ data, bag, setBag, variantIndex, f, t, lang, subtotal, step, setStep, result, setResult, waHref, msHref, pName }} />
          </div>
        </div>
      )}

      {open && <ProductSheet p={open} lang={lang} t={t} f={f} showStock={data.showStock} onClose={() => setOpen(null)} onAdd={(vid, qty) => (add(vid, qty), setOpen(null))} pName={pName} />}

      <footer className="mx-auto mt-16 max-w-[1180px] px-4 text-center text-xs text-ink-4 md:px-8">
        <p>{t("Prices include VAT where applicable. Pay cash when the parcel arrives.", "প্রযোজ্য ক্ষেত্রে ভ্যাটসহ দাম। পার্সেল হাতে পেয়ে টাকা দিন।")}</p>
        <p className="mt-2">
          {t("Catalogue by", "ক্যাটালগ তৈরি")}{" "}
          <Link href="/" className="font-semibold text-ink-3 hover:text-ink">
            BechaKena
          </Link>
        </p>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------ product sheet */

function ProductSheet({ p, t, f, showStock, onClose, onAdd, pName }: { p: Product; lang: Lang; t: (en: string, bn: string) => string; f: ReturnType<typeof makeFormatters>; showStock: boolean; onClose: () => void; onAdd: (variantId: string, qty: number) => void; pName: (p: Product) => string }) {
  const firstAvailable = p.variants.find((v) => v.inStock) ?? p.variants[0];
  const [sel, setSel] = useState<Record<string, string>>(firstAvailable.options);
  const [qty, setQty] = useState(1);
  const ref = useRef<HTMLDivElement>(null);
  const variant = p.variants.find((v) => Object.entries(sel).every(([k, val]) => v.options[k] === val)) ?? (p.optionTypes.length ? undefined : p.variants[0]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid items-end sm:place-items-center sm:p-6" role="dialog" aria-modal="true" aria-label={pName(p)}>
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className="relative grid max-h-[94dvh] w-full overflow-y-auto rounded-t-xl bg-surface shadow-3 focus:outline-none sm:max-w-[820px] sm:grid-cols-2 sm:rounded-xl">
        <div className="relative aspect-square bg-sunken sm:aspect-auto sm:min-h-[460px]">
          {p.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.images[0]} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <Swatch hue={p.art.hue} pattern={p.art.pattern} label={pName(p)} tile={150} className="absolute inset-0 size-full" />
          )}
          <button type="button" onClick={onClose} className="absolute left-3 top-3 grid size-10 place-items-center rounded-full bg-surface/95 text-ink shadow-1" aria-label={t("Back", "পেছনে")}>
            <ArrowLeft className="size-5" />
          </button>
        </div>
        <div className="flex flex-col p-5 sm:p-6">
          <h2 className="font-display text-2xl font-semibold leading-tight text-ink">{pName(p)}</h2>
          <p className="figure mt-2 text-[26px] font-semibold text-ink">{variant ? f.money(variant.price) : "—"}</p>
          {p.description && <p className="mt-3 text-sm leading-relaxed text-ink-2">{p.description}</p>}
          {p.optionTypes.map((ot) => (
            <fieldset key={ot.name} className="mt-5">
              <legend className="mb-2 text-[13px] font-medium text-ink-2">{ot.name}</legend>
              <div className="flex flex-wrap gap-2">
                {ot.values.map((val) => {
                  const candidate = p.variants.find((v) => Object.entries({ ...sel, [ot.name]: val }).every(([k, x]) => v.options[k] === x));
                  const out = !candidate?.inStock;
                  const on = sel[ot.name] === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSel({ ...sel, [ot.name]: val })}
                      className={`h-10 min-w-11 rounded-md border px-3.5 text-[13.5px] font-medium transition-colors ${on ? "border-brand bg-brand-50 text-ink" : "border-line text-ink-2 hover:border-line-strong"} ${out ? "text-ink-4 line-through decoration-1" : ""}`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <p className="mt-4 text-[13px]">
            {!variant ? (
              <span className="text-ink-3">{t("Pick an option", "একটি বেছে নিন")}</span>
            ) : variant.inStock ? (
              <span className="text-ok">{showStock && variant.left !== null ? t(`${variant.left} in stock`, `${variant.left}টি আছে`) : t("In stock", "স্টকে আছে")}</span>
            ) : (
              <span className="text-danger">{t("Sold out in this option", "এই অপশনে স্টক শেষ")}</span>
            )}
          </p>
          <div className="mt-auto flex items-center gap-3 pt-6">
            <div className="inline-flex h-12 items-center rounded-md border border-line">
              <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-full w-11 place-items-center text-ink-2" aria-label={t("Fewer", "কম")}>
                <Minus className="size-4" />
              </button>
              <span className="tnum w-8 text-center font-semibold">{qty}</span>
              <button type="button" onClick={() => setQty(Math.min(20, qty + 1))} className="grid h-full w-11 place-items-center text-ink-2" aria-label={t("More", "বেশি")}>
                <Plus className="size-4" />
              </button>
            </div>
            <button type="button" disabled={!variant?.inStock} onClick={() => variant && onAdd(variant.id, qty)} className="h-12 flex-1 rounded-md bg-brand text-[15px] font-semibold text-brand-contrast transition-[filter] hover:brightness-110 disabled:opacity-40">
              {t("Add to bag", "ব্যাগে যোগ করুন")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ bag & checkout */

function Bag({
  data,
  bag,
  setBag,
  variantIndex,
  f,
  t,
  lang,
  subtotal,
  step,
  setStep,
  result,
  setResult,
  waHref,
  msHref,
  pName,
}: {
  data: PublicCatalogue;
  bag: Line[];
  setBag: (fn: (b: Line[]) => Line[]) => void;
  variantIndex: Map<string, { p: Product; v: Product["variants"][number] }>;
  f: ReturnType<typeof makeFormatters>;
  t: (en: string, bn: string) => string;
  lang: Lang;
  subtotal: number;
  step: "bag" | "details" | "done";
  setStep: (s: "bag" | "details" | "done") => void;
  result: { orderNo: number | null; total: number } | null;
  setResult: (r: { orderNo: number | null; total: number }) => void;
  waHref: string | null;
  msHref: string | null;
  pName: (p: Product) => string;
}) {
  const [form, setForm] = useState({ name: "", phone: "", line: "", area: "", district: "Dhaka", note: "", company: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const delivery = form.district === "Dhaka" ? data.delivery.inside : data.delivery.outside;
  const phoneOk = validPhone(form.phone);
  const ready = form.name.trim().length >= 2 && phoneOk && form.line.trim().length >= 3;

  if (step === "done" && result)
    return (
      <div className="p-6 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-ok-soft text-ok">
          <Check className="size-7" weight="bold" />
        </span>
        <h3 className="mt-4 font-display text-xl font-semibold text-ink">{t("Order sent!", "অর্ডার পাঠানো হয়েছে!")}</h3>
        <p className="mt-2 text-sm text-ink-2">
          {result.orderNo ? t(`Your reference is #${result.orderNo}. `, `আপনার রেফারেন্স #${result.orderNo}। `) : ""}
          {t(`${data.business.name} will call you to confirm before sending.`, `পাঠানোর আগে ${data.business.nameBn || data.business.name} ফোন করে নিশ্চিত করবে।`)}
        </p>
        <p className="figure mt-4 text-2xl font-semibold text-ink">{f.money(result.total)}</p>
        <p className="text-xs text-ink-3">{t("to pay on delivery", "ডেলিভারির সময় দিতে হবে")}</p>
      </div>
    );

  if (!bag.length)
    return (
      <div className="p-6 text-center">
        <Handbag className="mx-auto size-8 text-ink-4" />
        <p className="mt-3 text-sm font-medium text-ink">{t("Your bag is empty", "আপনার ব্যাগ খালি")}</p>
        <p className="mt-1 text-[13px] text-ink-3">{t("Tap a product to add it.", "পণ্যে ট্যাপ করে যোগ করুন।")}</p>
      </div>
    );

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/storefront/${data.slug}/order`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.name, phone: form.phone, address: { line: form.line, area: form.area, district: form.district }, note: form.note || undefined, lines: bag, company: form.company }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't send the order");
      setResult(body);
      setStep("done");
      setBag(() => []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = "h-11 w-full rounded-md border border-line-strong/80 bg-surface px-3 text-sm text-ink placeholder:text-ink-4 focus:border-brand focus:shadow-[var(--ring)] focus:outline-none";
  return (
    <div className="p-5">
      <h3 className="font-display text-lg font-semibold text-ink">{step === "bag" ? t("Your bag", "আপনার ব্যাগ") : t("Where should we deliver?", "কোথায় পাঠাব?")}</h3>
      {step === "bag" ? (
        <ul className="mt-3 divide-y divide-line">
          {bag.map((l) => {
            const hit = variantIndex.get(l.variantId);
            if (!hit) return null;
            return (
              <li key={l.variantId} className="flex items-center gap-3 py-3">
                <span className="size-12 shrink-0 overflow-hidden rounded-md bg-sunken">
                  {hit.p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={hit.p.images[0]} alt="" className="size-full object-cover" />
                  ) : (
                    <Swatch hue={hit.p.art.hue} pattern={hit.p.art.pattern} label="" className="size-full" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{pName(hit.p)}</span>
                  <span className="block truncate text-xs text-ink-3">{[Object.values(hit.v.options).join(" / "), `${l.qty} × ${f.money(hit.v.price)}`].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="flex items-center">
                  <button type="button" onClick={() => setBag((b) => b.map((x) => (x.variantId === l.variantId ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))} className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-sunken" aria-label={t("Fewer", "কম")}>
                    <Minus className="size-3.5" />
                  </button>
                  <span className="tnum w-5 text-center text-sm font-semibold">{l.qty}</span>
                  <button type="button" onClick={() => setBag((b) => b.map((x) => (x.variantId === l.variantId ? { ...x, qty: Math.min(20, x.qty + 1) } : x)))} className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-sunken" aria-label={t("More", "বেশি")}>
                    <Plus className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => setBag((b) => b.filter((x) => x.variantId !== l.variantId))} className="grid size-8 place-items-center rounded-full text-ink-4 hover:bg-danger-soft hover:text-danger" aria-label={t("Remove", "সরান")}>
                    <Trash className="size-3.5" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-4 grid gap-3">
          <input className={field} placeholder={t("Your name", "আপনার নাম")} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label={t("Your name", "আপনার নাম")} />
          <div>
            <input className={field} placeholder="01XXXXXXXXX" inputMode="tel" autoComplete="tel-national" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-label={t("Mobile number", "মোবাইল নম্বর")} aria-invalid={!!form.phone && !phoneOk} />
            {form.phone && !phoneOk && <p className="mt-1 text-xs text-danger">{t("Use a Bangladeshi mobile number", "বাংলাদেশি মোবাইল নম্বর দিন")}</p>}
          </div>
          <input className={field} placeholder={t("House, road, flat", "বাসা, রোড, ফ্ল্যাট")} autoComplete="street-address" value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })} aria-label={t("Address", "ঠিকানা")} />
          <div className="grid grid-cols-2 gap-2">
            <input className={field} placeholder={t("Area / thana", "এলাকা / থানা")} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} aria-label={t("Area", "এলাকা")} />
            <select className={field} value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} aria-label={t("District", "জেলা")}>
              {DISTRICTS.map(([en, bn]) => (
                <option key={en} value={en}>
                  {lang === "bn" ? bn : en}
                </option>
              ))}
            </select>
          </div>
          <textarea className={`${field} h-auto min-h-16 py-2.5`} rows={2} placeholder={t("Note for the shop (optional)", "দোকানের জন্য নোট (ঐচ্ছিক)")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} aria-label={t("Note", "নোট")} />
          {/* Honeypot: hidden from people, irresistible to bots. */}
          <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] size-px opacity-0" name="company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        </div>
      )}

      <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
        <div className="flex justify-between text-ink-2">
          <dt>{t("Items", "পণ্য")}</dt>
          <dd className="tnum">{f.money(subtotal)}</dd>
        </div>
        <div className="flex justify-between text-ink-2">
          <dt>{step === "details" ? (form.district === "Dhaka" ? t("Delivery inside Dhaka", "ঢাকার ভিতরে ডেলিভারি") : t("Delivery outside Dhaka", "ঢাকার বাইরে ডেলিভারি")) : t("Delivery", "ডেলিভারি")}</dt>
          <dd className="tnum">{step === "details" ? f.money(delivery) : `${f.money(data.delivery.inside)}–${f.money(data.delivery.outside).replace("৳", "")}`}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-ink">
          <dt>{t("Pay on delivery", "ডেলিভারিতে দিবেন")}</dt>
          <dd className="figure text-lg">{f.money(subtotal + (step === "details" ? delivery : data.delivery.inside))}</dd>
        </div>
      </dl>
      {error && <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}
      {step === "bag" ? (
        <button type="button" onClick={() => setStep("details")} className="mt-4 h-12 w-full rounded-md bg-brand text-[15px] font-semibold text-brand-contrast hover:brightness-110">
          {t("Continue", "এগিয়ে যান")}
        </button>
      ) : (
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setStep("bag")} className="h-12 rounded-md px-4 text-sm font-medium text-ink-2 hover:bg-sunken">
            {t("Back", "পেছনে")}
          </button>
          <button type="button" disabled={!ready || busy} onClick={send} className="h-12 flex-1 rounded-md bg-brand text-[15px] font-semibold text-brand-contrast hover:brightness-110 disabled:opacity-40">
            {busy ? t("Sending…", "পাঠানো হচ্ছে…") : t("Send order", "অর্ডার পাঠান")}
          </button>
        </div>
      )}
      {(waHref || msHref) && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-xs text-ink-3">{t("Prefer to chat?", "চ্যাটে অর্ডার করতে চান?")}</p>
          <div className="mt-2 flex gap-2">
            {waHref && (
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-line text-[13px] font-medium text-ink hover:border-line-strong">
                <WhatsappLogo className="size-4" weight="fill" style={{ color: "#1FA855" }} />
                WhatsApp
              </a>
            )}
            {msHref && (
              <a href={msHref} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-line text-[13px] font-medium text-ink hover:border-line-strong">
                <MessengerLogo className="size-4" weight="fill" style={{ color: "#1877F2" }} />
                Messenger
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

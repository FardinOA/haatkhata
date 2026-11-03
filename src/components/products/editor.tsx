"use client";

import {
  ArrowLeft,
  ArrowRight,
  CaretLeft,
  CopySimple,
  DotsThree,
  ImageSquare,
  Plus,
  ShareNetwork,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductThumb } from "../bits";
import { Badge, Button, cn, Field, IconButton, Input, Panel, Select, Switch, Textarea } from "../ui/core";
import { Menu, useConfirm, useToast } from "../ui/overlays";
import { CardArt } from "./card-art";
import { ChipInput } from "./chip-input";
import { ProductRail } from "./product-rail";
import { ShareCardSheet } from "./share-card";
import { compressImage, margin, nextSku, skuPrefixFrom, swatchFor } from "./utils";
import { useCan, useFmt, useT } from "@/lib/hooks";
import { uid } from "@/lib/base-data";
import { useStore } from "@/lib/store";
import type { BundleComponent, OptionType, PatternId, Product, Variant } from "@/lib/types";
import { ComboBatchSection } from "./combo-batch-section";

const UNITS = ["pcs", "set", "pair", "dozen", "kg", "g", "litre", "metre"];
const HUES = ["#B23A48", "#D2401F", "#D79A1E", "#6F8F2E", "#0E6B53", "#0A7CA8", "#3446C4", "#7A45C2", "#C2306B", "#E58F7A", "#A68A5B", "#6B4A33", "#5E6A71", "#1D1F21"];
const PATTERNS: PatternId[] = ["plain", "stripe", "check", "dots", "wave", "diamond", "paisley", "weave"];
const OPTION_SUGGESTIONS: { name: string; bn: string; values: string[] }[] = [
  { name: "Size", bn: "সাইজ", values: ["S", "M", "L", "XL"] },
  { name: "Colour", bn: "রং", values: [] },
  { name: "Fabric", bn: "কাপড়", values: [] },
];

type Draft = {
  id: string;
  name: string;
  nameBn: string;
  categoryId: string;
  unit: string;
  description: string;
  tags: string[];
  status: "active" | "inactive";
  images: string[];
  art: Product["art"];
  optionTypes: OptionType[];
  variants: Variant[];
  price: number;
  mrp: number;
  cost: number;
  prefix: string;
  trackBatches: boolean;
  combo: boolean;
  bundle: BundleComponent[];
};

type Errors = Partial<Record<"name" | "price" | "options" | "variants", string>> & { sku?: Record<string, string>; vprice?: Record<string, string> };

const comboKey = (o: Record<string, string>) => JSON.stringify(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

function fromProduct(p: Product): Draft {
  const v0 = p.variants[0];
  return {
    id: p.id,
    name: p.name,
    nameBn: p.nameBn ?? "",
    categoryId: p.categoryId,
    unit: p.unit,
    description: p.description ?? "",
    tags: [...p.tags],
    status: p.status,
    images: [...p.images],
    art: { ...p.art },
    optionTypes: p.optionTypes.map((o) => ({ name: o.name, values: [...o.values] })),
    variants: p.variants.map((v) => ({ ...v, options: { ...v.options } })),
    price: v0?.price ?? 0,
    mrp: v0?.mrp ?? 0,
    cost: v0?.cost ?? 0,
    prefix: v0?.sku.split("-")[0] ?? "PRD",
    trackBatches: !!p.trackBatches,
    combo: !!p.bundle?.length,
    bundle: (p.bundle ?? []).map((b) => ({ ...b })),
  };
}

function blankDraft(categoryId: string, taken: Set<string>): Draft {
  const prefix = "NEW";
  return {
    id: uid("p_"),
    name: "",
    nameBn: "",
    categoryId,
    unit: "pcs",
    description: "",
    tags: [],
    status: "active",
    images: [],
    art: { hue: HUES[Math.floor(Math.random() * 10)], pattern: "stripe" },
    optionTypes: [],
    variants: [{ id: uid("v_"), sku: nextSku(prefix, taken), options: {}, price: 0, cost: 0, onHand: 0, reserved: 0, inTransit: 0, damaged: 0, lowStock: 5, active: true }],
    price: 0,
    mrp: 0,
    cost: 0,
    prefix,
    trackBatches: false,
    combo: false,
    bundle: [],
  };
}

/**
 * Rebuilds the variant list for a new set of options. Existing combinations
 * keep their id (and so their stock); a lone default variant becomes the first
 * combination; variants that disappear but still hold stock are kept, switched off.
 */
function regenerate(d: Draft, optionTypes: OptionType[], otherSkus: Set<string>): Variant[] {
  const usable = optionTypes.filter((o) => o.name.trim() && o.values.length);
  const combos: Record<string, string>[] = usable.length
    ? usable.reduce<Record<string, string>[]>((acc, o) => acc.flatMap((c) => o.values.map((v) => ({ ...c, [o.name.trim()]: v }))), [{}])
    : [{}];
  const byKey = new Map(d.variants.map((v) => [comboKey(v.options), v]));
  const taken = new Set([...otherSkus, ...d.variants.map((v) => v.sku.toUpperCase())]);
  const lone = d.variants.length === 1 && !Object.keys(d.variants[0].options).length ? d.variants[0] : null;
  let loneUsed = false;
  const next = combos.map((options): Variant => {
    const hit = byKey.get(comboKey(options));
    if (hit) return { ...hit, options };
    if (lone && !loneUsed) {
      loneUsed = true;
      return { ...lone, options };
    }
    const sku = nextSku(d.prefix || "PRD", taken);
    taken.add(sku);
    return { id: uid("v_"), sku, options, price: d.price, cost: d.cost, mrp: d.mrp || undefined, onHand: 0, reserved: 0, inTransit: 0, damaged: 0, lowStock: 5, active: true };
  });
  const keep = new Set(next.map((v) => v.id));
  const orphans = d.variants.filter((v) => !keep.has(v.id) && (v.onHand > 0 || v.reserved > 0 || v.inTransit > 0)).map((v) => ({ ...v, active: false }));
  return [...next, ...orphans];
}

export function ProductEditor({ productId }: { productId?: string }) {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const router = useRouter();
  const toast = useToast();
  const [confirm, confirmNode] = useConfirm();
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const saveProduct = useStore((s) => s.saveProduct);
  const deleteProduct = useStore((s) => s.deleteProduct);
  const duplicateProduct = useStore((s) => s.duplicateProduct);
  const addCategory = useStore((s) => s.addCategory);
  const existing = productId ? products.find((p) => p.id === productId) : undefined;
  const isNew = !productId;

  const otherSkus = useMemo(
    () => new Set(products.filter((p) => p.id !== productId).flatMap((p) => p.variants.map((v) => v.sku.toUpperCase()))),
    [products, productId],
  );

  const [draft, setDraft] = useState<Draft>(() => (existing ? fromProduct(existing) : blankDraft(categories[0]?.id ?? "", otherSkus)));
  const [initial, setInitial] = useState(() => JSON.stringify(draft));
  const [opening, setOpening] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [newCat, setNewCat] = useState<string | null>(null);
  const [prefixTouched, setPrefixTouched] = useState(!isNew);
  const [shareOpen, setShareOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(draft) !== initial || Object.values(opening).some(Boolean);
  const showCost = can("view_cost");
  const canPrice = can("edit_price") || isNew;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (productId && !existing) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="font-display text-xl font-semibold text-ink">{t("This product no longer exists", "এই পণ্যটি আর নেই")}</p>
        <p className="mt-2 text-sm text-ink-3">{t("It may have been deleted on another device.", "হয়তো অন্য ডিভাইস থেকে মুছে ফেলা হয়েছে।")}</p>
        <Link href="/products" className="mt-6 inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-contrast">
          {t("Back to products", "পণ্যে ফিরে যান")}
        </Link>
      </div>
    );
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  /* ---------------- variants */


  const setOptions = (optionTypes: OptionType[]) => setDraft((d) => ({ ...d, optionTypes, variants: regenerate(d, optionTypes, otherSkus) }));

  const updateVariant = (id: string, patch: Partial<Variant>) => setDraft((d) => ({ ...d, variants: d.variants.map((v) => (v.id === id ? { ...v, ...patch } : v)) }));

  /** Base price changes flow into variants that still match the old base. */
  const setBase = (k: "price" | "cost" | "mrp", value: number) =>
    setDraft((d) => ({
      ...d,
      [k]: value,
      variants: d.variants.map((v) => {
        const cur = k === "mrp" ? (v.mrp ?? 0) : v[k];
        return cur === d[k] ? { ...v, [k]: k === "mrp" ? value || undefined : value } : v;
      }),
    }));

  const applyAll = () =>
    setDraft((d) => ({ ...d, variants: d.variants.map((v) => ({ ...v, price: d.price, cost: d.cost, mrp: d.mrp || undefined })) }));

  const onName = (name: string) =>
    setDraft((d) => {
      if (prefixTouched || !isNew) return { ...d, name };
      const prefix = skuPrefixFrom(name);
      const taken = new Set(otherSkus);
      const variants = d.variants.map((v) => {
        const sku = nextSku(prefix, taken);
        taken.add(sku);
        return { ...v, sku };
      });
      return { ...d, name, prefix, variants };
    });

  /* ---------------- images */

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = 5 - draft.images.length;
    const list = [...files].filter((file) => file.type.startsWith("image/")).slice(0, room);
    if (!list.length) {
      toast({ title: t("You can add up to 5 photos", "সর্বোচ্চ ৫টি ছবি"), tone: "warn" });
      return;
    }
    try {
      const urls = await Promise.all(list.map((file) => compressImage(file)));
      setDraft((d) => ({ ...d, images: [...d.images, ...urls].slice(0, 5) }));
    } catch {
      toast({ title: t("That photo couldn't be read", "ছবিটি পড়া যায়নি"), body: t("Try a JPG or PNG file.", "JPG বা PNG দিন।"), tone: "warn" });
    }
  };

  const moveImage = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const imgs = [...d.images];
      const j = i + dir;
      if (j < 0 || j >= imgs.length) return d;
      [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
      return { ...d, images: imgs };
    });

  /* ---------------- save */

  const validate = (): Errors => {
    const e: Errors = {};
    if (!draft.name.trim()) e.name = t("Give the product a name customers will recognise.", "পণ্যের একটি নাম দিন।");
    const active = draft.variants.filter((v) => v.active);
    if (!active.length) e.variants = t("Keep at least one variant switched on.", "অন্তত একটি ভ্যারিয়েন্ট চালু রাখুন।");
    const names = draft.optionTypes.map((o) => o.name.trim().toLowerCase());
    if (draft.optionTypes.some((o) => !o.name.trim())) e.options = t("Every option needs a name, like Size or Colour.", "প্রতিটি অপশনের নাম দিন, যেমন সাইজ বা রং।");
    else if (new Set(names).size !== names.length) e.options = t("Two options have the same name.", "দুটি অপশনের নাম একই।");
    else if (draft.optionTypes.some((o) => !o.values.length)) e.options = t("Add at least one value to each option.", "প্রতিটি অপশনে অন্তত একটি মান দিন।");
    if (draft.combo && !draft.bundle.length) e.variants = t("Add the items that make up this combo.", "কম্বোর ভেতরের পণ্যগুলো যোগ করুন।");
    if (draft.combo && draft.optionTypes.length) e.options = t("A combo sells as one item — remove sizes and colours.", "কম্বো একটি পণ্য — সাইজ ও রং সরান।");
    const sku: Record<string, string> = {};
    const vprice: Record<string, string> = {};
    const seen = new Set<string>();
    for (const v of draft.variants) {
      const s = v.sku.trim().toUpperCase();
      if (!s) sku[v.id] = t("SKU is required", "SKU লাগবে");
      else if (otherSkus.has(s)) sku[v.id] = t("Used by another product", "অন্য পণ্যে আছে");
      else if (seen.has(s)) sku[v.id] = t("Duplicate SKU", "একই SKU");
      seen.add(s);
      if (v.active && !(v.price > 0)) vprice[v.id] = t("Set a price", "দাম দিন");
    }
    if (Object.keys(sku).length) e.sku = sku;
    if (Object.keys(vprice).length) {
      e.vprice = vprice;
      if (!(draft.price > 0)) e.price = t("Set a selling price above ৳0.", "৳০ এর বেশি দাম দিন।");
    }
    return e;
  };

  const save = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      toast({ title: t("A few things need fixing", "কিছু জিনিস ঠিক করতে হবে"), body: t("They're marked in red below.", "নিচে লাল দিয়ে দেখানো হয়েছে।"), tone: "warn" });
      requestAnimationFrame(() => document.querySelector("[aria-invalid=true], [data-error=true]")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setSaving(true);
    const product: Product = {
      id: draft.id,
      name: draft.name.trim(),
      nameBn: draft.nameBn.trim() || undefined,
      categoryId: draft.categoryId,
      unit: draft.unit,
      description: draft.description.trim(),
      images: draft.images,
      art: draft.art,
      optionTypes: draft.optionTypes.map((o) => ({ name: o.name.trim(), values: o.values })),
      variants: draft.variants.map((v) => ({ ...v, sku: v.sku.trim().toUpperCase(), barcode: v.barcode?.trim() || undefined })),
      status: draft.status,
      tags: draft.tags,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      trackBatches: draft.trackBatches || undefined,
      bundle: draft.combo && draft.bundle.length ? draft.bundle : undefined,
    };
    saveProduct(product, isNew && !(draft.combo && draft.bundle.length) ? opening : undefined);
    setSaving(false);
    toast({ title: isNew ? t("Product added", "পণ্য যোগ হয়েছে") : t("Changes saved", "পরিবর্তন সেভ হয়েছে") });
    if (isNew) {
      router.replace(`/products/${product.id}`);
    } else {
      setInitial(JSON.stringify(draft));
    }
  };

  const discard = () => {
    const base = existing ? fromProduct(existing) : blankDraft(categories[0]?.id ?? "", otherSkus);
    setDraft(base);
    setInitial(JSON.stringify(base));
    setOpening({});
    setErrors({});
  };

  const remove = async () => {
    if (!existing) return;
    const held = existing.variants.reduce((s, v) => s + v.onHand + v.inTransit, 0);
    const ok = await confirm({
      title: t(`Delete ${existing.name}?`, `${existing.nameBn || existing.name} মুছবেন?`),
      body: held
        ? t(`${held} units are still in stock or with couriers. Past orders keep their details, but this product and its stock history will be removed.`, `${f.num(held)}টি এখনো স্টকে বা কুরিয়ারে আছে। পুরনো অর্ডার ঠিক থাকবে, কিন্তু পণ্য ও স্টক হিস্টরি মুছে যাবে।`)
        : t("Past orders keep their details. You can't undo this.", "পুরনো অর্ডার ঠিক থাকবে। এটি ফেরানো যাবে না।"),
      confirm: t("Delete product", "পণ্য মুছুন"),
      cancel: t("Keep it", "রেখে দিন"),
      danger: true,
    });
    if (!ok) return;
    deleteProduct(existing.id);
    toast({ title: t("Product deleted", "পণ্য মুছে ফেলা হয়েছে") });
    router.push("/products");
  };

  const marginPct = margin(draft.price, draft.cost);
  const preview = { name: draft.name || t("Product name", "পণ্যের নাম"), art: draft.art, images: draft.images };
  const activeCount = draft.variants.filter((v) => v.active).length;

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-5 md:px-8 md:pt-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/products" className="inline-flex h-9 items-center gap-1 rounded-md pr-2 text-[13px] font-medium text-ink-3 hover:text-ink">
          <CaretLeft className="size-4" />
          {t("Products", "পণ্য")}
        </Link>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <ProductThumb product={preview} size={48} rounded="md" />
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-semibold tracking-[-0.02em] text-ink md:text-[28px]">
              {isNew ? draft.name || t("New product", "নতুন পণ্য") : draft.name || existing?.name}
            </h1>
            <p className="text-[13px] text-ink-3">
              {isNew ? t("Fill in what you know — you can change everything later.", "যা জানেন তা দিন — পরে সব বদলানো যাবে।") : t(`${f.num(activeCount)} variants · added ${f.dateShort(existing!.createdAt)}`, `${f.num(activeCount)}টি ভ্যারিয়েন্ট · যোগ ${f.dateShort(existing!.createdAt)}`)}
            </p>
          </div>
        </div>
        {!isNew && existing && (
          <div className="flex items-center gap-2">
            <Button icon={<ShareNetwork className="size-4" />} onClick={() => setShareOpen(true)}>
              {t("Share card", "শেয়ার কার্ড")}
            </Button>
            <Menu
              width={210}
              items={[
                {
                  label: t("Duplicate", "কপি করুন"),
                  icon: <CopySimple />,
                  onSelect: () => {
                    const id = duplicateProduct(existing.id);
                    if (id) {
                      toast({ title: t("Copy created", "কপি তৈরি হয়েছে") });
                      router.push(`/products/${id}`);
                    }
                  },
                },
                { type: "divider" },
                { label: t("Delete product", "পণ্য মুছুন"), icon: <Trash />, danger: true, onSelect: remove, disabled: !can("delete_order") },
              ]}
              trigger={({ toggle, ref }) => (
                <IconButton ref={ref} label={t("More actions", "আরও")} variant="secondary" onClick={toggle}>
                  <DotsThree className="size-5" weight="bold" />
                </IconButton>
              )}
            />
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {/* Basics */}
          <Section title={t("Basics", "মূল তথ্য")} sub={t("What it's called and where it lives in your catalogue.", "নাম এবং ক্যাটালগে কোথায় থাকবে।")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("Name in English", "ইংরেজি নাম")} error={errors.name} htmlFor="p-name">
                <Input id="p-name" value={draft.name} onChange={(e) => onName(e.target.value)} placeholder="Cotton Three-piece" aria-invalid={!!errors.name} />
              </Field>
              <Field label={t("Name in Bangla", "বাংলা নাম")} optional={t("Optional", "ঐচ্ছিক")} htmlFor="p-namebn" hint={t("Shown on Bangla invoices and share cards.", "বাংলা ইনভয়েস ও শেয়ার কার্ডে দেখাবে।")}>
                <Input id="p-namebn" lang="bn" value={draft.nameBn} onChange={(e) => set("nameBn", e.target.value)} placeholder="সুতি থ্রি-পিস" />
              </Field>
              <Field label={t("Category", "ক্যাটাগরি")} htmlFor="p-cat">
                {newCat === null ? (
                  <div className="flex gap-2">
                    <Select id="p-cat" className="flex-1" value={draft.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {t(c.name, c.nameBn)}
                        </option>
                      ))}
                    </Select>
                    <Button icon={<Plus className="size-4" />} onClick={() => setNewCat("")} aria-label={t("New category", "নতুন ক্যাটাগরি")}>
                      <span className="hidden sm:inline">{t("New", "নতুন")}</span>
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      className="flex-1"
                      value={newCat}
                      onChange={(e) => setNewCat(e.target.value)}
                      placeholder={t("e.g. Bags", "যেমন ব্যাগ")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newCat.trim()) {
                          e.preventDefault();
                          set("categoryId", addCategory(newCat.trim()));
                          setNewCat(null);
                        } else if (e.key === "Escape") setNewCat(null);
                      }}
                    />
                    <Button
                      variant="primary"
                      disabled={!newCat.trim()}
                      onClick={() => {
                        set("categoryId", addCategory(newCat.trim()));
                        setNewCat(null);
                      }}
                    >
                      {t("Add", "যোগ")}
                    </Button>
                    <IconButton label={t("Cancel", "বাতিল")} onClick={() => setNewCat(null)}>
                      <X className="size-4" />
                    </IconButton>
                  </div>
                )}
              </Field>
              <Field label={t("Sold by", "বিক্রির একক")} htmlFor="p-unit">
                <Select id="p-unit" value={UNITS.includes(draft.unit) ? draft.unit : "pcs"} onChange={(e) => set("unit", e.target.value)}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field className="sm:col-span-2" label={t("Description", "বিবরণ")} optional={t("Optional", "ঐচ্ছিক")} htmlFor="p-desc">
                <Textarea id="p-desc" value={draft.description} onChange={(e) => set("description", e.target.value)} placeholder={t("Fabric, fit, care — what you'd tell a customer in chat.", "কাপড়, মাপ, যত্ন — চ্যাটে যা বলেন।")} />
              </Field>
              <Field label={t("Tags", "ট্যাগ")} optional={t("Optional", "ঐচ্ছিক")} hint={t("Press Enter after each tag.", "প্রতিটি ট্যাগের পর Enter চাপুন।")}>
                <ChipInput values={draft.tags} onChange={(v) => set("tags", v)} ariaLabel={t("Tags", "ট্যাগ")} placeholder="bestseller, eid, new" />
              </Field>
              <Field label={t("Visible on the POS", "POS এ দেখাবে")}>
                <label className="flex h-10 items-center gap-3 rounded-sm border border-line-strong/80 bg-surface px-3">
                  <Switch checked={draft.status === "active"} onChange={(v) => set("status", v ? "active" : "inactive")} label={t("Active", "চালু")} size="sm" />
                  <span className="text-sm text-ink-2">{draft.status === "active" ? t("Active — staff can sell it", "চালু — বিক্রি করা যাবে") : t("Hidden — kept for records", "বন্ধ — রেকর্ডে থাকবে")}</span>
                </label>
              </Field>
            </div>
          </Section>

          {/* Photos & look */}
          <Section title={t("Photos & look", "ছবি ও চেহারা")} sub={t("Up to 5 photos. No photos yet? Pick a swatch so the product is easy to spot.", "সর্বোচ্চ ৫টি ছবি। ছবি না থাকলে একটি সোয়াচ বাছুন।")}>
            <div className="flex flex-wrap gap-3">
              {draft.images.map((src, i) => (
                <div key={i} className="group relative size-24 overflow-hidden rounded-md border border-line bg-sunken sm:size-28">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={t(`Photo ${i + 1}`, `ছবি ${i + 1}`)} className="size-full object-cover" />
                  {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-surface/95 px-1.5 py-0.5 text-[10.5px] font-semibold text-ink shadow-1">{t("Cover", "কভার")}</span>}
                  <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                    <span className="flex gap-1">
                      <MiniBtn label={t("Move left", "বামে")} disabled={i === 0} onClick={() => moveImage(i, -1)}>
                        <ArrowLeft className="size-3.5" />
                      </MiniBtn>
                      <MiniBtn label={t("Move right", "ডানে")} disabled={i === draft.images.length - 1} onClick={() => moveImage(i, 1)}>
                        <ArrowRight className="size-3.5" />
                      </MiniBtn>
                    </span>
                    <MiniBtn label={t("Remove photo", "ছবি সরান")} onClick={() => set("images", draft.images.filter((_, j) => j !== i))}>
                      <Trash className="size-3.5" />
                    </MiniBtn>
                  </div>
                </div>
              ))}
              {draft.images.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    addImages(e.dataTransfer.files);
                  }}
                  className="flex size-24 flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-line-strong bg-surface-2 text-xs font-medium text-ink-3 transition-colors hover:border-brand hover:bg-brand-50 hover:text-brand-ink sm:size-28"
                >
                  <ImageSquare className="size-6" />
                  {t("Add photos", "ছবি যোগ")}
                  <span className="tnum text-[10.5px] font-normal text-ink-4">{f.num(draft.images.length)}/{f.num(5)}</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => {
                addImages(e.target.files);
                e.target.value = "";
              }} />
            </div>
            <div className={cn("mt-5 grid gap-5 sm:grid-cols-[auto_1fr]", draft.images.length && "opacity-60")}>
              <CardArt product={preview} hover={false} className="relative aspect-square w-full rounded-lg border border-line sm:w-36" />
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[13px] font-medium text-ink-2">{t("Swatch colour", "সোয়াচের রং")}</p>
                  <div className="flex flex-wrap gap-2">
                    {HUES.map((h) => (
                      <button
                        key={h}
                        type="button"
                        aria-label={h}
                        aria-pressed={draft.art.hue.toUpperCase() === h}
                        onClick={() => set("art", { ...draft.art, hue: h })}
                        className={cn("size-8 rounded-full border-2 transition-transform hover:scale-110", draft.art.hue.toUpperCase() === h ? "border-ink ring-2 ring-surface ring-inset" : "border-transparent")}
                        style={{ background: h }}
                      />
                    ))}
                    <label className="relative grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-line-strong text-ink-3 hover:border-ink-4" title={t("Custom colour", "নিজের রং")}>
                      <Plus className="size-3.5" />
                      <input type="color" value={draft.art.hue} onChange={(e) => set("art", { ...draft.art, hue: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label={t("Custom colour", "নিজের রং")} />
                    </label>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[13px] font-medium text-ink-2">{t("Pattern", "নকশা")}</p>
                  <div className="flex flex-wrap gap-2">
                    {PATTERNS.map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        aria-pressed={draft.art.pattern === pt}
                        aria-label={pt}
                        onClick={() => set("art", { ...draft.art, pattern: pt })}
                        className={cn("rounded-[10px] p-0.5 transition-all", draft.art.pattern === pt ? "ring-2 ring-ink" : "ring-1 ring-line hover:ring-line-strong")}
                      >
                        <ProductThumb product={{ name: draft.name || "A", images: [], art: { hue: draft.art.hue, pattern: pt } }} size={40} rounded="sm" />
                      </button>
                    ))}
                  </div>
                </div>
                {draft.images.length > 0 && <p className="text-xs text-ink-3">{t("Your cover photo is used while photos are added.", "ছবি থাকলে কভার ছবি দেখাবে।")}</p>}
              </div>
            </div>
          </Section>

          {/* Pricing */}
          <Section
            title={t("Pricing", "দাম")}
            sub={t("Variants follow these prices unless you change them individually.", "আলাদা না বদলালে ভ্যারিয়েন্টগুলো এই দাম নেবে।")}
            action={
              draft.variants.length > 1 ? (
                <Button size="sm" variant="ghost" onClick={applyAll} disabled={!canPrice}>
                  {t("Apply to all variants", "সব ভ্যারিয়েন্টে দিন")}
                </Button>
              ) : undefined
            }
          >
            <div className={cn("grid gap-4", showCost ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
              <Field label={t("Selling price", "বিক্রয় মূল্য")} error={errors.price} htmlFor="p-price">
                <MoneyInput id="p-price" value={draft.price} onChange={(n) => setBase("price", n)} disabled={!canPrice} invalid={!!errors.price} />
              </Field>
              <Field label={t("Compare-at (MRP)", "আগের দাম (MRP)")} optional={t("Optional", "ঐচ্ছিক")} htmlFor="p-mrp" hint={draft.mrp > draft.price && draft.price > 0 ? t(`Shows ${Math.round(((draft.mrp - draft.price) / draft.mrp) * 100)}% off`, `${f.num(Math.round(((draft.mrp - draft.price) / draft.mrp) * 100))}% ছাড় দেখাবে`) : t("Crossed out on share cards", "শেয়ার কার্ডে কাটা দাম")}>
                <MoneyInput id="p-mrp" value={draft.mrp} onChange={(n) => setBase("mrp", n)} disabled={!canPrice} />
              </Field>
              {showCost && (
                <Field
                  label={t("Buying cost", "ক্রয় মূল্য")}
                  htmlFor="p-cost"
                  hint={
                    draft.price > 0 ? (
                      <span className={cn("font-medium", marginPct >= 0.35 ? "text-ok" : marginPct >= 0.15 ? "text-ink-2" : "text-danger")}>
                        {t(`${f.money(draft.price - draft.cost)} profit · ${f.pct(marginPct)} margin`, `${f.money(draft.price - draft.cost)} লাভ · ${f.pct(marginPct)} মার্জিন`)}
                      </span>
                    ) : (
                      t("Only owners and managers see this", "শুধু মালিক ও ম্যানেজার দেখেন")
                    )
                  }
                >
                  <MoneyInput id="p-cost" value={draft.cost} onChange={(n) => setBase("cost", n)} disabled={!canPrice} />
                </Field>
              )}
            </div>
            {!canPrice && <p className="mt-3 text-xs text-ink-3">{t("Your role can't change prices. Ask an owner or manager.", "আপনার ভূমিকায় দাম বদলানো যায় না।")}</p>}
          </Section>

          <ComboBatchSection
            productId={draft.id}
            trackBatches={draft.trackBatches}
            combo={draft.combo}
            bundle={draft.bundle}
            hasOptions={draft.optionTypes.length > 0}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          />

          {/* Variants */}
          <Section
            title={t("Variants & stock", "ভ্যারিয়েন্ট ও স্টক")}
            sub={t("Add sizes, colours or fabric. Every combination becomes a SKU with its own stock.", "সাইজ, রং বা কাপড় যোগ করুন। প্রতিটি কম্বিনেশন আলাদা SKU।")}
            error={errors.options || errors.variants}
          >
            <div className="space-y-3">
              {draft.optionTypes.map((o, i) => (
                <div key={i} className="grid gap-2 rounded-md border border-line bg-surface-2 p-3 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-start">
                  <Input
                    aria-label={t("Option name", "অপশনের নাম")}
                    value={o.name}
                    placeholder={t("Option, e.g. Size", "অপশন, যেমন সাইজ")}
                    aria-invalid={!!errors.options && !o.name.trim()}
                    onChange={(e) => setOptions(draft.optionTypes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  />
                  <ChipInput
                    values={o.values}
                    onChange={(values) => setOptions(draft.optionTypes.map((x, j) => (j === i ? { ...x, values } : x)))}
                    ariaLabel={t(`Values for ${o.name || "option"}`, `${o.name || "অপশন"} এর মান`)}
                    placeholder={/colou?r/i.test(o.name) ? t("Red, Navy, Mint…", "লাল, নেভি…") : t("Type a value, press Enter", "মান লিখে Enter চাপুন")}
                    invalid={!!errors.options && !o.values.length}
                    renderChip={(v) =>
                      /colou?r/i.test(o.name) ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-3 rounded-full border border-black/10" style={{ background: swatchFor(v) ?? "var(--line-strong)" }} />
                          {v}
                        </span>
                      ) : (
                        v
                      )
                    }
                  />
                  <IconButton label={t("Remove option", "অপশন সরান")} onClick={() => setOptions(draft.optionTypes.filter((_, j) => j !== i))} className="justify-self-end">
                    <Trash className="size-4" />
                  </IconButton>
                </div>
              ))}
              {draft.optionTypes.length < 3 && (
                <div className="flex flex-wrap items-center gap-2">
                  {OPTION_SUGGESTIONS.filter((s) => !draft.optionTypes.some((o) => o.name.toLowerCase() === s.name.toLowerCase())).map((s) => (
                    <Button key={s.name} size="sm" icon={<Plus className="size-3.5" />} onClick={() => setOptions([...draft.optionTypes, { name: t(s.name, s.bn), values: s.values }])}>
                      {t(s.name, s.bn)}
                    </Button>
                  ))}
                  <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => setOptions([...draft.optionTypes, { name: "", values: [] }])}>
                    {t("Other option", "অন্য অপশন")}
                  </Button>
                  <span className="text-xs text-ink-4">{t(`${3 - draft.optionTypes.length} more allowed`, `আরও ${f.num(3 - draft.optionTypes.length)}টি`)}</span>
                </div>
              )}
            </div>

            <VariantMatrix
              draft={draft}
              isNew={isNew}
              showCost={showCost}
              canPrice={canPrice}
              opening={opening}
              setOpening={(id, n) => setOpening((o) => ({ ...o, [id]: n }))}
              update={updateVariant}
              errors={errors}
              prefix={draft.prefix}
              setPrefix={(p) => {
                setPrefixTouched(true);
                set("prefix", p.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
              }}
              regenerateSkus={() =>
                setDraft((d) => {
                  const taken = new Set(otherSkus);
                  return {
                    ...d,
                    variants: d.variants.map((v) => {
                      const sku = nextSku(d.prefix || "PRD", taken);
                      taken.add(sku);
                      return { ...v, sku };
                    }),
                  };
                })
              }
            />
          </Section>
        </div>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start">
          {existing ? (
            <ProductRail product={existing} />
          ) : (
            <Panel className="overflow-hidden">
              <CardArt product={preview} hover={false} className="relative aspect-[5/4]" />
              <div className="p-4">
                <p className="truncate text-xs text-ink-3">{(() => {
                  const c = categories.find((x) => x.id === draft.categoryId);
                  return c ? t(c.name, c.nameBn) : "";
                })()}</p>
                <p className="mt-0.5 font-semibold text-ink">{preview.name}</p>
                <p className="figure mt-1 text-xl font-semibold text-ink">{f.money(draft.price)}</p>
                <p className="mt-2 text-xs text-ink-3">
                  {t(`${f.num(activeCount)} variants · ${f.num(Object.values(opening).reduce((s, n) => s + (n || 0), 0))} units opening stock`, `${f.num(activeCount)}টি ভ্যারিয়েন্ট · শুরুর স্টক ${f.num(Object.values(opening).reduce((s, n) => s + (n || 0), 0))}`)}
                </p>
              </div>
              <p className="border-t border-line bg-surface-2 px-4 py-3 text-xs text-ink-3">{t("This is how the product appears in your catalogue and on the POS.", "ক্যাটালগ ও POS এ পণ্যটি এভাবে দেখাবে।")}</p>
            </Panel>
          )}
        </aside>
      </div>

      {/* Sticky save bar */}
      <div className={cn("sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 mt-6 transition-[opacity,transform] duration-200 md:bottom-5", dirty || isNew || Object.keys(errors).length ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0")} aria-hidden={!(dirty || isNew || Object.keys(errors).length)}>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/95 py-2.5 pl-4 pr-2.5 shadow-3 backdrop-blur-md">
          <p className={cn("flex min-w-0 flex-1 items-center gap-2 text-[13px]", dirty ? "text-ink-2" : "text-ink-4")}>
            {Object.keys(errors).length > 0 ? (
              <>
                <WarningCircle className="size-4 shrink-0 text-danger" weight="fill" />
                <span className="truncate text-danger">{t("Fix the highlighted fields to save", "লাল ঘরগুলো ঠিক করুন")}</span>
              </>
            ) : dirty ? (
              <>
                <span className="size-2 shrink-0 rounded-full bg-cash" />
                <span className="truncate">{t("Unsaved changes", "সেভ হয়নি")}</span>
              </>
            ) : (
              <span className="truncate">{isNew ? t("Nothing saved yet", "এখনো সেভ হয়নি") : t("All changes saved", "সব সেভ হয়েছে")}</span>
            )}
          </p>
          {dirty && !isNew && (
            <Button variant="ghost" onClick={discard}>
              {t("Discard", "বাতিল")}
            </Button>
          )}
          <Button variant="primary" onClick={save} loading={saving} disabled={!dirty && !isNew}>
            {isNew ? t("Add product", "পণ্য যোগ করুন") : t("Save changes", "সেভ করুন")}
          </Button>
        </div>
      </div>

      {existing && <ShareCardSheet product={shareOpen ? existing : null} onClose={() => setShareOpen(false)} />}
      {confirmNode}
    </div>
  );
}

/* ------------------------------------------------------------ pieces */

function Section({ title, sub, action, children, error }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode; error?: string }) {
  return (
    <Panel className="p-5 md:p-6" data-error={!!error}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
          {sub && <p className="mt-0.5 max-w-prose text-[13px] text-ink-3">{sub}</p>}
        </div>
        {action}
      </div>
      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
          <WarningCircle className="size-4 shrink-0" weight="fill" />
          {error}
        </p>
      )}
      {children}
    </Panel>
  );
}

function MiniBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid size-7 place-items-center rounded-[6px] bg-surface/95 text-ink-2 shadow-1 hover:text-ink disabled:opacity-40">
      {children}
    </button>
  );
}

export function MoneyInput({ id, value, onChange, disabled, invalid, size = "md", ariaLabel }: { id?: string; value: number; onChange: (n: number) => void; disabled?: boolean; invalid?: boolean; size?: "sm" | "md"; ariaLabel?: string }) {
  return (
    <Input
      id={id}
      inputSize={size}
      aria-label={ariaLabel}
      inputMode="decimal"
      leading={<span className="text-[13px] font-medium">৳</span>}
      value={value ? String(value) : ""}
      placeholder="0"
      disabled={disabled}
      aria-invalid={invalid}
      className="tnum"
      onChange={(e) => {
        const n = parseFloat(e.target.value.replace(/[^\d.]/g, ""));
        onChange(Number.isFinite(n) ? n : 0);
      }}
    />
  );
}

function VariantMatrix({
  draft,
  isNew,
  showCost,
  canPrice,
  opening,
  setOpening,
  update,
  errors,
  prefix,
  setPrefix,
  regenerateSkus,
}: {
  draft: Draft;
  isNew: boolean;
  showCost: boolean;
  canPrice: boolean;
  opening: Record<string, number>;
  setOpening: (id: string, n: number) => void;
  update: (id: string, patch: Partial<Variant>) => void;
  errors: Errors;
  prefix: string;
  setPrefix: (p: string) => void;
  regenerateSkus: () => void;
}) {
  const t = useT();
  const f = useFmt();
  const hasOptions = draft.variants.some((v) => Object.keys(v.options).length);
  const cols = cn(
    "md:grid md:items-center md:gap-2.5",
    showCost ? "md:grid-cols-[minmax(88px,1fr)_136px_100px_100px_60px_64px_36px]" : "md:grid-cols-[minmax(88px,1fr)_136px_100px_60px_64px_36px]",
  );
  const num = (s: string) => {
    const n = parseInt(s.replace(/\D/g, "") || "0", 10);
    return Number.isFinite(n) ? n : 0;
  };
  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-2">
          {hasOptions ? t(`${f.num(draft.variants.length)} combinations`, `${f.num(draft.variants.length)}টি কম্বিনেশন`) : t("One variant — add options above to split by size or colour", "একটি ভ্যারিয়েন্ট — সাইজ বা রঙে ভাগ করতে উপরে অপশন দিন")}
        </p>
        <div className="flex items-center gap-2">
          <label className="whitespace-nowrap text-xs text-ink-3" htmlFor="sku-prefix">
            {t("SKU prefix", "SKU প্রিফিক্স")}
          </label>
          <div className="w-24">
            <Input id="sku-prefix" inputSize="sm" className="font-mono uppercase" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
          </div>
          <Button size="sm" variant="ghost" onClick={regenerateSkus}>
            {t("Renumber", "নতুন নম্বর")}
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border border-line">
        <div className={cn("hidden border-b border-line bg-surface-2 px-3 py-2 text-xs font-medium text-ink-3", cols)}>
          <span>{t("Variant", "ভ্যারিয়েন্ট")}</span>
          <span>{t("SKU · barcode", "SKU · বারকোড")}</span>
          <span>{t("Price", "দাম")}</span>
          {showCost && <span>{t("Cost", "খরচ")}</span>}
          <span title={t("Alert when available stock falls to this", "এত কমলে সতর্ক করবে")}>{t("Alert at", "সতর্কতা")}</span>
          <span>{isNew ? t("Opening", "শুরুর স্টক") : t("In stock", "স্টকে")}</span>
          <span className="sr-only">{t("On", "চালু")}</span>
        </div>
        <ul className="divide-y divide-line">
          {draft.variants.map((v) => {
            const label = Object.entries(v.options);
            const skuErr = errors.sku?.[v.id];
            const priceErr = errors.vprice?.[v.id];
            const orphan = !v.active && Object.keys(v.options).some((k) => !draft.optionTypes.some((o) => o.name === k && o.values.includes(v.options[k])));
            return (
              <li key={v.id} className={cn("grid grid-cols-2 gap-x-3 gap-y-2 px-3 py-3", cols, !v.active && "bg-surface-2/70")}>
                <div className="col-span-2 flex min-w-0 items-center justify-between gap-2 md:col-span-1">
                  <span className={cn("flex min-w-0 flex-wrap items-center gap-1", !v.active && "opacity-55")}>
                    {label.length ? (
                      label.map(([k, val]) => (
                        <span key={k} className="inline-flex h-6 items-center gap-1 rounded-[6px] bg-sunken px-1.5 text-[12.5px] font-medium text-ink">
                          {/colou?r/i.test(k) && <span className="size-2.5 rounded-full border border-black/10" style={{ background: swatchFor(val) ?? "var(--line-strong)" }} />}
                          {val}
                        </span>
                      ))
                    ) : (
                      <span className="text-[13px] text-ink-2">{t("Default", "ডিফল্ট")}</span>
                    )}
                    {orphan && <Badge tone="warn">{t("Removed — has stock", "সরানো — স্টক আছে")}</Badge>}
                  </span>
                  <span className="md:hidden">
                    <Switch size="sm" checked={v.active} onChange={(on) => update(v.id, { active: on })} label={t("Variant on", "ভ্যারিয়েন্ট চালু")} />
                  </span>
                </div>
                <div className="col-span-2 grid grid-cols-2 gap-x-3 gap-y-1 md:col-span-1 md:grid-cols-1">
                  <div>
                    <MobileLabel>SKU</MobileLabel>
                    <Input inputSize="sm" value={v.sku} onChange={(e) => update(v.id, { sku: e.target.value.toUpperCase() })} aria-invalid={!!skuErr} aria-label="SKU" className="font-mono text-[12.5px]" />
                    {skuErr && <p className="mt-1 text-[11.5px] text-danger">{skuErr}</p>}
                  </div>
                  <div>
                    <MobileLabel>{t("Barcode", "বারকোড")}</MobileLabel>
                    <Input inputSize="sm" value={v.barcode ?? ""} onChange={(e) => update(v.id, { barcode: e.target.value })} placeholder={t("Barcode", "বারকোড")} aria-label={t("Barcode", "বারকোড")} className="font-mono text-[12px] text-ink-2" />
                  </div>
                </div>
                <div>
                  <MobileLabel>{t("Price", "দাম")}</MobileLabel>
                  <MoneyInput size="sm" value={v.price} onChange={(n) => update(v.id, { price: n })} disabled={!canPrice} invalid={!!priceErr} ariaLabel={t("Price", "দাম")} />
                </div>
                {showCost && (
                  <div>
                    <MobileLabel>{t("Cost", "খরচ")}</MobileLabel>
                    <MoneyInput size="sm" value={v.cost} onChange={(n) => update(v.id, { cost: n })} disabled={!canPrice} ariaLabel={t("Cost", "খরচ")} />
                  </div>
                )}
                <div>
                  <MobileLabel>{t("Alert at", "সতর্কতা")}</MobileLabel>
                  <Input inputSize="sm" inputMode="numeric" className="tnum" value={String(v.lowStock)} onChange={(e) => update(v.id, { lowStock: num(e.target.value) })} aria-label={t("Low-stock alert", "লো-স্টক সতর্কতা")} />
                </div>
                <div>
                  <MobileLabel>{isNew ? t("Opening stock", "শুরুর স্টক") : t("In stock", "স্টকে")}</MobileLabel>
                  {isNew ? (
                    <Input inputSize="sm" inputMode="numeric" className="tnum" value={opening[v.id] ? String(opening[v.id]) : ""} placeholder="0" onChange={(e) => setOpening(v.id, num(e.target.value))} aria-label={t("Opening stock", "শুরুর স্টক")} />
                  ) : (
                    <p className="tnum flex h-8 items-center text-sm">
                      <span className={cn("font-semibold", v.onHand - v.reserved <= 0 ? "text-danger" : v.onHand - v.reserved <= v.lowStock ? "text-warn" : "text-ink")}>{f.num(v.onHand - v.reserved)}</span>
                      {v.reserved > 0 && <span className="ml-1 text-xs text-ink-3">+{f.num(v.reserved)}</span>}
                    </p>
                  )}
                </div>
                <div className="hidden md:block">
                  <Switch size="sm" checked={v.active} onChange={(on) => update(v.id, { active: on })} label={t("Variant on", "ভ্যারিয়েন্ট চালু")} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {!isNew && <p className="mt-2 text-xs text-ink-3">{t("To change stock, use Stock in or Adjust on the Stock page — every change is kept in the ledger.", "স্টক বদলাতে স্টক পেজের স্টক ইন বা সমন্বয় ব্যবহার করুন — সব লেজারে থাকে।")}{" "}<Link href="/inventory?tab=adjust" className="font-medium text-brand-ink underline-offset-2 hover:underline">{t("Go to Stock", "স্টকে যান")}</Link></p>}
    </div>
  );
}

function MobileLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-[11.5px] font-medium text-ink-3 md:hidden">{children}</span>;
}

"use client";

import { CheckCircle, DownloadSimple, FileCsv, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { useMemo, useRef, useState } from "react";
import { Badge, Button, cn, Switch } from "../ui/core";
import { Sheet, useToast } from "../ui/overlays";
import { downloadText, parseCSV, skuPrefixFrom, toCSV } from "./utils";
import { useFmt, useT } from "@/lib/hooks";
import { uid } from "@/lib/base-data";
import { useStore } from "@/lib/store";
import type { PatternId, Product, Variant } from "@/lib/types";
import { codeKeys } from "@/lib/barcode";

const COLUMNS = ["name", "name_bn", "category", "unit", "price", "cost", "mrp", "option1_name", "option1_value", "option2_name", "option2_value", "sku", "barcode", "opening_stock", "low_stock"] as const;

const TEMPLATE_ROWS = [
  ["Cotton Kurti", "সুতি কুর্তি", "Kurti & tops", "pcs", "950", "520", "1100", "Size", "M", "Colour", "Maroon", "", "", "12", "4"],
  ["Cotton Kurti", "সুতি কুর্তি", "Kurti & tops", "pcs", "950", "520", "1100", "Size", "L", "Colour", "Maroon", "", "", "8", "4"],
  ["Handmade Clay Earrings", "মাটির কানের দুল", "Accessories", "pcs", "220", "90", "", "", "", "", "", "CLY-101", "", "30", "6"],
];

const ART_HUES = ["#B23A48", "#3446C4", "#0E6B53", "#D79A1E", "#C2306B", "#0A7CA8", "#7A45C2", "#6B4A33"];
const ART_PATTERNS: PatternId[] = ["stripe", "dots", "paisley", "weave", "diamond", "wave", "check"];

type Row = {
  line: number;
  name: string;
  nameBn: string;
  category: string;
  unit: string;
  price: number;
  cost: number;
  mrp?: number;
  options: Record<string, string>;
  sku: string;
  barcode: string;
  opening: number;
  lowStock: number;
  errors: string[];
  notes: string[];
};

export function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const f = useFmt();
  const toast = useToast();
  const products = useStore((s) => s.products);
  const categories = useStore((s) => s.categories);
  const addCategory = useStore((s) => s.addCategory);
  const saveProduct = useStore((s) => s.saveProduct);
  const [fileName, setFileName] = useState<string | null>(null);
  const [raw, setRaw] = useState<string[][] | null>(null);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFileName(null);
    setRaw(null);
    setHeaderError(null);
    setOnlyErrors(false);
  };

  const rows = useMemo<Row[]>(() => {
    if (!raw || raw.length < 2) return [];
    const header = raw[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
    const col = (r: string[], k: (typeof COLUMNS)[number]) => {
      const i = header.indexOf(k);
      return i >= 0 ? (r[i] ?? "").trim() : "";
    };
    const takenSkus = new Set(products.flatMap((p) => p.variants.map((v) => v.sku.toLowerCase())));
    // Barcodes on file (in every form a scanner may report) — two products on one code would make scans ambiguous.
    const takenCodes = new Set(products.flatMap((p) => p.variants.flatMap((v) => codeKeys(v.barcode ?? ""))));
    const existingNames = new Set(products.map((p) => p.name.trim().toLowerCase()));
    const seenCombos = new Set<string>();
    const num = (s: string) => (s === "" ? NaN : Number(s.replace(/[,৳\s]/g, "")));
    return raw.slice(1).map((r, i) => {
      const errors: string[] = [];
      const notes: string[] = [];
      const name = col(r, "name");
      const price = num(col(r, "price"));
      const costRaw = col(r, "cost");
      const cost = costRaw === "" ? 0 : num(costRaw);
      const mrpRaw = col(r, "mrp");
      const mrp = mrpRaw === "" ? undefined : num(mrpRaw);
      const openRaw = col(r, "opening_stock");
      const opening = openRaw === "" ? 0 : num(openRaw);
      const lowRaw = col(r, "low_stock");
      const lowStock = lowRaw === "" ? 5 : num(lowRaw);
      const options: Record<string, string> = {};
      for (const n of [1, 2] as const) {
        const on = col(r, `option${n}_name`);
        const ov = col(r, `option${n}_value`);
        if (ov && !on) errors.push(t(`Option ${n} has a value but no name`, `অপশন ${n} এর নাম নেই`));
        else if (on && !ov) errors.push(t(`Option ${n} “${on}” needs a value`, `অপশন “${on}” এর মান দিন`));
        else if (on && ov) options[on] = ov;
      }
      if (!name) errors.push(t("Name is missing", "নাম নেই"));
      if (!Number.isFinite(price) || price <= 0) errors.push(t("Price must be a number above 0", "দাম ০ এর বেশি সংখ্যা হতে হবে"));
      if (!Number.isFinite(cost) || cost < 0) errors.push(t("Cost must be 0 or more", "খরচ ০ বা বেশি হতে হবে"));
      if (mrp !== undefined && (!Number.isFinite(mrp) || mrp < 0)) errors.push(t("MRP must be a number", "MRP সংখ্যা হতে হবে"));
      if (!Number.isInteger(opening) || opening < 0) errors.push(t("Opening stock must be a whole number", "শুরুর স্টক পূর্ণ সংখ্যা হতে হবে"));
      if (!Number.isInteger(lowStock) || lowStock < 0) errors.push(t("Low-stock alert must be a whole number", "লো-স্টক পূর্ণ সংখ্যা হতে হবে"));
      const sku = col(r, "sku");
      if (sku) {
        if (takenSkus.has(sku.toLowerCase())) errors.push(t(`SKU ${sku} is already used`, `SKU ${sku} আগেই আছে`));
        else takenSkus.add(sku.toLowerCase());
      }
      const code = col(r, "barcode");
      const codeK = codeKeys(code);
      if (codeK.some((k) => takenCodes.has(k))) errors.push(t(`Barcode ${code} is already used`, `বারকোড ${code} আগেই আছে`));
      else codeK.forEach((k) => takenCodes.add(k));
      if (name && existingNames.has(name.toLowerCase())) errors.push(t("A product with this name already exists", "এই নামে পণ্য আগেই আছে"));
      const combo = `${name.toLowerCase()}|${JSON.stringify(options)}`;
      if (name && seenCombos.has(combo)) errors.push(t("Duplicate of an earlier row", "আগের সারির মতো একই"));
      seenCombos.add(combo);
      const category = col(r, "category");
      if (category && !categories.some((c) => c.name.toLowerCase() === category.toLowerCase() || c.nameBn === category)) notes.push(t(`New category “${category}” will be created`, `নতুন ক্যাটাগরি “${category}” তৈরি হবে`));
      if (!sku) notes.push(t("SKU will be generated", "SKU তৈরি হবে"));
      return {
        line: i + 2,
        name,
        nameBn: col(r, "name_bn"),
        category: category || "Other",
        unit: col(r, "unit") || "pcs",
        price,
        cost,
        mrp,
        options,
        sku,
        barcode: col(r, "barcode"),
        opening,
        lowStock,
        errors,
        notes,
      };
    });
  }, [raw, products, categories, t]);

  const valid = rows.filter((r) => r.errors.length === 0);
  const invalid = rows.length - valid.length;
  const productCount = new Set(valid.map((r) => r.name.toLowerCase())).size;

  const load = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setHeaderError(t("Choose a .csv file. In Excel use File → Save as → CSV.", ".csv ফাইল দিন। Excel এ File → Save as → CSV।"));
      return;
    }
    const text = await file.text();
    const parsed = parseCSV(text);
    const header = parsed[0]?.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_")) ?? [];
    const missing = ["name", "price"].filter((c) => !header.includes(c));
    setFileName(file.name);
    if (missing.length) {
      setRaw(null);
      setHeaderError(t(`The file needs these columns: ${missing.join(", ")}. Start from the template.`, `ফাইলে এই কলামগুলো লাগবে: ${missing.join(", ")}। টেমপ্লেট ব্যবহার করুন।`));
      return;
    }
    if (parsed.length < 2) {
      setRaw(null);
      setHeaderError(t("The file has headings but no product rows.", "ফাইলে কোনো পণ্যের সারি নেই।"));
      return;
    }
    setHeaderError(null);
    setRaw(parsed);
  };

  const doImport = () => {
    const groups = new Map<string, Row[]>();
    valid.forEach((r) => groups.set(r.name.toLowerCase(), [...(groups.get(r.name.toLowerCase()) ?? []), r]));
    const catIds = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
    const taken = new Set(products.flatMap((p) => p.variants.map((v) => v.sku)));
    let i = 0;
    for (const list of groups.values()) {
      const first = list[0];
      let catId = catIds.get(first.category.toLowerCase()) ?? categories.find((c) => c.nameBn === first.category)?.id;
      if (!catId) {
        catId = addCategory(first.category);
        catIds.set(first.category.toLowerCase(), catId);
      }
      const prefix = skuPrefixFrom(first.name);
      const optionNames = [...new Set(list.flatMap((r) => Object.keys(r.options)))];
      const opening: Record<string, number> = {};
      let n = 101;
      const variants: Variant[] = list.map((r) => {
        let sku = r.sku;
        if (!sku) {
          while (taken.has(`${prefix}-${n}`)) n++;
          sku = `${prefix}-${n}`;
        }
        taken.add(sku);
        const id = uid("v_");
        opening[id] = r.opening;
        return { id, sku, barcode: r.barcode || undefined, options: r.options, price: r.price, cost: r.cost, mrp: r.mrp, onHand: 0, reserved: 0, inTransit: 0, damaged: 0, lowStock: r.lowStock, active: true };
      });
      const product: Product = {
        id: uid("p_"),
        name: first.name,
        nameBn: first.nameBn || undefined,
        categoryId: catId,
        unit: first.unit,
        description: "",
        images: [],
        art: { hue: ART_HUES[i % ART_HUES.length], pattern: ART_PATTERNS[i % ART_PATTERNS.length] },
        optionTypes: optionNames.map((name) => ({ name, values: [...new Set(list.map((r) => r.options[name]).filter(Boolean))] })),
        variants,
        status: "active",
        tags: [],
        createdAt: new Date().toISOString(),
      };
      saveProduct(product, opening);
      i++;
    }
    toast({
      title: t(`Imported ${productCount} products`, `${f.num(productCount)}টি পণ্য ইমপোর্ট হয়েছে`),
      body: invalid ? t(`${invalid} rows were skipped because of errors.`, `ভুলের কারণে ${f.num(invalid)}টি সারি বাদ গেছে।`) : undefined,
    });
    reset();
    onClose();
  };

  const shown = onlyErrors ? rows.filter((r) => r.errors.length) : rows;

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t("Import products", "পণ্য ইমপোর্ট")}
      sub={t("Bring your Excel or Google Sheet in one go. Nothing is saved until you confirm.", "Excel বা Google Sheet একবারে আনুন। নিশ্চিত না করা পর্যন্ত কিছু সেভ হবে না।")}
      width={760}
      footer={
        raw ? (
          <>
            <Button variant="ghost" onClick={reset}>
              {t("Choose another file", "অন্য ফাইল")}
            </Button>
            <Button variant="primary" className="ml-auto" disabled={!valid.length} onClick={doImport}>
              {valid.length
                ? t(`Import ${productCount} products (${valid.length} rows)`, `${f.num(productCount)}টি পণ্য ইমপোর্ট করুন`)
                : t("Fix the errors to import", "ইমপোর্টের আগে ভুল ঠিক করুন")}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-5 p-5">
        {!raw && (
          <>
            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="tnum grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-[13px] font-semibold text-brand-ink">1</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{t("Download the template", "টেমপ্লেট ডাউনলোড করুন")}</p>
                  <p className="mt-0.5 text-[13px] text-ink-3">
                    {t("One row per size or colour. Rows with the same name become one product with variants.", "প্রতি সাইজ বা রঙের জন্য এক সারি। একই নামের সারি মিলে এক পণ্য হবে।")}
                  </p>
                  <Button size="sm" className="mt-2" icon={<DownloadSimple className="size-4" />} onClick={() => downloadText("bechakena-products-template.csv", toCSV([[...COLUMNS], ...TEMPLATE_ROWS]))}>
                    bechakena-products-template.csv
                  </Button>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="tnum grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-[13px] font-semibold text-brand-ink">2</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{t("Upload your filled-in CSV", "পূরণ করা CSV আপলোড করুন")}</p>
                  <p className="mt-0.5 text-[13px] text-ink-3">{t("You'll see every row checked before anything is saved.", "সেভের আগে প্রতিটি সারি যাচাই দেখবেন।")}</p>
                </div>
              </li>
            </ol>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                load(e.dataTransfer.files[0]);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
                drag ? "border-brand bg-brand-50" : "border-line-strong bg-surface-2 hover:border-ink-4",
              )}
            >
              <FileCsv className="size-10 text-brand-ink" weight="duotone" />
              <p className="mt-3 text-sm font-medium text-ink">{t("Drop the CSV here or choose a file", "CSV এখানে ছাড়ুন বা ফাইল বাছুন")}</p>
              <p className="mt-1 text-xs text-ink-3">{t("Columns needed: name, price. Everything else is optional.", "লাগবে: name, price। বাকিগুলো ঐচ্ছিক।")}</p>
              <span className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink shadow-1">
                <UploadSimple className="size-4" />
                {t("Choose file", "ফাইল বাছুন")}
              </span>
              <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => load(e.target.files?.[0])} />
            </label>
            {headerError && (
              <p className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
                <WarningCircle className="mt-0.5 size-4 shrink-0" weight="fill" />
                <span>
                  {fileName && <b className="font-medium">{fileName}: </b>}
                  {headerError}
                </span>
              </p>
            )}
          </>
        )}

        {raw && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 inline-flex items-center gap-2 text-sm font-medium text-ink">
                <FileCsv className="size-5 text-brand-ink" />
                {fileName}
              </span>
              <Badge tone="ok" dot>
                {t(`${valid.length} ready`, `${f.num(valid.length)}টি প্রস্তুত`)}
              </Badge>
              {invalid > 0 && (
                <Badge tone="danger" dot>
                  {t(`${invalid} need fixing`, `${f.num(invalid)}টি ঠিক করতে হবে`)}
                </Badge>
              )}
              {invalid > 0 && (
                <label className="ml-auto inline-flex items-center gap-2 text-[13px] text-ink-2">
                  <Switch size="sm" checked={onlyErrors} onChange={setOnlyErrors} label={t("Only rows with errors", "শুধু ভুল সারি")} />
                  {t("Only errors", "শুধু ভুল")}
                </label>
              )}
            </div>
            <div className="overflow-hidden rounded-lg border border-line">
              <ul className="divide-y divide-line">
                {shown.map((r) => (
                  <li key={r.line} className={cn("flex gap-3 px-4 py-3", r.errors.length ? "bg-danger-soft/50" : "")}>
                    <span className="tnum w-8 shrink-0 pt-0.5 text-xs text-ink-4">#{r.line}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-medium text-ink">{r.name || <i className="text-ink-4">{t("No name", "নাম নেই")}</i>}</span>
                        {Object.values(r.options).length > 0 && <span className="text-[13px] text-ink-3">{Object.values(r.options).join(" / ")}</span>}
                      </div>
                      <p className="tnum mt-0.5 text-xs text-ink-3">
                        {Number.isFinite(r.price) ? f.money(r.price) : "—"} · {t("stock", "স্টক")} {Number.isFinite(r.opening) ? f.num(r.opening) : "—"} · {r.category}
                        {r.sku && ` · ${r.sku}`}
                      </p>
                      {r.errors.map((e) => (
                        <p key={e} className="mt-1 flex items-center gap-1.5 text-xs font-medium text-danger">
                          <WarningCircle className="size-3.5" weight="fill" /> {e}
                        </p>
                      ))}
                      {!r.errors.length &&
                        r.notes.map((n) => (
                          <p key={n} className="mt-1 text-xs text-ink-3">
                            {n}
                          </p>
                        ))}
                    </div>
                    {!r.errors.length && <CheckCircle className="size-5 shrink-0 text-ok" weight="fill" />}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

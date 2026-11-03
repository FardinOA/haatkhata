"use client";

import { ArrowCounterClockwise, Check, CheckCircle, Eyedropper, ImageSquare, Sparkle, Trash, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { BrandMark, StatusPill } from "../bits";
import { Badge, Button, cn, Input, Segmented } from "../ui/core";
import { useToast } from "../ui/overlays";
import { useFmt, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import {
  buildRamp,
  contrast,
  CORNER_PX,
  DEFAULT_THEME,
  extractLogoColors,
  isHex,
  themeVars,
  THEME_PRESETS,
  type CanvasTone,
  type Corners,
  type Density,
  type DisplayFont,
  type SidebarStyle,
} from "@/lib/theme";

/** Reads an image file, scales it to fit 256px and returns a PNG data URL (keeps transparency). */
async function fileToLogo(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const max = 256;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Section({ title, sub, children, aside }: { title: string; sub?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-b border-line py-6 first:pt-0 last:border-b-0">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          {sub && <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Large, visual radio card. */
function Choice({ selected, onClick, children, label, className }: { selected: boolean; onClick: () => void; children: ReactNode; label: string; className?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-stretch gap-2 rounded-md border bg-surface p-2 text-left transition-all",
        selected ? "border-brand shadow-[var(--ring)]" : "border-line hover:border-line-strong",
        className,
      )}
    >
      {children}
      <span className="flex items-center justify-between gap-1 px-0.5 text-[12.5px] font-medium text-ink-2">
        {label}
        {selected && <CheckCircle className="size-4 text-brand-ink" weight="fill" />}
      </span>
    </button>
  );
}

export function BrandStudio() {
  const t = useT();
  const toast = useToast();
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const business = useStore((s) => s.business);
  const setBusiness = useStore((s) => s.setBusiness);
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoColors, setLogoColors] = useState<string[]>([]);
  const [hexDraft, setHexDraft] = useState(theme.accent);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const ramp = useMemo(() => buildRamp(theme.accent), [theme.accent]);
  const vars = useMemo(() => themeVars(theme.accent), [theme.accent]);
  const btnContrast = contrast(vars["--brand"], vars["--brand-contrast"]);
  const presetMatch = THEME_PRESETS.find((p) => p.hex.toLowerCase() === theme.accent.toLowerCase());

  const pickAccent = (hex: string) => {
    setTheme({ accent: hex.toUpperCase() });
    setHexDraft(hex.toUpperCase());
  };

  const onFile = async (file?: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|svg\+xml|gif)$/.test(file.type)) {
      toast({ tone: "warn", title: t("That file isn't an image", "এটি ছবির ফাইল নয়"), body: t("Use a PNG, JPG, WebP or SVG logo.", "PNG, JPG, WebP বা SVG লোগো দিন।") });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({ tone: "warn", title: t("Logo is larger than 4 MB", "লোগো ৪ MB এর বেশি"), body: t("Export a smaller version and try again.", "ছোট সংস্করণ দিয়ে আবার চেষ্টা করুন।") });
      return;
    }
    setBusy(true);
    try {
      const data = await fileToLogo(file);
      setBusiness({ logo: data });
      const colors = await extractLogoColors(data, 5);
      setLogoColors(colors);
      toast({
        title: t("Logo updated", "লোগো আপডেট হয়েছে"),
        body: colors.length ? t("We found colours in it — try one as your brand colour.", "লোগো থেকে রং পাওয়া গেছে — ব্র্যান্ড রং হিসেবে চেষ্টা করুন।") : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        {/* ---------------- logo */}
        <Section title={t("Logo", "লোগো")} sub={t("Shown in the sidebar, on invoices, labels and share cards.", "সাইডবার, ইনভয়েস, লেবেল ও শেয়ার কার্ডে দেখাবে।")}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                onFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex flex-1 items-center gap-4 rounded-lg border-2 border-dashed p-4 transition-colors",
                dragOver ? "border-brand bg-brand-50" : "border-line-strong bg-surface-2",
              )}
            >
              <div className="grid size-[76px] shrink-0 place-items-center rounded-lg bg-surface shadow-1">
                <BrandMark size={60} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{business.logo ? t("Your logo", "আপনার লোগো") : t("No logo yet — using your initials", "লোগো নেই — নামের আদ্যক্ষর দেখাচ্ছে")}</p>
                <p className="mt-0.5 text-[13px] text-ink-3">{t("Drop an image here, or choose a file. Square works best.", "এখানে ছবি টেনে আনুন বা ফাইল বাছুন। বর্গাকার লোগো ভালো দেখায়।")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="primary" loading={busy} icon={<UploadSimple className="size-4" />} onClick={() => fileRef.current?.click()}>
                    {business.logo ? t("Replace", "বদলান") : t("Upload logo", "লোগো আপলোড")}
                  </Button>
                  {business.logo && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash className="size-4" />}
                      onClick={() => {
                        setBusiness({ logo: null });
                        setLogoColors([]);
                      }}
                    >
                      {t("Remove", "মুছুন")}
                    </Button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
              </div>
            </div>
            <div className="sm:w-[180px]">
              <p className="mb-2 text-[13px] font-medium text-ink-2">{t("Shape", "আকৃতি")}</p>
              <div role="radiogroup" className="grid grid-cols-3 gap-2 sm:grid-cols-1">
                {(["rounded", "circle", "square"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={business.logoShape === s}
                    onClick={() => setBusiness({ logoShape: s })}
                    className={cn("flex h-10 items-center gap-2.5 rounded-sm border px-3 text-[13px] font-medium", business.logoShape === s ? "border-brand bg-brand-50 text-brand-ink" : "border-line text-ink-2 hover:border-line-strong")}
                  >
                    <span className={cn("size-4 border-2 border-current", s === "circle" ? "rounded-full" : s === "rounded" ? "rounded-[5px]" : "rounded-[1px]")} />
                    {{ rounded: t("Rounded", "গোলাকার কোণ"), circle: t("Circle", "বৃত্ত"), square: t("Square", "বর্গ") }[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {logoColors.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md bg-brand-50 px-4 py-3">
              <Sparkle className="size-4 text-brand-ink" weight="fill" />
              <p className="text-[13px] font-medium text-brand-ink">{t("Colours from your logo", "লোগো থেকে পাওয়া রং")}</p>
              <div className="flex gap-2">
                {logoColors.map((c) => (
                  <button key={c} type="button" onClick={() => pickAccent(c)} className="size-8 rounded-full ring-2 ring-surface transition-transform hover:scale-110" style={{ background: c }} aria-label={t(`Use ${c}`, `${c} ব্যবহার করুন`)} title={c} />
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* ---------------- colour */}
        <Section
          title={t("Brand colour", "ব্র্যান্ড রং")}
          sub={t("Buttons, highlights and links. Everything else is generated from it.", "বাটন, হাইলাইট ও লিংক। বাকি সব এই রং থেকে তৈরি হয়।")}
          aside={
            <Badge tone={btnContrast >= 4.5 ? "ok" : btnContrast >= 3 ? "warn" : "danger"}>
              {btnContrast >= 4.5 ? <Check className="size-3" weight="bold" /> : <WarningCircle className="size-3" weight="bold" />}
              {btnContrast >= 4.5 ? t("Easy to read", "পড়তে সহজ") : t("Large text only", "শুধু বড় লেখায় ঠিক")}
            </Badge>
          }
        >
          <div role="radiogroup" aria-label={t("Colour presets", "রঙের প্রিসেট")} className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
            {THEME_PRESETS.map((p) => {
              const on = p.hex.toLowerCase() === theme.accent.toLowerCase();
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pickAccent(p.hex)}
                  className={cn("flex items-center gap-3 rounded-md border p-2.5 text-left transition-all", on ? "border-brand shadow-[var(--ring)]" : "border-line hover:border-line-strong")}
                >
                  <span className="relative size-9 shrink-0 overflow-hidden rounded-full" style={{ background: p.hex }}>
                    <span className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: buildRamp(p.hex)[200] }} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-ink">{t(p.name, p.nameBn)}</span>
                    <span className="block truncate text-[11.5px] text-ink-3">{p.note}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="relative grid size-10 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-line shadow-1" style={{ background: theme.accent }} title={t("Pick any colour", "যেকোনো রং বাছুন")}>
              <Eyedropper className="size-4 mix-blend-difference text-white" />
              <input type="color" value={theme.accent} onChange={(e) => pickAccent(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={t("Custom colour", "নিজের রং")} />
            </label>
            <div className="w-32">
            <Input
              inputSize="md"
              value={hexDraft}
              onChange={(e) => {
                setHexDraft(e.target.value);
                const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                if (isHex(v) && v.length === 7) setTheme({ accent: v.toUpperCase() });
              }}
              aria-label="Hex"
              spellCheck={false}
            />
            </div>
            <p className="text-[13px] text-ink-3">{presetMatch ? t(`${presetMatch.name} — ${presetMatch.note.toLowerCase()}`, `${presetMatch.nameBn}`) : t("Custom colour", "নিজের রং")}</p>
          </div>

          <div className="mt-4">
            <div className="flex h-9 overflow-hidden rounded-md shadow-1" aria-hidden>
              {Object.entries(ramp).map(([k, v]) => (
                <span key={k} className="flex flex-1 items-end justify-center pb-1 text-[9.5px] font-semibold" style={{ background: v, color: Number(k) >= 500 ? "#fff" : "#16181a99" }}>
                  {k}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-3">{t("Your full colour scale — tints for backgrounds, deeper steps for text that stays readable.", "পুরো রঙের স্কেল — হালকা অংশ ব্যাকগ্রাউন্ডে, গাঢ় অংশ পড়ার মতো লেখায়।")}</p>
          </div>
        </Section>

        {/* ---------------- canvas */}
        <Section title={t("Background", "ব্যাকগ্রাউন্ড")} sub={t("The tone behind your cards.", "কার্ডের পেছনের রং।")}>
          <div role="radiogroup" className="grid grid-cols-3 gap-2 md:grid-cols-5 xl:grid-cols-3 2xl:grid-cols-5">
            {(
              [
                ["stone", t("Stone", "পাথুরে"), "#F3F4F0"],
                ["mist", t("Mist", "কুয়াশা"), "#EFF2F5"],
                ["sand", t("Sand", "বালি"), "#F5F3EF"],
                ["white", t("Paper", "কাগজ"), "#FBFBFA"],
                ["tint", t("Brand tint", "ব্র্যান্ড আভা"), ramp[50]],
              ] as [CanvasTone, string, string][]
            ).map(([v, label, bg]) => (
              <Choice key={v} selected={theme.canvas === v} onClick={() => setTheme({ canvas: v })} label={label}>
                <span className="flex h-14 items-end gap-1 rounded-sm p-2" style={{ background: bg }}>
                  <span className="h-6 flex-1 rounded-[4px] bg-white shadow-1" />
                  <span className="h-9 flex-1 rounded-[4px] bg-white shadow-1" />
                </span>
              </Choice>
            ))}
          </div>
        </Section>

        {/* ---------------- sidebar */}
        <Section title={t("Sidebar", "সাইডবার")} sub={t("How strongly your colour shows in navigation.", "নেভিগেশনে আপনার রং কতটা দেখাবে।")}>
          <div role="radiogroup" className="grid grid-cols-3 gap-2">
            {(
              [
                ["light", t("Quiet", "শান্ত")],
                ["tinted", t("Tinted", "হালকা রঙিন")],
                ["bold", t("Bold", "গাঢ়")],
              ] as [SidebarStyle, string][]
            ).map(([v, label]) => (
              <Choice key={v} selected={theme.sidebar === v} onClick={() => setTheme({ sidebar: v })} label={label}>
                <span className="flex h-16 overflow-hidden rounded-sm border border-line bg-canvas">
                  <span className={cn("flex w-[38%] flex-col gap-1 p-1.5", v === "light" ? "border-r border-line bg-white" : v === "tinted" ? "bg-brand-50" : "bg-brand")}>
                    <span className={cn("h-1.5 w-3/4 rounded-full", v === "bold" ? "bg-white/80" : "bg-brand")} />
                    <span className={cn("h-1 w-2/3 rounded-full", v === "bold" ? "bg-white/40" : "bg-line-strong")} />
                    <span className={cn("h-1 w-1/2 rounded-full", v === "bold" ? "bg-white/40" : "bg-line-strong")} />
                  </span>
                  <span className="flex-1 p-1.5">
                    <span className="block h-full rounded-[3px] bg-white shadow-1" />
                  </span>
                </span>
              </Choice>
            ))}
          </div>
        </Section>

        {/* ---------------- shape & density */}
        <Section title={t("Shape & spacing", "আকৃতি ও জায়গা")}>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-2">{t("Corners", "কোণ")}</p>
              <div role="radiogroup" className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["sharp", t("Crisp", "তীক্ষ্ণ")],
                    ["soft", t("Soft", "নরম")],
                    ["round", t("Round", "গোল")],
                  ] as [Corners, string][]
                ).map(([v, label]) => (
                  <Choice key={v} selected={theme.corners === v} onClick={() => setTheme({ corners: v })} label={label}>
                    <span className="grid h-12 place-items-center rounded-sm bg-surface-2">
                      <span className="h-7 w-12 border-2 border-brand bg-brand-50" style={{ borderRadius: CORNER_PX[v] * 0.7 }} />
                    </span>
                  </Choice>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-2">{t("Density", "ঘনত্ব")}</p>
              <Segmented<Density>
                className="w-full"
                value={theme.density}
                onChange={(v) => setTheme({ density: v })}
                options={[
                  { value: "comfortable", label: t("Comfortable", "আরামদায়ক") },
                  { value: "compact", label: t("Compact", "ঘন") },
                ]}
              />
              <p className="mt-2 text-xs text-ink-3">{t("Compact fits more rows on a laptop. Comfortable is easier to tap on a phone.", "ঘন মোডে ল্যাপটপে বেশি সারি দেখা যায়। আরামদায়ক মোডে ফোনে ট্যাপ করা সহজ।")}</p>
            </div>
          </div>
        </Section>

        {/* ---------------- typeface */}
        <Section title={t("Headline typeface", "শিরোনামের ফন্ট")} sub={t("Every face here writes Bangla and English properly.", "এখানের সব ফন্টে বাংলা ও ইংরেজি ঠিকভাবে লেখা যায়।")}>
          <div role="radiogroup" className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
            {(
              [
                ["anek", "Anek Bangla", "var(--font-anek)", t("Modern, condensed numbers", "আধুনিক")],
                ["hind", "Hind Siliguri", "var(--font-hind)", t("Clean and familiar", "পরিচিত ও পরিষ্কার")],
                ["baloo", "Baloo Da", "var(--font-baloo)", t("Friendly and round", "বন্ধুসুলভ")],
                ["geist", "Geist", "var(--font-geist)", t("Neutral, Latin-led", "নিরপেক্ষ")],
              ] as [DisplayFont, string, string, string][]
            ).map(([v, name, family, note]) => (
              <Choice key={v} selected={theme.display === v} onClick={() => setTheme({ display: v })} label={name}>
                <span className="block rounded-sm bg-surface-2 px-3 py-2.5">
                  <span className="block truncate text-[22px] font-semibold leading-tight text-ink" style={{ fontFamily: `${family}, var(--font-noto-bn)` }}>
                    বেচাকেনা Aa
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">{note}</span>
                </span>
              </Choice>
            ))}
          </div>
        </Section>

        <div className="flex justify-end pt-2">
          <Button
            variant="ghost"
            icon={<ArrowCounterClockwise className="size-4" />}
            onClick={() => {
              setTheme(DEFAULT_THEME);
              setHexDraft(DEFAULT_THEME.accent);
              toast({ title: t("Theme reset to Jamdani", "থিম জামদানিতে ফিরেছে") });
            }}
          >
            {t("Reset to default", "আগের অবস্থায় ফেরান")}
          </Button>
        </div>
      </div>

      <LivePreview />
    </div>
  );
}

/** A miniature of the real app and invoice, drawn with the live theme tokens. */
function LivePreview() {
  const t = useT();
  const f = useFmt();
  const business = useStore((s) => s.business);
  const sidebar = useStore((s) => s.theme.sidebar);
  const bold = sidebar === "bold";
  return (
    <aside className="xl:sticky xl:top-24 xl:self-start">
      <p className="mb-2 flex items-center gap-2 text-[13px] font-medium text-ink-3">
        <ImageSquare className="size-4" />
        {t("Live preview — the whole app is already using this", "লাইভ প্রিভিউ — পুরো অ্যাপে এখনই চালু")}
      </p>
      <div className="overflow-hidden rounded-xl border border-line bg-canvas shadow-2">
        <div className="flex h-[260px]">
          <div className={cn("flex w-[118px] shrink-0 flex-col gap-2 p-3", sidebar === "light" ? "border-r border-line bg-surface" : sidebar === "tinted" ? "border-r border-brand-100 bg-brand-50" : "bg-brand text-brand-contrast")}>
            <div className="flex items-center gap-1.5">
              <BrandMark size={22} />
              <span className="truncate text-[10px] font-semibold">{business.name}</span>
            </div>
            <span className={cn("mt-1 flex h-6 items-center justify-center rounded-sm text-[9.5px] font-semibold", bold ? "bg-surface text-brand-ink" : "bg-brand text-brand-contrast")}>+ {t("New order", "নতুন অর্ডার")}</span>
            {[t("Home", "হোম"), t("Orders", "অর্ডার"), t("Products", "পণ্য"), t("Stock", "স্টক")].map((x, i) => (
              <span key={x} className={cn("rounded-[5px] px-2 py-1 text-[9.5px] font-medium", i === 0 ? (bold ? "bg-white/20" : "bg-brand-50 text-brand-ink") : bold ? "text-brand-contrast/75" : "text-ink-3")}>
                {x}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1 space-y-2 p-3">
            <p className="font-display text-[15px] font-semibold leading-tight text-ink">{t("Good evening", "শুভ সন্ধ্যা")}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-line bg-surface p-2 shadow-1">
                <p className="text-[9px] text-ink-3">{t("Sales", "বিক্রি")}</p>
                <p className="figure text-[15px] font-semibold text-ink">{f.money(48500)}</p>
              </div>
              <div className="rounded-md border border-line bg-surface p-2 shadow-1">
                <p className="text-[9px] text-ink-3">{t("With couriers", "কুরিয়ারে")}</p>
                <p className="figure text-[15px] font-semibold text-cash-ink">{f.money(18200)}</p>
              </div>
            </div>
            <div className="rounded-md border border-line bg-surface p-2 shadow-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-ink">#1042 · Ayesha</span>
                <StatusPill status="packed" size="sm" />
              </div>
              <div className="mt-2 flex gap-1.5">
                <span className="flex h-6 flex-1 items-center justify-center rounded-sm bg-brand text-[9.5px] font-semibold text-brand-contrast">{t("Mark shipped", "পাঠানো হয়েছে")}</span>
                <span className="flex h-6 flex-1 items-center justify-center rounded-sm border border-line text-[9.5px] font-medium text-ink-2">{t("Print label", "লেবেল")}</span>
              </div>
            </div>
            <div className="flex gap-1">
              {[0.9, 0.55, 0.75, 0.4, 1, 0.7, 0.85].map((h, i) => (
                <span key={i} className="flex-1 rounded-t-[3px] bg-brand" style={{ height: 34 * h, opacity: i === 4 ? 1 : 0.35 }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* invoice slip */}
      <div className="mx-auto mt-5 w-[250px] drop-shadow-[0_6px_14px_rgb(22_24_26/0.12)]">
        <div className="receipt-edge bg-white px-4 pb-6 pt-4 text-[10px] text-[#222]">
          <div className="flex flex-col items-center gap-1 border-b border-dashed border-[#ccc] pb-2.5 text-center">
            <BrandMark size={30} />
            <p className="font-display text-[13px] font-semibold" style={{ color: "var(--brand-ink)" }}>
              {business.name}
            </p>
            <p className="text-[9px] text-[#666]">{business.phone}</p>
          </div>
          <div className="space-y-1 border-b border-dashed border-[#ccc] py-2">
            <div className="flex justify-between">
              <span>Jamdani Saree × 1</span>
              <span>৳6,500</span>
            </div>
            <div className="flex justify-between">
              <span>{t("Delivery", "ডেলিভারি")}</span>
              <span>৳70</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 text-[12px] font-bold">
            <span>{t("COD to collect", "COD আদায়")}</span>
            <span className="rounded-[3px] px-1.5 py-0.5 text-white" style={{ background: "var(--brand)", color: "var(--brand-contrast)" }}>
              ৳6,570
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

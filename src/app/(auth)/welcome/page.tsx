"use client";

import { ArrowLeft, ArrowRight, Check, Globe, Sparkle, Storefront, UploadSimple } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ChannelIcon } from "@/components/bits";
import { Button, cn, Field, Input, Switch, Textarea } from "@/components/ui/core";
import { CHANNELS, normalizePhone } from "@/lib/domain";
import { useT } from "@/lib/hooks";
import { CHANNEL_LABEL } from "@/lib/labels";
import { useStore } from "@/lib/store";
import { enterAccount } from "@/lib/sync";
import { extractLogoColors, THEME_PRESETS } from "@/lib/theme";
import type { Channel } from "@/lib/types";

async function fileToLogo(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 256 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function WelcomePage() {
  const t = useT();
  const router = useRouter();
  const setTheme = useStore((s) => s.setTheme);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [type, setType] = useState<"online" | "shop" | "both">("online");
  const [channels, setChannels] = useState<Channel[]>(["facebook"]);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [accent, setAccent] = useState(THEME_PRESETS[0].hex);
  const [sample, setSample] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const steps = [t("Your shop", "আপনার দোকান"), t("Where you sell", "কোথায় বিক্রি করেন"), t("Make it yours", "নিজের মতো সাজান")];
  const phoneOk = !phone || !!normalizePhone(phone);
  const canNext = step === 0 ? name.trim().length >= 2 && ownerName.trim().length > 0 : step === 1 ? channels.length > 0 && phoneOk : true;

  const pickAccent = (hex: string) => {
    setAccent(hex);
    setTheme({ accent: hex }); // preview the colour right away
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, ownerName, type, channels, phone: normalizePhone(phone) ?? undefined, address, logo, accent, sample }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't create your shop");
      const me = await fetch("/api/auth/me").then((r) => r.json());
      await enterAccount(me.user.id);
      router.replace("/dashboard");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-5 py-8">
      <ol className="flex items-center gap-2" aria-label={t("Setup steps", "সেটআপের ধাপ")}>
        {steps.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors", i < step ? "bg-brand text-brand-contrast" : i === step ? "bg-brand-50 text-brand-ink ring-2 ring-brand" : "bg-sunken text-ink-4")}>
              {i < step ? <Check className="size-3.5" weight="bold" /> : i + 1}
            </span>
            <span className={cn("hidden text-[13px] font-medium sm:block", i === step ? "text-ink" : "text-ink-3")}>{label}</span>
            {i < steps.length - 1 && <span className={cn("h-0.5 flex-1 rounded", i < step ? "bg-brand" : "bg-line")} />}
          </li>
        ))}
      </ol>

      <div className="flex flex-1 flex-col justify-center py-10">
        {step === 0 && (
          <section>
            <h1 className="font-display text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink">{t("Let's set up your shop", "চলুন দোকান সাজাই")}</h1>
            <p className="mt-2 text-[15px] text-ink-3">{t("Takes about two minutes. You can change everything later.", "দুই মিনিটের মতো লাগবে। পরে সব বদলানো যাবে।")}</p>
            <div className="mt-8 grid gap-4">
              <Field label={t("Shop name", "দোকানের নাম")} htmlFor="w-name">
                <Input id="w-name" autoFocus inputSize="lg" placeholder={t("e.g. Rongdhonu Boutique", "যেমন: রংধনু বুটিক")} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label={t("Your name", "আপনার নাম")} htmlFor="w-owner">
                <Input id="w-owner" inputSize="lg" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </Field>
              <div>
                <p className="mb-2 text-[13px] font-medium text-ink-2">{t("How do you sell?", "কীভাবে বিক্রি করেন?")}</p>
                <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      ["online", Globe, t("Online", "অনলাইনে"), t("Facebook, WhatsApp…", "ফেসবুক, হোয়াটসঅ্যাপ…")],
                      ["shop", Storefront, t("In a shop", "দোকানে"), t("Walk-in customers", "সরাসরি কাস্টমার")],
                      ["both", Sparkle, t("Both", "দুটোই"), t("Online and counter", "অনলাইন ও দোকান")],
                    ] as const
                  ).map(([v, I, label, sub]) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={type === v}
                      onClick={() => {
                        setType(v);
                        if (v === "shop") setChannels(["walkin"]);
                        else if (channels.length === 1 && channels[0] === "walkin") setChannels(["facebook"]);
                      }}
                      className={cn("flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all", type === v ? "border-brand bg-brand-50 shadow-[var(--ring)]" : "border-line bg-surface hover:border-line-strong")}
                    >
                      <I className={cn("size-6", type === v ? "text-brand-ink" : "text-ink-3")} weight="duotone" />
                      <span>
                        <span className="block text-sm font-semibold text-ink">{label}</span>
                        <span className="block text-xs text-ink-3">{sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {step === 1 && (
          <section>
            <h1 className="font-display text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink">{t("Where do orders come from?", "অর্ডার কোথা থেকে আসে?")}</h1>
            <p className="mt-2 text-[15px] text-ink-3">{t("Pick all that apply. The order screen will remember your usual one.", "যতগুলো প্রযোজ্য বাছুন। অর্ডার স্ক্রিন আপনার নিয়মিতটি মনে রাখবে।")}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {CHANNELS.filter((c) => c !== "other").map((c) => {
                const on = channels.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setChannels(on ? channels.filter((x) => x !== c) : [...channels, c])}
                    className={cn("inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all", on ? "border-brand bg-brand-50 text-ink" : "border-line bg-surface text-ink-2 hover:border-line-strong")}
                  >
                    <ChannelIcon channel={c} />
                    {t.pick(CHANNEL_LABEL[c])}
                    {on && <Check className="size-3.5 text-brand-ink" weight="bold" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-8 grid gap-4">
              <Field label={t("Shop phone for invoices", "ইনভয়েসের জন্য দোকানের ফোন")} htmlFor="w-phone" optional={t("optional", "ঐচ্ছিক")} error={!phoneOk ? t("Use a Bangladeshi mobile number", "বাংলাদেশি মোবাইল নম্বর দিন") : undefined}>
                <Input id="w-phone" inputMode="tel" placeholder="017XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!phoneOk} />
              </Field>
              <Field label={t("Address for invoices", "ইনভয়েসের ঠিকানা")} htmlFor="w-addr" optional={t("optional", "ঐচ্ছিক")}>
                <Textarea id="w-addr" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
              </Field>
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="font-display text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink">{t("Make it look like your shop", "দোকানের মতো করে সাজান")}</h1>
            <p className="mt-2 text-[15px] text-ink-3">{t("Your logo and colour go on every invoice your customers receive.", "আপনার লোগো ও রং কাস্টমারের প্রতিটি ইনভয়েসে থাকবে।")}</p>
            <div className="mt-8 flex items-center gap-4 rounded-lg border-2 border-dashed border-line-strong bg-surface-2 p-4">
              <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-brand font-display text-xl font-semibold text-brand-contrast">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {logo ? <img src={logo} alt="" className="size-full bg-white object-contain" /> : name.trim().slice(0, 2).toUpperCase() || "BK"}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">{logo ? t("Looks good", "সুন্দর হয়েছে") : t("Add your logo", "লোগো যোগ করুন")}</p>
                <p className="text-[13px] text-ink-3">{t("PNG, JPG or SVG. We'll suggest colours from it.", "PNG, JPG বা SVG। লোগো থেকে রং সাজেস্ট করব।")}</p>
              </div>
              <Button icon={<UploadSimple className="size-4" />} onClick={() => fileRef.current?.click()}>
                {logo ? t("Change", "বদলান") : t("Upload", "আপলোড")}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f || f.size > 4 * 1024 * 1024) return;
                  const data = await fileToLogo(f);
                  setLogo(data);
                  const colors = await extractLogoColors(data, 4);
                  setSuggested(colors);
                  if (colors[0]) pickAccent(colors[0]);
                }}
              />
            </div>
            <p className="mb-2 mt-6 text-[13px] font-medium text-ink-2">{suggested.length ? t("From your logo, or a classic", "লোগো থেকে, অথবা পছন্দের একটি") : t("Pick a colour", "একটি রং বাছুন")}</p>
            <div className="flex flex-wrap gap-2.5" role="radiogroup">
              {[...suggested, ...THEME_PRESETS.map((p) => p.hex)].slice(0, 10).map((hex, i) => (
                <button
                  key={`${hex}${i}`}
                  type="button"
                  role="radio"
                  aria-checked={accent.toLowerCase() === hex.toLowerCase()}
                  aria-label={THEME_PRESETS.find((p) => p.hex === hex)?.name ?? hex}
                  onClick={() => pickAccent(hex)}
                  className={cn("grid size-11 place-items-center rounded-full transition-transform hover:scale-105", accent.toLowerCase() === hex.toLowerCase() && "ring-2 ring-ink ring-offset-2 ring-offset-canvas")}
                  style={{ background: hex }}
                >
                  {accent.toLowerCase() === hex.toLowerCase() && <Check className="size-4 text-white mix-blend-difference" weight="bold" />}
                </button>
              ))}
            </div>
            <div className="mt-8 flex items-start justify-between gap-4 rounded-lg border border-line bg-surface p-4">
              <div>
                <p className="text-sm font-medium text-ink">{t("Start with sample products and orders", "নমুনা পণ্য ও অর্ডার দিয়ে শুরু")}</p>
                <p className="mt-0.5 text-[13px] text-ink-3">{t("Helpful for a tour. Delete them whenever you like.", "ঘুরে দেখার জন্য সুবিধা। যখন খুশি মুছে ফেলুন।")}</p>
              </div>
              <Switch checked={sample} onChange={setSample} label={t("Sample data", "নমুনা তথ্য")} />
            </div>
            {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}
          </section>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
        {step > 0 ? (
          <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => setStep(step - 1)}>
            {t("Back", "পেছনে")}
          </Button>
        ) : (
          <span />
        )}
        {step < 2 ? (
          <Button variant="primary" size="lg" disabled={!canNext} iconRight={<ArrowRight className="size-4" weight="bold" />} onClick={() => setStep(step + 1)}>
            {t("Continue", "এগিয়ে যান")}
          </Button>
        ) : (
          <Button variant="primary" size="lg" loading={busy} onClick={create}>
            {t("Open my shop", "দোকান খুলুন")}
          </Button>
        )}
      </div>
    </div>
  );
}

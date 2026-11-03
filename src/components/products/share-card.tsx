"use client";

import { Copy, DownloadSimple } from "@phosphor-icons/react";
import { toPng } from "html-to-image";
import { useRef, useState } from "react";
import { BrandMark } from "../bits";
import { CardArt } from "./card-art";
import { Button, Segmented } from "../ui/core";
import { Sheet, useToast } from "../ui/overlays";
import { priceRange } from "./utils";
import { useT } from "@/lib/hooks";
import { makeFormatters } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";

/** Share-ready square card for Facebook / WhatsApp posts (SRS FR-PRD-11). */
export function ShareCardSheet({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const [lang, setLang] = useState<"en" | "bn">(t.lang);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const download = async () => {
    if (!cardRef.current || !product) return;
    setBusy(true);
    try {
      const url = await toPng(cardRef.current, { pixelRatio: 3, cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${product.name.replace(/\s+/g, "-").toLowerCase()}.png`;
      a.click();
      toast({ title: t("Card saved as an image", "কার্ড ছবি হিসেবে সেভ হয়েছে"), body: t("Post it on Facebook or send it on WhatsApp.", "ফেসবুকে পোস্ট করুন বা হোয়াটসঅ্যাপে পাঠান।") });
    } catch {
      toast({ title: t("Couldn't create the image", "ছবি তৈরি করা যায়নি"), body: t("Try again, or take a screenshot of the card.", "আবার চেষ্টা করুন বা স্ক্রিনশট নিন।"), tone: "warn" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={!!product}
      onClose={onClose}
      title={t("Share card", "শেয়ার কার্ড")}
      sub={t("A square image ready for your page, group or WhatsApp status.", "পেজ, গ্রুপ বা হোয়াটসঅ্যাপ স্ট্যাটাসের জন্য বর্গাকার ছবি।")}
      width={480}
      footer={
        product && (
          <>
            <CopyCaption product={product} lang={lang} />
            <Button variant="primary" className="ml-auto" loading={busy} icon={<DownloadSimple className="size-4" />} onClick={download}>
              {t("Download image", "ছবি ডাউনলোড")}
            </Button>
          </>
        )
      }
    >
      {product && (
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink-2">{t("Card language", "কার্ডের ভাষা")}</span>
            <Segmented
              size="sm"
              value={lang}
              onChange={setLang}
              options={[
                { value: "en", label: "English" },
                { value: "bn", label: "বাংলা" },
              ]}
            />
          </div>
          <div className="overflow-hidden rounded-lg border border-line shadow-2">
            <ShareCard ref={cardRef} product={product} lang={lang} />
          </div>
        </div>
      )}
    </Sheet>
  );
}

function captionFor(p: Product, lang: "en" | "bn", business: { name: string; nameBn: string; phone: string }) {
  const f = makeFormatters({ lang, numerals: lang === "bn" ? "bangla" : "latin" });
  const r = priceRange(p);
  const price = r.max > r.min ? `${f.money(r.min)} – ${f.money(r.max)}` : f.money(r.min);
  const opts = p.optionTypes.map((o) => `${o.name}: ${o.values.join(", ")}`).join("\n");
  const code = p.variants[0]?.sku.split("-")[0] ?? "";
  if (lang === "bn")
    return `${p.nameBn || p.name}\nদাম: ${price}\n${opts ? opts + "\n" : ""}কোড: ${code}\n\nঅর্ডার করতে ইনবক্স করুন বা কল করুন ${f.digits(business.phone)}। সারা দেশে ক্যাশ অন ডেলিভারি।\n— ${business.nameBn || business.name}`;
  return `${p.name}\nPrice: ${price}\n${opts ? opts + "\n" : ""}Code: ${code}\n\nInbox us or call ${business.phone} to order. Cash on delivery all over Bangladesh.\n— ${business.name}`;
}

function CopyCaption({ product, lang }: { product: Product; lang: "en" | "bn" }) {
  const t = useT();
  const toast = useToast();
  const business = useStore((s) => s.business);
  return (
    <Button
      icon={<Copy className="size-4" />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(captionFor(product, lang, business));
          toast({ title: t("Caption copied", "ক্যাপশন কপি হয়েছে"), body: t("Paste it under the image when you post.", "পোস্টের সময় ছবির নিচে পেস্ট করুন।") });
        } catch {
          toast({ title: t("Couldn't copy", "কপি হয়নি"), tone: "warn" });
        }
      }}
    >
      {t("Copy caption", "ক্যাপশন কপি")}
    </Button>
  );
}

const ShareCard = ({ product: p, lang, ref }: { product: Product; lang: "en" | "bn"; ref: React.Ref<HTMLDivElement> }) => {
  const business = useStore((s) => s.business);
  // The card follows its own language, not the app's, so numerals match the copy.
  const f = makeFormatters({ lang, numerals: lang === "bn" ? "bangla" : "latin" });
  const L = (en: string, bn: string) => (lang === "bn" ? bn : en);
  const r = priceRange(p);
  const mrp = p.variants.find((v) => v.mrp && v.mrp > v.price)?.mrp;
  const code = p.variants[0]?.sku.split("-")[0] ?? "";
  const sizes = p.optionTypes.find((o) => !/colou?r/i.test(o.name));
  const colours = p.optionTypes.find((o) => /colou?r/i.test(o.name));
  const off = mrp ? Math.round(((mrp - r.min) / mrp) * 100) : 0;
  return (
    <div ref={ref} className="relative aspect-square w-full bg-surface font-sans text-ink" style={{ containerType: "inline-size" }}>
      <div className="absolute inset-x-0 top-0 h-[62%] overflow-hidden">
        <CardArt product={p} hover={false} className="absolute inset-0" />
        {off > 0 && (
          <span className="absolute right-[4cqw] top-[4cqw] grid size-[17cqw] place-items-center rounded-full bg-cash text-center font-display font-bold leading-none text-[#2b1a00] shadow-2" style={{ fontSize: "4.4cqw" }}>
            {f.num(off)}%<br />
            <span style={{ fontSize: "2.8cqw" }}>{L("off", "ছাড়")}</span>
          </span>
        )}
        <span className="absolute left-[4cqw] top-[4cqw] rounded-full bg-surface/95 px-[2.6cqw] py-[1cqw] font-semibold tracking-wide shadow-1" style={{ fontSize: "2.8cqw" }}>
          {L("Code", "কোড")} {code}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-[13%] top-[62%] flex flex-col justify-center px-[5cqw]">
        <p className="line-clamp-1 font-display font-semibold leading-tight" style={{ fontSize: "5.6cqw" }}>
          {lang === "bn" ? p.nameBn || p.name : p.name}
        </p>
        <div className="mt-[1.2cqw] flex items-baseline gap-[2cqw]">
          <span className="figure font-bold text-brand-ink" style={{ fontSize: "8.4cqw", lineHeight: 1 }}>
            {f.money(r.min)}
          </span>
          {mrp && (
            <span className="tnum text-ink-4 line-through" style={{ fontSize: "3.6cqw" }}>
              {f.money(mrp)}
            </span>
          )}
        </div>
        {(sizes || colours) && (
          <p className="mt-[1.4cqw] line-clamp-1 text-ink-2" style={{ fontSize: "3.1cqw" }}>
            {[sizes && `${sizes.values.join(" · ")}`, colours && colours.values.join(" · ")].filter(Boolean).join("  |  ")}
          </p>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex h-[13%] items-center gap-[2.4cqw] bg-brand px-[5cqw] text-brand-contrast">
        <BrandMark size={34} className="ring-2 ring-white/40" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-semibold" style={{ fontSize: "3.4cqw" }}>
            {lang === "bn" ? business.nameBn || business.name : business.name}
          </p>
          <p className="truncate opacity-80" style={{ fontSize: "2.7cqw" }}>
            {L("Inbox to order · Cash on delivery", "অর্ডার করতে ইনবক্স করুন · ক্যাশ অন ডেলিভারি")}
          </p>
        </div>
        <p className="tnum shrink-0 font-semibold" style={{ fontSize: "3.2cqw" }}>
          {f.digits(business.phone)}
        </p>
      </div>
    </div>
  );
};

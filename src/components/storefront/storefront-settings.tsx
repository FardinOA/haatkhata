"use client";

import { ArrowSquareOut, Check, Copy, Storefront as StoreIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SettingsCard } from "../settings/sections";
import { Badge, Button, EmptyState, Field, Input, Skeleton, Switch } from "../ui/core";
import { useToast } from "../ui/overlays";
import { useCan, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";

type Settings = {
  saved: boolean;
  slug: string;
  enabled: boolean;
  showStock: boolean;
  banner: string;
  deliveryInside: number;
  deliveryOutside: number;
  whatsapp: string | null;
  messenger: string | null;
};

/** Settings → Online catalogue: publish a shareable product page (v3 mini catalogue). */
export function StorefrontSettings() {
  const t = useT();
  const can = useCan();
  const toast = useToast();
  const mode = useStore((s) => s.sync.mode);
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (mode !== "account") return;
    fetch("/api/storefront/settings")
      .then((r) => r.json())
      .then((d: Settings) => {
        setS(d);
        setSaved(d);
      })
      .catch(() => setError({ message: t("Couldn't load your catalogue settings", "ক্যাটালগ সেটিংস লোড হয়নি") }));
  }, [mode, t]);

  if (mode !== "account")
    return (
      <SettingsCard title={t("Online catalogue", "অনলাইন ক্যাটালগ")} sub={t("A shareable page where customers browse and order.", "কাস্টমার যেখানে দেখে অর্ডার করতে পারেন এমন শেয়ারযোগ্য পেজ।")}>
        <EmptyState icon={<StoreIcon />} title={t("Sign in to publish a catalogue", "ক্যাটালগ প্রকাশ করতে সাইন ইন করুন")} body={t("The demo shop lives only on this device. Your own shop's catalogue gets a public link.", "ডেমো দোকান শুধু এই ডিভাইসে থাকে। আপনার নিজের দোকানের ক্যাটালগে পাবলিক লিংক থাকে।")} action={<Link href="/login" className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-contrast">{t("Sign in", "সাইন ইন")}</Link>} />
      </SettingsCard>
    );

  if (!s)
    return (
      <SettingsCard title={t("Online catalogue", "অনলাইন ক্যাটালগ")}>
        <Skeleton className="h-40 w-full" />
      </SettingsCard>
    );

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/s/${s.slug}`;
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  const editable = can("settings");

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/storefront/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...s, saved: undefined, whatsapp: s.whatsapp || null, messenger: s.messenger || null }) });
      const d = await res.json();
      if (!res.ok) throw Object.assign(new Error(d.error), { field: d.code });
      setS(d);
      setSaved(d);
      toast({ title: d.enabled ? t("Catalogue is live", "ক্যাটালগ চালু হয়েছে") : t("Catalogue saved", "ক্যাটালগ সেভ হয়েছে") });
    } catch (e) {
      setError({ field: (e as { field?: string }).field, message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard
      title={t("Online catalogue", "অনলাইন ক্যাটালগ")}
      sub={t("Share one link in your Facebook bio. Orders arrive as drafts for you to confirm.", "ফেসবুক বায়োতে একটি লিংক দিন। অর্ডার খসড়া হিসেবে আসবে, আপনি নিশ্চিত করবেন।")}
      footer={
        editable ? (
          <>
            <Button variant="ghost" disabled={!dirty || busy} onClick={() => setS(saved)}>
              {t("Discard", "বাতিল")}
            </Button>
            <Button variant="primary" loading={busy} disabled={!dirty} onClick={save}>
              {t("Save changes", "সেভ করুন")}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="flex items-center justify-between gap-4 rounded-md bg-surface-2 p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            {t("Catalogue is", "ক্যাটালগ")} {s.enabled ? <Badge tone="ok" dot>{t("Live", "চালু")}</Badge> : <Badge dot>{t("Off", "বন্ধ")}</Badge>}
          </p>
          {saved?.enabled && saved.saved && (
            <p className="mt-1 truncate text-[13px] text-ink-3">
              <a href={`/s/${saved.slug}`} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-ink hover:underline">
                {url.replace(/^https?:\/\//, "")}
              </a>
            </p>
          )}
        </div>
        <Switch checked={s.enabled} disabled={!editable} onChange={(v) => setS({ ...s, enabled: v })} label={t("Catalogue on", "ক্যাটালগ চালু")} />
      </div>
      {saved?.enabled && saved.saved && (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            onClick={async () => {
              await navigator.clipboard?.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? t("Copied", "কপি হয়েছে") : t("Copy link", "লিংক কপি")}
          </Button>
          <a href={`/s/${saved.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-2 rounded-sm px-3 text-[13px] font-medium text-ink-2 hover:bg-sunken">
            <ArrowSquareOut className="size-4" />
            {t("Open", "খুলুন")}
          </a>
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label={t("Web address", "ওয়েব ঠিকানা")} htmlFor="sf-slug" className="sm:col-span-2" hint={`${origin.replace(/^https?:\/\//, "")}/s/${s.slug}`} error={error?.field === "slug" ? error.message : undefined}>
          <Input id="sf-slug" disabled={!editable} value={s.slug} onChange={(e) => setS({ ...s, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} leading={<span className="text-xs">/s/</span>} />
        </Field>
        <Field label={t("Banner message", "ব্যানার বার্তা")} htmlFor="sf-banner" className="sm:col-span-2" optional={t("optional", "ঐচ্ছিক")} hint={t("e.g. Eid collection is live — free delivery over ৳3,000", "যেমন: ঈদ কালেকশন এসেছে — ৳৩,০০০ এর বেশি হলে ফ্রি ডেলিভারি")}>
          <Input id="sf-banner" disabled={!editable} maxLength={160} value={s.banner} onChange={(e) => setS({ ...s, banner: e.target.value })} />
        </Field>
        <Field label={t("Delivery inside Dhaka", "ঢাকার ভিতরে ডেলিভারি")} htmlFor="sf-in">
          <Input id="sf-in" disabled={!editable} inputMode="numeric" value={s.deliveryInside} onChange={(e) => setS({ ...s, deliveryInside: Number(e.target.value.replace(/\D/g, "")) || 0 })} leading={<span className="text-xs">৳</span>} />
        </Field>
        <Field label={t("Delivery outside Dhaka", "ঢাকার বাইরে ডেলিভারি")} htmlFor="sf-out">
          <Input id="sf-out" disabled={!editable} inputMode="numeric" value={s.deliveryOutside} onChange={(e) => setS({ ...s, deliveryOutside: Number(e.target.value.replace(/\D/g, "")) || 0 })} leading={<span className="text-xs">৳</span>} />
        </Field>
        <Field label={t("WhatsApp number", "হোয়াটসঅ্যাপ নম্বর")} htmlFor="sf-wa" optional={t("optional", "ঐচ্ছিক")} error={error?.field === "whatsapp" ? error.message : undefined}>
          <Input id="sf-wa" disabled={!editable} inputMode="tel" placeholder="017XXXXXXXX" value={s.whatsapp ?? ""} onChange={(e) => setS({ ...s, whatsapp: e.target.value })} />
        </Field>
        <Field label={t("Facebook page username", "ফেসবুক পেজের ইউজারনেম")} htmlFor="sf-ms" optional={t("optional", "ঐচ্ছিক")} hint={t("For the Messenger button: m.me/your-page", "মেসেঞ্জার বাটনের জন্য: m.me/your-page")}>
          <Input id="sf-ms" disabled={!editable} value={s.messenger ?? ""} onChange={(e) => setS({ ...s, messenger: e.target.value })} />
        </Field>
      </div>
      <div className="mt-5 flex items-center justify-between gap-4 border-t border-line pt-4">
        <div>
          <p className="text-sm font-medium text-ink">{t("Show how many are left", "কতটি বাকি আছে দেখান")}</p>
          <p className="mt-0.5 text-[13px] text-ink-3">{t("Off: customers only see in stock or sold out.", "বন্ধ থাকলে কাস্টমার শুধু “স্টকে আছে” বা “শেষ” দেখবেন।")}</p>
        </div>
        <Switch checked={s.showStock} disabled={!editable} onChange={(v) => setS({ ...s, showStock: v })} label={t("Show stock", "স্টক দেখান")} />
      </div>
      {error && !error.field && <p className="mt-3 text-[13px] text-danger">{error.message}</p>}
    </SettingsCard>
  );
}

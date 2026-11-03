"use client";

import { ChatText, Coins, Plus } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { Badge, Button, cn, Segmented, Switch, Textarea } from "../ui/core";
import { useToast } from "../ui/overlays";
import { useFmt, useNow, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";

type Key = "order_confirmed" | "order_shipped" | "order_delivered" | "due_reminder";
type Template = { key: Key; lang: "en" | "bn"; body: string; enabled: boolean; custom: boolean };
type Overview = { balance: number; templates: Template[]; ledger: { id: number; delta: number; reason: string; ref: string | null; at: string }[]; log: { id: number; toPhone: string; templateKey: string | null; body: string; status: string; error: string | null; parts: number; at: string }[] };

const KEY_META: Record<Key, { en: string; bn: string; when: [string, string] }> = {
  order_confirmed: { en: "Order confirmed", bn: "অর্ডার নিশ্চিত", when: ["When an order is confirmed", "অর্ডার নিশ্চিত হলে"] },
  order_shipped: { en: "On its way", bn: "পাঠানো হয়েছে", when: ["When marked shipped, with tracking", "পাঠানো হলে, ট্র্যাকিংসহ"] },
  order_delivered: { en: "Delivered — thank you", bn: "ডেলিভারি — ধন্যবাদ", when: ["When marked delivered", "ডেলিভারি হলে"] },
  due_reminder: { en: "Payment reminder", bn: "বাকির রিমাইন্ডার", when: ["Sent by you, only to customers who agreed", "আপনি পাঠাবেন, শুধু সম্মত কাস্টমারকে"] },
};

const VARS = ["customer", "shop", "order", "total", "cod", "due", "courier", "tracking", "shop_phone"];
const SAMPLE: Record<string, string> = { customer: "Ayesha", shop: "Rongdhonu Boutique", order: "1042", total: "1,520", cod: "1,450", due: "800", courier: "Steadfast", tracking: "ST3383517", shop_phone: "01711-234567" };

function parts(text: string) {
  const unicode = /[^\u0000-\u007f]/.test(text.replace(/৳/g, "Tk"));
  const single = unicode ? 70 : 160;
  return { n: text.length <= single ? 1 : Math.ceil(text.length / (unicode ? 67 : 153)), unicode, len: text.length };
}

/** Customer SMS: templates, credits and what was sent (FR-NOT-03, FR-PAY-03). */
export function SmsSettings() {
  const t = useT();
  const f = useFmt();
  const now = useNow();
  const toast = useToast();
  const account = useStore((s) => s.sync.mode === "account");
  const [data, setData] = useState<Overview | null>(null);
  const [active, setActive] = useState<Key>("order_confirmed");
  const [draft, setDraft] = useState<Template | null>(null);
  const [tab, setTab] = useState<"templates" | "log">("templates");

  const load = useCallback(() => api<Overview>("/api/sms").then((d) => {
    setData(d);
    setDraft((cur) => cur ?? d.templates.find((x) => x.key === "order_confirmed") ?? null);
  }), []);
  useEffect(() => {
    if (account) void load().catch((e) => toast({ tone: "warn", title: (e as Error).message }));
  }, [account, load, toast]);

  const preview = useMemo(() => (draft ? draft.body.replace(/\{(\w+)\}/g, (m, k: string) => SAMPLE[k] ?? m) : ""), [draft]);
  const p = parts(preview);

  if (!account) return <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-3">{t("Customer SMS needs your shop account.", "কাস্টমার SMS-এর জন্য দোকানের অ্যাকাউন্ট লাগবে।")}</p>;
  if (!data || !draft) return <div className="skeleton h-64 rounded-lg" />;

  const pick = (k: Key) => {
    setActive(k);
    setDraft(data.templates.find((x) => x.key === k)!);
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.templates.find((x) => x.key === draft.key));

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-cash-soft/60 p-4">
        <span className="grid size-11 place-items-center rounded-full bg-cash text-[#2b1a00]">
          <Coins className="size-5" weight="fill" />
        </span>
        <div className="flex-1">
          <p className="figure text-[26px] font-semibold leading-none text-ink">{f.num(data.balance)}</p>
          <p className="mt-1 text-[13px] text-ink-3">{t("SMS credits left · Bangla messages use one credit per 70 letters", "SMS ক্রেডিট বাকি · বাংলায় প্রতি ৭০ অক্ষরে ১ ক্রেডিট")}</p>
        </div>
        <Button
          size="sm"
          icon={<Plus className="size-4" weight="bold" />}
          onClick={() =>
            api("/api/sms/credits", { method: "POST", json: { credits: 100 } }).then(
              () => load(),
              (e) => toast({ tone: "warn", title: (e as Error).message }),
            )
          }
        >
          {t("Add credits", "ক্রেডিট যোগ")}
        </Button>
      </section>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "templates", label: t("Messages", "মেসেজ") },
          { value: "log", label: t(`Sent (${data.log.length})`, `পাঠানো (${f.num(data.log.length)})`) },
        ]}
      />

      {tab === "templates" ? (
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <ul className="space-y-1">
            {data.templates.map((x) => (
              <li key={x.key}>
                <button type="button" onClick={() => pick(x.key)} className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left", active === x.key ? "bg-brand-50" : "hover:bg-sunken")}>
                  <ChatText className={cn("size-5 shrink-0", active === x.key ? "text-brand-ink" : "text-ink-3")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{t(KEY_META[x.key].en, KEY_META[x.key].bn)}</span>
                    <span className="block truncate text-xs text-ink-3">{t(...KEY_META[x.key].when)}</span>
                  </span>
                  <span className={cn("size-2 shrink-0 rounded-full", x.enabled ? "bg-ok" : "bg-line-strong")} aria-label={x.enabled ? t("On", "চালু") : t("Off", "বন্ধ")} />
                </button>
              </li>
            ))}
          </ul>
          <div className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{t(KEY_META[draft.key].en, KEY_META[draft.key].bn)}</p>
              <div className="flex items-center gap-3">
                <Segmented<"en" | "bn"> size="sm" value={draft.lang} onChange={(lang) => setDraft({ ...draft, lang })} options={[{ value: "bn", label: "বাংলা" }, { value: "en", label: "English" }]} />
                <Switch checked={draft.enabled} onChange={(enabled) => setDraft({ ...draft, enabled })} label={t("Send automatically", "স্বয়ংক্রিয় পাঠান")} />
              </div>
            </div>
            <Textarea className="mt-3" rows={4} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} aria-label={t("Message", "মেসেজ")} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {VARS.map((v) => (
                <button key={v} type="button" onClick={() => setDraft({ ...draft, body: `${draft.body}{${v}}` })} className="h-7 rounded-full border border-line px-2.5 text-xs font-medium text-ink-2 hover:border-brand hover:text-brand-ink">
                  {`{${v}}`}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-[18px] rounded-bl-[6px] bg-sunken px-4 py-3 text-sm leading-relaxed text-ink">{preview}</div>
            <p className={cn("mt-2 text-xs", p.n > 1 ? "text-warn" : "text-ink-3")}>
              {t(`${p.len} characters · ${p.n} credit${p.n > 1 ? "s" : ""} per message${p.unicode ? " (Bangla)" : ""}`, `${f.num(p.len)} অক্ষর · প্রতি মেসেজে ${f.num(p.n)} ক্রেডিট`)}
            </p>
            {draft.key === "due_reminder" && <p className="mt-2 rounded-md bg-surface-2 px-3 py-2 text-xs text-ink-3">{t("Only sent to customers marked “Agreed to SMS” on their profile.", "শুধু প্রোফাইলে “SMS-এ সম্মত” চিহ্নিত কাস্টমারকে যাবে।")}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" disabled={!dirty} onClick={() => pick(draft.key)}>
                {t("Discard", "বাতিল")}
              </Button>
              <Button
                variant="primary"
                disabled={!dirty || draft.body.trim().length < 5}
                onClick={async () => {
                  await api("/api/sms/templates", { method: "PUT", json: { key: draft.key, lang: draft.lang, body: draft.body, enabled: draft.enabled } });
                  await load();
                  toast({ title: t("Message saved", "মেসেজ সেভ হয়েছে") });
                }}
              >
                {t("Save message", "সেভ করুন")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {data.log.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-3">{t("Nothing sent yet.", "এখনো কিছু পাঠানো হয়নি।")}</li>}
          {data.log.map((l) => (
            <li key={l.id} className="flex items-start gap-3 px-4 py-3">
              <Badge tone={l.status === "sent" ? "ok" : l.status === "failed" ? "danger" : "neutral"}>{l.status === "sent" ? t("Sent", "পাঠানো") : l.status === "failed" ? t("Failed", "ব্যর্থ") : t("Skipped", "বাদ")}</Badge>
              <span className="min-w-0 flex-1">
                <span className="tnum block text-[13px] font-medium text-ink">
                  {f.digits(l.toPhone)} {l.templateKey && <span className="font-normal text-ink-3">· {t(KEY_META[l.templateKey as Key]?.en ?? l.templateKey, KEY_META[l.templateKey as Key]?.bn ?? l.templateKey)}</span>}
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-3">{l.body || l.error}</span>
              </span>
              <span className="shrink-0 text-xs text-ink-4">{f.relative(l.at, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

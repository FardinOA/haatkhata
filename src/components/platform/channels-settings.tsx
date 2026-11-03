"use client";

import { FacebookLogo, InstagramLogo, LinkSimple, Trash, WhatsappLogo, type Icon } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { Badge, Button, cn, Field, Input } from "../ui/core";
import { useConfirm, useToast } from "../ui/overlays";
import { useT } from "@/lib/hooks";

type Platform = "messenger" | "instagram" | "whatsapp";
type Account = { id: string; platform: Platform; externalId: string; name: string; connected: boolean };

const META: Record<Platform, { icon: Icon; color: string; en: string; bn: string; idLabel: [string, string]; hint: [string, string] }> = {
  messenger: { icon: FacebookLogo, color: "#1877F2", en: "Facebook Page", bn: "ফেসবুক পেজ", idLabel: ["Page ID", "পেজ আইডি"], hint: ["Page settings → About → Page ID", "পেজ সেটিংস → About → Page ID"] },
  instagram: { icon: InstagramLogo, color: "#D62976", en: "Instagram", bn: "ইনস্টাগ্রাম", idLabel: ["Instagram account ID", "ইনস্টাগ্রাম অ্যাকাউন্ট আইডি"], hint: ["Meta Business Suite → Settings → Instagram", "মেটা বিজনেস স্যুট → সেটিংস → ইনস্টাগ্রাম"] },
  whatsapp: { icon: WhatsappLogo, color: "#1FA855", en: "WhatsApp number", bn: "হোয়াটসঅ্যাপ নম্বর", idLabel: ["Phone number ID", "ফোন নম্বর আইডি"], hint: ["WhatsApp Manager → API setup → Phone number ID", "হোয়াটসঅ্যাপ ম্যানেজার → API setup → Phone number ID"] },
};

/** Connect Messenger / Instagram / WhatsApp to the inbox. Without a token the account runs in sandbox. */
export function ChannelsSettings({ onChanged }: { onChanged?: () => void }) {
  const t = useT();
  const toast = useToast();
  const [confirm, confirmNode] = useConfirm();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [platform, setPlatform] = useState<Platform>("messenger");
  const [form, setForm] = useState({ name: "", externalId: "", accessToken: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<{ accounts: Account[] }>("/api/inbox/accounts").then((r) => setAccounts(r.accounts)).catch(() => {}), []);
  useEffect(() => {
    void load();
  }, [load]);

  const m = META[platform];
  return (
    <div className="space-y-5">
      {accounts.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {accounts.map((a) => {
            const A = META[a.platform];
            const I = A.icon;
            return (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-9 place-items-center rounded-full" style={{ background: `color-mix(in oklab, ${A.color} 12%, white)` }}>
                  <I className="size-5" weight="fill" style={{ color: A.color }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{a.name}</span>
                  <span className="block truncate text-xs text-ink-3">
                    {t(A.en, A.bn)} · {a.externalId}
                  </span>
                </span>
                <Badge tone={a.connected ? "ok" : "warn"} dot>
                  {a.connected ? t("Live", "চালু") : t("Sandbox", "স্যান্ডবক্স")}
                </Badge>
                <button
                  type="button"
                  aria-label={t("Disconnect", "বিচ্ছিন্ন করুন")}
                  className="grid size-8 place-items-center rounded-sm text-ink-3 hover:bg-danger-soft hover:text-danger"
                  onClick={async () => {
                    if (!(await confirm({ title: t(`Disconnect ${a.name}?`, `${a.name} বিচ্ছিন্ন করবেন?`), body: t("Past chats stay. New messages stop arriving.", "পুরোনো চ্যাট থাকবে। নতুন মেসেজ আসবে না।"), confirm: t("Disconnect", "বিচ্ছিন্ন"), danger: true }))) return;
                    await api(`/api/inbox/accounts/${a.id}`, { method: "DELETE" });
                    await load();
                    onChanged?.();
                  }}
                >
                  <Trash className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="rounded-lg border border-line bg-surface-2 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/api/inbox/accounts", { method: "POST", json: { platform, name: form.name, externalId: form.externalId, accessToken: form.accessToken || undefined } });
            setForm({ name: "", externalId: "", accessToken: "" });
            await load();
            onChanged?.();
            toast({ title: t("Channel connected", "চ্যানেল যুক্ত হয়েছে"), body: form.accessToken ? undefined : t("Running in sandbox until you add an access token.", "অ্যাক্সেস টোকেন না দেওয়া পর্যন্ত স্যান্ডবক্সে চলবে।") });
          } catch (err) {
            toast({ tone: "warn", title: (err as Error).message });
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="text-sm font-semibold text-ink">{t("Connect a channel", "চ্যানেল যুক্ত করুন")}</p>
        <div role="radiogroup" className="mt-3 grid grid-cols-3 gap-2">
          {(Object.keys(META) as Platform[]).map((p) => {
            const I = META[p].icon;
            return (
              <button key={p} type="button" role="radio" aria-checked={platform === p} onClick={() => setPlatform(p)} className={cn("flex flex-col items-center gap-1.5 rounded-md border bg-surface px-2 py-3 text-xs font-medium", platform === p ? "border-brand shadow-[var(--ring)]" : "border-line")}>
                <I className="size-6" weight="fill" style={{ color: META[p].color }} />
                {t(META[p].en, META[p].bn)}
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid gap-3">
          <Field label={t("Name in the inbox", "ইনবক্সে নাম")} htmlFor="ch-name">
            <Input id="ch-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("e.g. Rongdhonu Page", "যেমন: রংধনু পেজ")} />
          </Field>
          <Field label={t(...m.idLabel)} htmlFor="ch-id" hint={t(...m.hint)}>
            <Input id="ch-id" required value={form.externalId} onChange={(e) => setForm({ ...form, externalId: e.target.value })} />
          </Field>
          <Field label={t("Access token", "অ্যাক্সেস টোকেন")} htmlFor="ch-token" optional={t("leave empty for sandbox", "স্যান্ডবক্সের জন্য খালি রাখুন")} hint={t("Stored encrypted. Only used to send your replies.", "এনক্রিপ্ট করে রাখা হয়। শুধু উত্তর পাঠাতে ব্যবহার হয়।")}>
            <Input id="ch-token" type="password" autoComplete="off" value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-ink-3">
            <LinkSimple className="size-3.5" />
            {t("Webhook URL for Meta:", "মেটার জন্য ওয়েবহুক URL:")} <code className="rounded bg-sunken px-1.5 py-0.5 text-[11px]">/api/webhooks/meta</code>
          </p>
          <Button type="submit" variant="primary" loading={busy}>
            {t("Connect", "যুক্ত করুন")}
          </Button>
        </div>
      </form>
      {confirmNode}
    </div>
  );
}

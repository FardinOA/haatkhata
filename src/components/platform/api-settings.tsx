"use client";

import { ArrowSquareOut, Copy, Key, PaperPlaneTilt, Plus, Trash, WebhooksLogo } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { Badge, Button, Checkbox, cn, Field, Input, Switch } from "../ui/core";
import { Dialog, useConfirm, useToast } from "../ui/overlays";
import { useNow, useFmt, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";

type ApiKey = { id: string; name: string; prefix: string; scopes: ("read" | "write")[]; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };
type Endpoint = { id: string; url: string; events: string[]; active: boolean; createdAt: string };
type Delivery = { id: string; endpointId: string; event: string; status: "pending" | "delivered" | "failed"; attempts: number; lastStatus: number | null; lastError: string | null; createdAt: string };

function Secret({ value, note }: { value: string; note: string }) {
  const t = useT();
  const toast = useToast();
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 rounded-md border border-line bg-surface-2 p-2">
        <code className="min-w-0 flex-1 break-all font-mono text-[12.5px] text-ink">{value}</code>
        <Button
          size="sm"
          icon={<Copy className="size-4" />}
          onClick={() => {
            void navigator.clipboard.writeText(value);
            toast({ title: t("Copied", "কপি হয়েছে") });
          }}
        >
          {t("Copy", "কপি")}
        </Button>
      </div>
      <p className="mt-2 text-xs text-warn">{note}</p>
    </div>
  );
}

/** API keys and outbound webhooks (owner only). */
export function ApiSettings() {
  const t = useT();
  const f = useFmt();
  const now = useNow();
  const toast = useToast();
  const [confirm, confirmNode] = useConfirm();
  const account = useStore((s) => s.sync.mode === "account");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [hooks, setHooks] = useState<{ endpoints: Endpoint[]; deliveries: Delivery[]; events: string[] } | null>(null);
  const [newKey, setNewKey] = useState<{ name: string; write: boolean } | null>(null);
  const [revealed, setRevealed] = useState<{ title: string; value: string; note: string } | null>(null);
  const [newHook, setNewHook] = useState<{ url: string; events: string[] } | null>(null);

  const load = useCallback(
    () =>
      Promise.all([api<{ keys: ApiKey[] }>("/api/api-keys"), api<{ endpoints: Endpoint[]; deliveries: Delivery[]; events: string[] }>("/api/outbound-webhooks")]).then(([k, h]) => {
        setKeys(k.keys);
        setHooks(h);
      }),
    [],
  );
  useEffect(() => {
    if (account) void load().catch((e) => toast({ tone: "warn", title: (e as Error).message }));
  }, [account, load, toast]);

  if (!account) return <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-3">{t("The API needs your shop account.", "API-র জন্য দোকানের অ্যাকাউন্ট লাগবে।")}</p>;

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Key className="size-[18px] text-brand-ink" />
              {t("API keys", "API কী")}
            </h3>
            <p className="mt-0.5 text-[13px] text-ink-3">{t("Let your website or tools read products and create orders.", "ওয়েবসাইট বা টুল থেকে পণ্য দেখা ও অর্ডার তৈরি করতে।")}</p>
          </div>
          <Button size="sm" icon={<Plus className="size-4" weight="bold" />} onClick={() => setNewKey({ name: "", write: false })}>
            {t("New key", "নতুন কী")}
          </Button>
        </div>
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
          {keys.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-3">{t("No keys yet.", "এখনো কোনো কী নেই।")}</li>}
          {keys.map((k) => (
            <li key={k.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", k.revokedAt && "opacity-50")}>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{k.name}</span>
                <span className="block font-mono text-xs text-ink-3">{k.prefix}…</span>
              </span>
              <span className="flex gap-1">
                {k.scopes.map((s) => (
                  <Badge key={s} tone={s === "write" ? "warn" : "neutral"}>
                    {s === "write" ? t("Read & write", "পড়া ও লেখা") : t("Read", "পড়া")}
                  </Badge>
                ))}
              </span>
              <span className="w-28 text-right text-xs text-ink-3">{k.revokedAt ? t("Revoked", "বাতিল") : k.lastUsedAt ? t(`Used ${f.relative(k.lastUsedAt, now)}`, `ব্যবহার ${f.relative(k.lastUsedAt, now)}`) : t("Never used", "ব্যবহার হয়নি")}</span>
              {!k.revokedAt && (
                <button
                  type="button"
                  aria-label={t("Revoke", "বাতিল")}
                  className="grid size-8 place-items-center rounded-sm text-ink-3 hover:bg-danger-soft hover:text-danger"
                  onClick={async () => {
                    if (!(await confirm({ title: t(`Revoke “${k.name}”?`, `“${k.name}” বাতিল করবেন?`), body: t("Anything using this key stops working right away.", "এই কী দিয়ে চলা সবকিছু সাথে সাথে বন্ধ হবে।"), confirm: t("Revoke", "বাতিল"), danger: true }))) return;
                    await api(`/api/api-keys/${k.id}`, { method: "DELETE" });
                    await load();
                  }}
                >
                  <Trash className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <WebhooksLogo className="size-[18px] text-brand-ink" />
              {t("Webhooks", "ওয়েবহুক")}
            </h3>
            <p className="mt-0.5 text-[13px] text-ink-3">{t("We'll POST signed events to your server when orders change.", "অর্ডার বদলালে আপনার সার্ভারে সাইন করা ইভেন্ট পাঠাব।")}</p>
          </div>
          <Button size="sm" icon={<Plus className="size-4" weight="bold" />} onClick={() => setNewHook({ url: "", events: ["order.created", "order.status_changed"] })}>
            {t("Add endpoint", "এন্ডপয়েন্ট যোগ")}
          </Button>
        </div>
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
          {hooks?.endpoints.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-3">{t("No endpoints yet.", "এখনো কোনো এন্ডপয়েন্ট নেই।")}</li>}
          {hooks?.endpoints.map((e) => {
            const recent = hooks.deliveries.filter((d) => d.endpointId === e.id).slice(0, 8);
            return (
              <li key={e.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[13px] text-ink">{e.url}</span>
                    <span className="mt-0.5 block text-xs text-ink-3">{e.events.join(", ")}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<PaperPlaneTilt className="size-4" />}
                    onClick={async () => {
                      const r = await api<{ delivery: Delivery }>(`/api/outbound-webhooks/${e.id}/test`, { method: "POST" });
                      toast({ tone: r.delivery.status === "delivered" ? "ok" : "warn", title: r.delivery.status === "delivered" ? t("Ping delivered", "পিং পৌঁছেছে") : t("Ping didn't get through", "পিং পৌঁছায়নি"), body: r.delivery.lastError ?? undefined });
                      await load();
                    }}
                  >
                    {t("Send ping", "পিং")}
                  </Button>
                  <Switch
                    size="sm"
                    checked={e.active}
                    label={t("Active", "চালু")}
                    onChange={async (active) => {
                      await api(`/api/outbound-webhooks/${e.id}`, { method: "PATCH", json: { active } });
                      await load();
                    }}
                  />
                  <button
                    type="button"
                    aria-label={t("Delete", "মুছুন")}
                    className="grid size-8 place-items-center rounded-sm text-ink-3 hover:bg-danger-soft hover:text-danger"
                    onClick={async () => {
                      if (!(await confirm({ title: t("Delete this endpoint?", "এন্ডপয়েন্ট মুছবেন?"), confirm: t("Delete", "মুছুন"), danger: true }))) return;
                      await api(`/api/outbound-webhooks/${e.id}`, { method: "DELETE" });
                      await load();
                    }}
                  >
                    <Trash className="size-4" />
                  </button>
                </div>
                {recent.length > 0 && (
                  <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label={t("Recent deliveries", "সাম্প্রতিক ডেলিভারি")}>
                    {recent.map((d) => (
                      <li key={d.id} title={`${d.event} · ${d.lastError ?? d.lastStatus ?? ""} · ${d.attempts} attempt(s)`}>
                        <Badge tone={d.status === "delivered" ? "ok" : d.status === "failed" ? "danger" : "warn"} className="h-[20px] px-1.5 text-[11px]">
                          {d.event} · {d.status === "delivered" ? d.lastStatus : d.status === "failed" ? t("failed", "ব্যর্থ") : t(`retry ${d.attempts}`, `আবার ${d.attempts}`)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        <Link href="/developers" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink hover:underline">
          {t("API reference and signature checking", "API রেফারেন্স ও সিগনেচার যাচাই")}
          <ArrowSquareOut className="size-4" />
        </Link>
      </section>

      <Dialog
        open={!!newKey}
        onClose={() => setNewKey(null)}
        title={t("New API key", "নতুন API কী")}
        tone="brand"
        icon={<Key weight="fill" />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewKey(null)}>
              {t("Cancel", "বাতিল")}
            </Button>
            <Button
              variant="primary"
              disabled={!newKey?.name.trim()}
              onClick={async () => {
                const r = await api<{ key: string }>("/api/api-keys", { method: "POST", json: { name: newKey!.name, scopes: newKey!.write ? ["read", "write"] : ["read"] } });
                setNewKey(null);
                setRevealed({ title: t("Your new API key", "আপনার নতুন API কী"), value: r.key, note: t("Copy it now — we won't show it again.", "এখনই কপি করুন — আর দেখানো হবে না।") });
                await load();
              }}
            >
              {t("Create key", "কী তৈরি করুন")}
            </Button>
          </>
        }
      >
        <div className="mt-2 space-y-3">
          <Field label={t("Name", "নাম")} htmlFor="key-name" hint={t("So you remember what uses it, e.g. “Website”.", "কোথায় ব্যবহার হয় মনে রাখতে, যেমন “ওয়েবসাইট”।")}>
            <Input id="key-name" data-autofocus value={newKey?.name ?? ""} onChange={(e) => setNewKey((k) => k && { ...k, name: e.target.value })} />
          </Field>
          <label className="flex items-center gap-3 text-sm text-ink-2">
            <Checkbox checked={!!newKey?.write} onChange={(v) => setNewKey((k) => k && { ...k, write: v })} label={t("Can create orders", "অর্ডার তৈরি করতে পারবে")} />
            {t("Can also create orders", "অর্ডারও তৈরি করতে পারবে")}
          </label>
        </div>
      </Dialog>

      <Dialog
        open={!!newHook}
        onClose={() => setNewHook(null)}
        title={t("Add a webhook endpoint", "ওয়েবহুক এন্ডপয়েন্ট যোগ")}
        tone="brand"
        icon={<WebhooksLogo weight="fill" />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewHook(null)}>
              {t("Cancel", "বাতিল")}
            </Button>
            <Button
              variant="primary"
              disabled={!newHook?.url.trim() || !newHook.events.length}
              onClick={async () => {
                try {
                  const r = await api<{ secret: string }>("/api/outbound-webhooks", { method: "POST", json: newHook });
                  setNewHook(null);
                  setRevealed({ title: t("Signing secret", "সাইনিং সিক্রেট"), value: r.secret, note: t("Use it to verify the X-HaatKhata-Signature header. Shown once.", "X-HaatKhata-Signature যাচাইয়ে ব্যবহার করুন। একবারই দেখানো হবে।") });
                  await load();
                } catch (e) {
                  toast({ tone: "warn", title: (e as Error).message });
                }
              }}
            >
              {t("Add endpoint", "যোগ করুন")}
            </Button>
          </>
        }
      >
        <div className="mt-2 space-y-3">
          <Field label="URL" htmlFor="hook-url">
            <Input id="hook-url" data-autofocus placeholder="https://example.com/haatkhata" value={newHook?.url ?? ""} onChange={(e) => setNewHook((h) => h && { ...h, url: e.target.value })} />
          </Field>
          <div className="space-y-2">
            {(hooks?.events ?? []).map((ev) => (
              <label key={ev} className="flex items-center gap-3 font-mono text-[13px] text-ink-2">
                <Checkbox
                  checked={!!newHook?.events.includes(ev)}
                  onChange={(v) => setNewHook((h) => h && { ...h, events: v ? [...h.events, ev] : h.events.filter((x) => x !== ev) })}
                  label={ev}
                />
                {ev}
              </label>
            ))}
          </div>
        </div>
      </Dialog>

      <Dialog open={!!revealed} onClose={() => setRevealed(null)} title={revealed?.title ?? ""} tone="cash" icon={<Key weight="fill" />} width={520} footer={<Button variant="primary" onClick={() => setRevealed(null)}>{t("Done", "সম্পন্ন")}</Button>}>
        {revealed && <Secret value={revealed.value} note={revealed.note} />}
      </Dialog>
      {confirmNode}
    </div>
  );
}

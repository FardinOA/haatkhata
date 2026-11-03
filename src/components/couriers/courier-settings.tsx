"use client";

import { CheckCircle, Copy, LinkSimple, Plugs, PlugsConnected, ShieldWarning, Truck } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, cn, Field, Input, Panel, Select, Switch, Textarea } from "../ui/core";
import { Sheet, useConfirm, useToast } from "../ui/overlays";
import { api, loadPrefs } from "./client";
import { PROVIDER_IDS, PROVIDERS } from "./courier-meta";
import { DISTRICTS } from "@/lib/geo";
import { useCan, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import type { CourierProvider } from "@/lib/types";

type Account = { provider: CourierProvider; status: string; credentials: Record<string, string>; webhookPath: string; lastCheckedAt: string | null; lastError: string | null };
type Prefs = { defaultProvider: CourierProvider | null; pickup: { name?: string; phone?: string; address?: string; district?: string }; advanceOnHighRisk: boolean };
type Wallet = { provider: "bkash" | "nagad"; status: string; credentials: Record<string, string> };

const WALLET_FIELDS: Record<"bkash" | "nagad", { key: string; en: string; bn: string; secret?: boolean; multiline?: boolean }[]> = {
  bkash: [
    { key: "username", en: "Username", bn: "ইউজারনেম" },
    { key: "password", en: "Password", bn: "পাসওয়ার্ড", secret: true },
    { key: "appKey", en: "App key", bn: "অ্যাপ কী" },
    { key: "appSecret", en: "App secret", bn: "অ্যাপ সিক্রেট", secret: true },
  ],
  nagad: [
    { key: "merchantId", en: "Merchant ID", bn: "মার্চেন্ট আইডি" },
    { key: "merchantNumber", en: "Merchant wallet number", bn: "মার্চেন্ট নম্বর" },
    { key: "merchantPrivateKey", en: "Merchant private key", bn: "মার্চেন্ট প্রাইভেট কী", secret: true, multiline: true },
    { key: "nagadPublicKey", en: "Nagad public key", bn: "নগদ পাবলিক কী", multiline: true },
  ],
};

/**
 * Settings → Couriers & payments. Connect courier merchant accounts, choose
 * the default courier and pickup point, the high-risk rule, and the shop's
 * own bKash/Nagad merchant accounts for payment links.
 */
export function CourierSettings() {
  const t = useT();
  const can = useCan();
  const toast = useToast();
  const mode = useStore((s) => s.sync.mode);
  const [ask, confirmNode] = useConfirm();
  const [data, setData] = useState<{ sandboxAllowed: boolean; accounts: Account[]; prefs: Prefs } | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [editing, setEditing] = useState<CourierProvider | null>(null);
  const [walletEditing, setWalletEditing] = useState<"bkash" | "nagad" | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs | null>(null);
  const [reload, setReload] = useState(0);
  const manage = can("settings");

  useEffect(() => {
    if (mode !== "account") return;
    let live = true;
    Promise.all([api<{ sandboxAllowed: boolean; accounts: Account[]; prefs: Prefs }>("/api/couriers/accounts"), api<{ accounts: Wallet[] }>("/api/payment-links/accounts").catch(() => ({ accounts: [] }))])
      .then(([c, w]) => {
        if (!live) return;
        setData(c);
        setPrefsState(c.prefs);
        setWallets(w.accounts);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [mode, reload]);

  const savePrefs = async (patch: Partial<Prefs>) => {
    const next = { ...(prefs as Prefs), ...patch };
    setPrefsState(next);
    try {
      await api("/api/couriers/prefs", { method: "PATCH", json: patch });
      void loadPrefs(true);
    } catch (e) {
      toast({ tone: "warn", title: (e as Error).message });
    }
  };

  const connect = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await api("/api/couriers/accounts", { method: "POST", json: { provider: editing, credentials: form } });
      toast({ title: t(`${PROVIDERS[editing].name} connected`, `${PROVIDERS[editing].name} যুক্ত হয়েছে`), body: t("We checked the details with the courier.", "কুরিয়ারের সাথে তথ্য যাচাই করা হয়েছে।") });
      setEditing(null);
      setReload((n) => n + 1);
    } catch (e) {
      toast({ tone: "warn", title: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const connectWallet = async () => {
    if (!walletEditing) return;
    setBusy(true);
    try {
      await api("/api/payment-links/accounts", { method: "POST", json: { provider: walletEditing, credentials: form } });
      toast({ title: t(`${walletEditing === "bkash" ? "bKash" : "Nagad"} connected`, `${walletEditing === "bkash" ? "বিকাশ" : "নগদ"} যুক্ত হয়েছে`) });
      setWalletEditing(null);
      setReload((n) => n + 1);
    } catch (e) {
      toast({ tone: "warn", title: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (mode !== "account")
    return (
      <Panel className="p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-ink">
            <Truck className="size-5" weight="duotone" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-ink">{t("Connect your couriers after you sign in", "সাইন ইন করে কুরিয়ার যুক্ত করুন")}</h3>
            <p className="mt-1 max-w-lg text-[13px] text-ink-3">
              {t(
                "Book Steadfast, Pathao, RedX, Paperfly and Carrybee parcels in one tap, get delivery updates automatically and take bKash or Nagad advances. In this demo the test courier already works from any order.",
                "এক ট্যাপে স্টেডফাস্ট, পাঠাও, রেডএক্স, পেপারফ্লাই ও কেরিবি বুক করুন, ডেলিভারির খবর নিজে নিজে পান, বিকাশ বা নগদে অগ্রিম নিন। এই ডেমোতে যেকোনো অর্ডার থেকে টেস্ট কুরিয়ার চলে।",
              )}
            </p>
            <Link href="/login" className="mt-3 inline-block text-[13px] font-semibold text-brand-ink hover:underline">
              {t("Sign in or create your shop", "সাইন ইন করুন বা দোকান খুলুন")}
            </Link>
          </div>
        </div>
      </Panel>
    );

  const accounts = new Map((data?.accounts ?? []).map((a) => [a.provider, a]));
  const providers = PROVIDER_IDS.filter((p) => p !== "sandbox" || data?.sandboxAllowed);
  const editingAccount = editing ? accounts.get(editing) : undefined;
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h3 className="text-[15px] font-semibold text-ink">{t("Couriers", "কুরিয়ার")}</h3>
          <p className="mt-0.5 text-[13px] text-ink-3">{t("Connect once, then book parcels and get delivery updates without typing anything twice.", "একবার যুক্ত করুন, তারপর পার্সেল বুক ও ডেলিভারির খবর — দ্বিতীয়বার কিছু লিখতে হবে না।")}</p>
        </div>
        <ul className="grid gap-px bg-line sm:grid-cols-2">
          {providers.map((p) => {
            const meta = PROVIDERS[p];
            const acc = accounts.get(p);
            return (
              <li key={p} className="flex items-center gap-3 bg-surface px-5 py-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-md text-[13px] font-bold text-white" style={{ background: meta.color }}>
                  {meta.name.slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    {meta.name}
                    {prefs?.defaultProvider === p && <Badge tone="brand">{t("Default", "ডিফল্ট")}</Badge>}
                  </p>
                  <p className={cn("mt-0.5 flex items-center gap-1 text-xs", acc ? "text-ok" : "text-ink-3")}>
                    {acc ? <PlugsConnected className="size-3.5" weight="fill" /> : <Plugs className="size-3.5" />}
                    {acc ? t("Connected", "যুক্ত") : p === "sandbox" ? t("Ready without keys", "কী ছাড়াই প্রস্তুত") : t("Not connected", "যুক্ত নয়")}
                  </p>
                </div>
                {manage && (
                  <Button
                    size="sm"
                    variant={acc ? "ghost" : "secondary"}
                    onClick={() => {
                      setForm({});
                      setEditing(p);
                    }}
                  >
                    {acc ? t("Manage", "পরিচালনা") : t("Connect", "যুক্ত করুন")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      {prefs && (
        <Panel className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h3 className="text-[15px] font-semibold text-ink">{t("Pickup & defaults", "পিকআপ ও ডিফল্ট")}</h3>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label={t("Default courier", "ডিফল্ট কুরিয়ার")} htmlFor="cs-default" hint={t("Pre-selected when you book. The best courier for each district is still suggested.", "বুক করার সময় আগে থেকে বাছাই থাকবে। প্রতিটি জেলার সেরা কুরিয়ারও দেখানো হবে।")}>
              <Select id="cs-default" disabled={!manage} value={prefs.defaultProvider ?? ""} onChange={(e) => void savePrefs({ defaultProvider: (e.target.value || null) as CourierProvider | null })}>
                <option value="">{t("Suggest the best one", "সেরাটি সাজেস্ট করুন")}</option>
                {providers.filter((p) => accounts.has(p) || p === "sandbox").map((p) => (
                  <option key={p} value={p}>
                    {PROVIDERS[p].name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("Pickup district", "পিকআপ জেলা")} htmlFor="cs-district">
              <Select id="cs-district" disabled={!manage} value={prefs.pickup.district ?? "Dhaka"} onChange={(e) => void savePrefs({ pickup: { ...prefs.pickup, district: e.target.value } })}>
                {DISTRICTS.map(([en, bn]) => (
                  <option key={en} value={en}>
                    {t(en, bn)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("Pickup address", "পিকআপ ঠিকানা")} htmlFor="cs-addr" className="sm:col-span-2">
              <Input id="cs-addr" disabled={!manage} defaultValue={prefs.pickup.address ?? ""} onBlur={(e) => e.target.value !== (prefs.pickup.address ?? "") && void savePrefs({ pickup: { ...prefs.pickup, address: e.target.value } })} />
            </Field>
          </div>
          <div className="flex items-start justify-between gap-4 border-t border-line px-5 py-4">
            <div className="flex gap-3">
              <ShieldWarning className="mt-0.5 size-5 shrink-0 text-warn" weight="duotone" />
              <div>
                <p className="text-sm font-medium text-ink">{t("Ask high-risk buyers for an advance", "ঝুঁকিপূর্ণ কাস্টমারের কাছে অগ্রিম চান")}</p>
                <p className="mt-0.5 text-[13px] text-ink-3">{t("When a phone number has refused parcels here or at other shops, the order screen suggests taking the delivery charge first.", "যে নম্বর এখানে বা অন্য দোকানে পার্সেল ফেরত দিয়েছে, অর্ডার স্ক্রিন আগে ডেলিভারি চার্জ নিতে বলবে।")}</p>
              </div>
            </div>
            <Switch checked={prefs.advanceOnHighRisk} disabled={!manage} onChange={(v) => void savePrefs({ advanceOnHighRisk: v })} label={t("Ask high-risk buyers for an advance", "ঝুঁকিপূর্ণ কাস্টমারের কাছে অগ্রিম")} />
          </div>
        </Panel>
      )}

      <Panel className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h3 className="text-[15px] font-semibold text-ink">{t("bKash & Nagad for payment links", "পেমেন্ট লিংকের জন্য বিকাশ ও নগদ")}</h3>
          <p className="mt-0.5 text-[13px] text-ink-3">{t("Buyers pay straight into your own merchant account. We never hold your money.", "কাস্টমার সরাসরি আপনার মার্চেন্ট অ্যাকাউন্টে টাকা দেন। আমরা কখনো টাকা রাখি না।")}</p>
        </div>
        <ul className="grid gap-px bg-line sm:grid-cols-2">
          {(["bkash", "nagad"] as const).map((w) => {
            const acc = wallets.find((x) => x.provider === w);
            return (
              <li key={w} className="flex items-center gap-3 bg-surface px-5 py-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-md text-[13px] font-bold text-white" style={{ background: w === "bkash" ? "var(--color-bkash)" : "var(--color-nagad)" }}>
                  {w === "bkash" ? "bK" : "Ng"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{w === "bkash" ? "bKash" : "Nagad"}</p>
                  <p className={cn("mt-0.5 flex items-center gap-1 text-xs", acc ? "text-ok" : "text-ink-3")}>
                    {acc ? <CheckCircle className="size-3.5" weight="fill" /> : <LinkSimple className="size-3.5" />}
                    {acc ? t("Ready for payment links", "পেমেন্ট লিংকের জন্য প্রস্তুত") : t("Not connected", "যুক্ত নয়")}
                  </p>
                </div>
                {can("billing") && (
                  <Button
                    size="sm"
                    variant={acc ? "ghost" : "secondary"}
                    onClick={() => {
                      setForm({});
                      setWalletEditing(w);
                    }}
                  >
                    {acc ? t("Manage", "পরিচালনা") : t("Connect", "যুক্ত করুন")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      {/* courier connect / manage */}
      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        width={480}
        title={editing ? (editingAccount ? t(`${PROVIDERS[editing].name} settings`, `${PROVIDERS[editing].name} সেটিংস`) : t(`Connect ${PROVIDERS[editing].name}`, `${PROVIDERS[editing].name} যুক্ত করুন`)) : ""}
        sub={editing ? t(PROVIDERS[editing].note, PROVIDERS[editing].noteBn) : undefined}
        footer={
          <>
            {editingAccount && (
              <Button
                variant="ghost"
                className="mr-auto text-danger"
                onClick={async () => {
                  if (!editing) return;
                  if (await ask({ title: t(`Disconnect ${PROVIDERS[editing].name}?`, `${PROVIDERS[editing].name} বিচ্ছিন্ন করবেন?`), body: t("Booked parcels keep their tracking, but status updates stop.", "বুক করা পার্সেলের ট্র্যাকিং থাকবে, তবে আপডেট বন্ধ হবে।"), confirm: t("Disconnect", "বিচ্ছিন্ন"), danger: true })) {
                    await api(`/api/couriers/accounts?provider=${editing}`, { method: "DELETE" });
                    setEditing(null);
                    setReload((n) => n + 1);
                  }
                }}
              >
                {t("Disconnect", "বিচ্ছিন্ন")}
              </Button>
            )}
            <Button variant="ghost" className={editingAccount ? "" : "ml-auto"} onClick={() => setEditing(null)}>
              {t("Cancel", "বাতিল")}
            </Button>
            <Button variant="primary" loading={busy} onClick={connect}>
              {editingAccount ? t("Test & save", "যাচাই করে সেভ") : t("Test & connect", "যাচাই করে যুক্ত")}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4 p-5">
            {PROVIDERS[editing].fields.map((fd) => (
              <Field key={fd.key} label={t(fd.en, fd.bn)} htmlFor={`cf-${fd.key}`} hint={fd.secret && editingAccount ? t("Leave blank to keep the saved value", "আগের মান রাখতে ফাঁকা রাখুন") : undefined}>
                <Input id={`cf-${fd.key}`} type={fd.secret ? "password" : "text"} autoComplete="off" placeholder={editingAccount?.credentials[fd.key] ?? ""} value={form[fd.key] ?? ""} onChange={(e) => setForm({ ...form, [fd.key]: e.target.value })} />
              </Field>
            ))}
            {editingAccount && (
              <div className="rounded-md border border-line bg-surface-2 p-3">
                <p className="text-[13px] font-medium text-ink">{t("Delivery update link", "ডেলিভারি আপডেট লিংক")}</p>
                <p className="mt-0.5 text-xs text-ink-3">{t("Paste this as the webhook / callback URL in the courier panel. It's private to your shop.", "কুরিয়ার প্যানেলে এটি ওয়েবহুক / কলব্যাক URL হিসেবে দিন। এটি শুধু আপনার দোকানের।")}</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-sm bg-surface px-2 py-1.5 text-xs text-ink-2">{origin + editingAccount.webhookPath}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Copy className="size-4" />}
                    onClick={() => {
                      void navigator.clipboard?.writeText(origin + editingAccount.webhookPath);
                      toast({ title: t("Link copied", "লিংক কপি হয়েছে") });
                    }}
                  >
                    {t("Copy", "কপি")}
                  </Button>
                </div>
                {editing === "steadfast" && <p className="mt-2 text-xs text-ink-3">{t("Steadfast also asks for an auth token: use the key at the end of this link.", "স্টেডফাস্ট একটি অথ টোকেনও চায়: এই লিংকের শেষের কী-টি দিন।")}</p>}
              </div>
            )}
            {editingAccount?.lastError && <p className="text-[13px] text-danger">{editingAccount.lastError}</p>}
          </div>
        )}
      </Sheet>

      {/* wallet connect */}
      <Sheet
        open={!!walletEditing}
        onClose={() => setWalletEditing(null)}
        width={480}
        title={walletEditing === "bkash" ? t("Connect bKash merchant", "বিকাশ মার্চেন্ট যুক্ত করুন") : t("Connect Nagad merchant", "নগদ মার্চেন্ট যুক্ত করুন")}
        sub={t("Use the API credentials from your merchant onboarding.", "মার্চেন্ট অনবোর্ডিং-এর API তথ্য দিন।")}
        footer={
          <>
            {wallets.some((w) => w.provider === walletEditing) && (
              <Button
                variant="ghost"
                className="mr-auto text-danger"
                onClick={async () => {
                  await api(`/api/payment-links/accounts?provider=${walletEditing}`, { method: "DELETE" });
                  setWalletEditing(null);
                  setReload((n) => n + 1);
                }}
              >
                {t("Disconnect", "বিচ্ছিন্ন")}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setWalletEditing(null)}>
              {t("Cancel", "বাতিল")}
            </Button>
            <Button variant="primary" loading={busy} onClick={connectWallet}>
              {t("Test & connect", "যাচাই করে যুক্ত")}
            </Button>
          </>
        }
      >
        {walletEditing && (
          <div className="space-y-4 p-5">
            {WALLET_FIELDS[walletEditing].map((fd) => (
              <Field key={fd.key} label={t(fd.en, fd.bn)} htmlFor={`wf-${fd.key}`}>
                {fd.multiline ? (
                  <Textarea id={`wf-${fd.key}`} rows={4} spellCheck={false} className="font-mono text-xs" value={form[fd.key] ?? ""} onChange={(e) => setForm({ ...form, [fd.key]: e.target.value })} placeholder={wallets.find((w) => w.provider === walletEditing)?.credentials[fd.key] ?? ""} />
                ) : (
                  <Input id={`wf-${fd.key}`} type={fd.secret ? "password" : "text"} autoComplete="off" value={form[fd.key] ?? ""} onChange={(e) => setForm({ ...form, [fd.key]: e.target.value })} placeholder={wallets.find((w) => w.provider === walletEditing)?.credentials[fd.key] ?? ""} />
                )}
              </Field>
            ))}
          </div>
        )}
      </Sheet>
      {confirmNode}
    </div>
  );
}

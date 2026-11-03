"use client";

import { ChatCircleText, CheckCircle, Copy, LinkSimple, WhatsappLogo } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, cn, EmptyState, Input, Segmented } from "../ui/core";
import { Sheet, useToast } from "../ui/overlays";
import { api } from "./client";
import { orderTotals } from "@/lib/domain";
import { useFmt, useNow, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";

type LinkRow = { id: string; token: string; provider: string; amount: number; purpose: string; status: string; createdAt: string; paidAt: string | null; trxId: string | null; expiresAt: string };
type Wallet = "bkash" | "nagad" | "sandbox";

const WALLET: Record<Wallet, { name: string; color: string }> = { bkash: { name: "bKash", color: "var(--color-bkash)" }, nagad: { name: "Nagad", color: "var(--color-nagad)" }, sandbox: { name: "Test wallet", color: "#7A45C2" } };

/** Ask the buyer to pay an advance or due online (bKash / Nagad). */
export function PaymentLinkSheet({ open, onClose, order }: { open: boolean; onClose: () => void; order: Order }) {
  const t = useT();
  const f = useFmt();
  const toast = useToast();
  const nowMs = useNow();
  const mode = useStore((s) => s.sync.mode);
  const business = useStore((s) => s.business);
  const remaining = orderTotals(order).remaining;
  const advance = Math.min(order.deliveryCharge || remaining, remaining);
  const [purpose, setPurpose] = useState<"advance" | "due">("advance");
  const [amount, setAmount] = useState(String(advance));
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!open || mode !== "account") return;
    let live = true;
    Promise.all([api<{ sandboxAllowed: boolean; accounts: { provider: Wallet }[] }>("/api/payment-links/accounts"), api<{ links: LinkRow[] }>(`/api/payment-links?orderId=${order.id}`)])
      .then(([acc, l]) => {
        if (!live) return;
        const ws = acc.accounts.map((a) => a.provider);
        if (acc.sandboxAllowed) ws.push("sandbox");
        setWallets(ws);
        setWallet((w) => w ?? ws[0] ?? null);
        setLinks(l.links);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open, mode, order.id, reload]);

  const url = (token: string) => (typeof window === "undefined" ? `/pay/${token}` : `${window.location.origin}/pay/${token}`);
  const message = (token: string, amt: number) =>
    t(
      `Hi ${order.customer?.name?.split(" ")[0] ?? ""}, please pay ৳${amt} for order #${order.no} from ${business.name}: ${url(token)}`,
      `আসসালামু আলাইকুম ${order.customer?.name?.split(" ")[0] ?? ""}, ${business.name} থেকে অর্ডার #${order.no}-এর জন্য ৳${amt} পরিশোধ করুন: ${url(token)}`,
    );

  const create = async () => {
    const n = Number(amount);
    if (!wallet || !(n > 0)) return;
    setBusy(true);
    try {
      const r = await api<{ token: string }>("/api/payment-links", { method: "POST", json: { orderId: order.id, amount: n, purpose, provider: wallet } });
      setCreated(r.token);
      setReload((n) => n + 1);
    } catch (e) {
      toast({ tone: "warn", title: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const phone = order.customer?.phone ?? "";
  return (
    <Sheet open={open} onClose={onClose} width={480} title={t("Ask to pay online", "অনলাইনে পেমেন্ট চান")} sub={t(`Order #${order.no} · ${f.money(remaining)} still to pay`, `অর্ডার #${f.digits(String(order.no))} · বাকি ${f.money(remaining)}`)}>
      {mode !== "account" ? (
        <EmptyState icon={<LinkSimple />} title={t("Payment links need a free account", "পেমেন্ট লিংকের জন্য ফ্রি অ্যাকাউন্ট লাগবে")} body={t("Buyers pay into your own bKash or Nagad merchant account.", "কাস্টমার সরাসরি আপনার বিকাশ বা নগদ মার্চেন্ট অ্যাকাউন্টে টাকা দেবেন।")} action={<Link href="/login" className="text-sm font-semibold text-brand-ink hover:underline">{t("Sign in", "সাইন ইন")}</Link>} />
      ) : (
        <div className="space-y-6 p-5">
          {created ? (
            <div className="rounded-lg border border-ok/30 bg-ok-soft p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ok">
                <CheckCircle className="size-5" weight="fill" />
                {t("Link ready — send it to the buyer", "লিংক তৈরি — কাস্টমারকে পাঠান")}
              </p>
              <p className="mt-2 break-all rounded-sm bg-surface px-3 py-2 text-[13px] text-ink-2">{url(created)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" icon={<WhatsappLogo className="size-4" weight="fill" />} onClick={() => window.open(`https://wa.me/88${phone}?text=${encodeURIComponent(message(created, Number(amount)))}`, "_blank", "noopener")}>
                  WhatsApp
                </Button>
                <Button size="sm" icon={<ChatCircleText className="size-4" />} onClick={() => window.open(`sms:${phone}?body=${encodeURIComponent(message(created, Number(amount)))}`)}>
                  SMS
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Copy className="size-4" />}
                  onClick={() => {
                    void navigator.clipboard?.writeText(message(created, Number(amount)));
                    toast({ title: t("Message copied", "মেসেজ কপি হয়েছে") });
                  }}
                >
                  {t("Copy message", "মেসেজ কপি")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <p className="mb-2 text-[13px] font-medium text-ink-2">{t("What for", "কিসের জন্য")}</p>
                <Segmented<"advance" | "due">
                  className="w-full"
                  value={purpose}
                  onChange={(v) => {
                    setPurpose(v);
                    setAmount(String(v === "advance" ? advance : remaining));
                  }}
                  options={[
                    { value: "advance", label: t(`Advance (delivery ${f.money(advance)})`, `অগ্রিম (ডেলিভারি ${f.money(advance)})`) },
                    { value: "due", label: t(`Full amount ${f.money(remaining)}`, `পুরো টাকা ${f.money(remaining)}`) },
                  ]}
                />
              </div>
              <div>
                <label htmlFor="pl-amount" className="mb-2 block text-[13px] font-medium text-ink-2">
                  {t("Amount", "পরিমাণ")}
                </label>
                <Input id="pl-amount" inputMode="decimal" inputSize="lg" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} leading={<span>৳</span>} />
              </div>
              <div>
                <p className="mb-2 text-[13px] font-medium text-ink-2">{t("Pay with", "যেভাবে দেবেন")}</p>
                {wallets.length ? (
                  <div role="radiogroup" className="grid grid-cols-3 gap-2">
                    {wallets.map((w) => (
                      <button key={w} type="button" role="radio" aria-checked={wallet === w} onClick={() => setWallet(w)} className={cn("flex h-14 flex-col items-center justify-center gap-1 rounded-md border text-[13px] font-semibold", wallet === w ? "border-brand shadow-[var(--ring)]" : "border-line")}>
                        <span className="size-2.5 rounded-full" style={{ background: WALLET[w].color }} />
                        {WALLET[w].name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-ink-3">
                    {t("Connect your bKash or Nagad merchant account in Settings → Couriers & payments.", "সেটিংস → কুরিয়ার ও পেমেন্টে বিকাশ বা নগদ যুক্ত করুন।")}
                  </p>
                )}
              </div>
              <Button variant="primary" size="lg" className="w-full" loading={busy} disabled={!wallet || !(Number(amount) > 0) || Number(amount) > remaining} onClick={create} icon={<LinkSimple className="size-4" />}>
                {t(`Create link for ${f.money(Number(amount) || 0)}`, `${f.money(Number(amount) || 0)}-এর লিংক তৈরি`)}
              </Button>
            </>
          )}

          {links.length > 0 && (
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-2">{t("Links for this order", "এই অর্ডারের লিংক")}</p>
              <ul className="divide-y divide-line rounded-md border border-line">
                {links.map((l) => {
                  const expired = l.status === "open" && new Date(l.expiresAt).getTime() < nowMs;
                  return (
                    <li key={l.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                      <span className="size-2 rounded-full" style={{ background: WALLET[l.provider as Wallet]?.color }} />
                      <span className="tnum font-semibold text-ink">{f.money(l.amount)}</span>
                      <span className="flex-1 truncate text-ink-3">{f.relative(l.createdAt, nowMs)}</span>
                      <Badge tone={l.status === "paid" ? "ok" : expired || l.status === "cancelled" ? "neutral" : "cash"}>
                        {l.status === "paid" ? t("Paid", "পরিশোধিত") : expired ? t("Expired", "মেয়াদ শেষ") : l.status === "cancelled" ? t("Cancelled", "বাতিল") : t("Waiting", "অপেক্ষায়")}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

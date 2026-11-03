"use client";

import { Copy, FacebookLogo, MapPin, PencilSimple, Phone, Plus, ShieldWarning, WhatsappLogo } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChannelTag, RiskLabel, RiskRing, StatusPill } from "../bits";
import { Avatar, Badge, Button, cn, IconButton, Switch, Textarea } from "../ui/core";
import { Sheet, useToast } from "../ui/overlays";
import { buildRows } from "./data";
import { MergeCustomersButton } from "./merge-dialog";
import { formatPhone, orderTotals } from "@/lib/domain";
import { districtBn } from "@/lib/geo";
import { useFmt, useNow, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import type { Customer } from "@/lib/types";

export function CustomerSheet({ customerId, onClose, onEdit }: { customerId: string | null; onClose: () => void; onEdit: (c: Customer) => void }) {
  const t = useT();
  const f = useFmt();
  const customer = useStore((s) => (customerId ? s.customers.find((c) => c.id === customerId) : undefined));
  return (
    <Sheet
      open={!!customer}
      onClose={onClose}
      width={540}
      title={customer?.name ?? ""}
      sub={customer ? t(`Customer since ${f.dateShort(customer.createdAt)}`, `${f.dateShort(customer.createdAt)} থেকে কাস্টমার`) : null}
      headerExtra={
        customer ? (
          <>
            <MergeCustomersButton customer={customer} />
            <IconButton label={t("Edit customer", "কাস্টমার এডিট")} size="sm" onClick={() => onEdit(customer)}>
              <PencilSimple className="size-4" />
            </IconButton>
          </>
        ) : null
      }
    >
      {customer && <Body key={customer.id} customer={customer} />}
    </Sheet>
  );
}

function Body({ customer: c }: { customer: Customer }) {
  const t = useT();
  const f = useFmt();
  const now = useNow();
  const toast = useToast();
  const orders = useStore((s) => s.orders);
  const setRisk = useStore((s) => s.setCustomerRisk);
  const row = useMemo(() => buildRows([c], orders)[0], [c, orders]);
  const history = useMemo(() => orders.filter((o) => o.customerId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [orders, c.id]);
  const [note, setNote] = useState(c.notes ?? "");
  const { stats, risk } = row;
  const wa = `https://wa.me/88${c.phone}`;

  return (
    <div className="pb-6">
      {/* contact */}
      <div className="flex items-center gap-4 px-5 pt-5">
        <Avatar name={c.name} size={56} />
        <div className="min-w-0 flex-1">
          <p className="tnum text-[17px] font-semibold text-ink">{f.digits(formatPhone(c.phone))}</p>
          {c.altPhone && <p className="tnum text-[13px] text-ink-3">{f.digits(formatPhone(c.altPhone))}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <RiskLabel level={risk} />
            <ChannelTag channel={c.channel} className="text-xs" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 px-5 pt-4">
        <a href={`tel:${c.phone}`} className="flex h-16 flex-col items-center justify-center gap-1 rounded-md bg-surface-2 text-xs font-medium text-ink-2 hover:bg-sunken">
          <Phone className="size-5 text-brand-ink" weight="fill" />
          {t("Call", "কল")}
        </a>
        <a href={wa} target="_blank" rel="noreferrer" className="flex h-16 flex-col items-center justify-center gap-1 rounded-md bg-surface-2 text-xs font-medium text-ink-2 hover:bg-sunken">
          <WhatsappLogo className="size-5 text-[#1FA855]" weight="fill" />
          WhatsApp
        </a>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(c.phone);
            toast({ title: t("Phone number copied", "ফোন নম্বর কপি হয়েছে") });
          }}
          className="flex h-16 flex-col items-center justify-center gap-1 rounded-md bg-surface-2 text-xs font-medium text-ink-2 hover:bg-sunken"
        >
          <Copy className="size-5 text-ink-3" />
          {t("Copy", "কপি")}
        </button>
        <Link href={`/pos?customer=${c.id}`} className="flex h-16 flex-col items-center justify-center gap-1 rounded-md bg-brand text-xs font-medium text-brand-contrast hover:brightness-[1.07]">
          <Plus className="size-5" weight="bold" />
          {t("New order", "নতুন অর্ডার")}
        </Link>
      </div>

      {/* stats — one strip, not cards */}
      <div className="mx-5 mt-4 flex items-center gap-4 rounded-lg border border-line px-4 py-3.5">
        <RiskRing level={risk} delivered={stats.delivered} returned={stats.returned} size={52} />
        <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <Stat label={t("Orders", "অর্ডার")} value={f.num(stats.orders)} />
          <Stat label={t("Spent", "কেনাকাটা")} value={f.money(stats.spent)} />
          <Stat
            label={t("Returned", "ফেরত")}
            value={
              <>
                {f.num(stats.returned)}
                {stats.returned > 0 && <span className="ml-1 text-[13px] font-medium opacity-80">{f.pct(stats.returnRate)}</span>}
              </>
            }
            tone={stats.returnRate >= 0.2 ? "text-st-returned" : undefined}
          />
          <Stat label={t("Owes", "বাকি")} value={f.money(stats.due)} tone={stats.due > 0 ? "text-cash-ink" : "text-ink-4"} />
        </dl>
      </div>

      {/* address & tags */}
      <section className="border-b border-line px-5 py-4">
        <div className="flex gap-3 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0 text-ink-3" />
          <p className="text-ink-2">
            {[c.address.line, c.address.area, t.lang === "bn" ? districtBn(c.address.district) : c.address.district].filter(Boolean).join(", ") || t("No address saved", "ঠিকানা নেই")}
          </p>
        </div>
        {c.fbLink && (
          <a href={c.fbLink.startsWith("http") ? c.fbLink : `https://${c.fbLink}`} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-3 text-sm text-ink-2 hover:text-ink">
            <FacebookLogo className="size-4 text-[#1877F2]" weight="fill" />
            {c.fbLink}
          </a>
        )}
        {c.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.tags.map((tag) => (
              <Badge key={tag} tone="brand">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* risk */}
      <section className={cn("border-b border-line px-5 py-4", c.risky && "bg-danger-soft/50")}>
        <div className="flex items-start gap-3">
          <ShieldWarning className={cn("mt-0.5 size-5 shrink-0", c.risky ? "text-danger" : "text-ink-4")} weight={c.risky ? "fill" : "regular"} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{t("Flag as risky", "ঝুঁকিপূর্ণ হিসেবে চিহ্নিত করুন")}</p>
            <p className="text-[13px] text-ink-3">{t("New orders for this number show a warning, so your team asks for an advance.", "এই নম্বরে নতুন অর্ডারে সতর্কবার্তা দেখাবে, যাতে টিম অগ্রিম চায়।")}</p>
          </div>
          <Switch
            checked={c.risky}
            label={t("Flag as risky", "ঝুঁকিপূর্ণ")}
            onChange={(v) => {
              setRisk(c.id, v);
              toast({ title: v ? t(`${c.name} flagged`, `${c.name} চিহ্নিত হয়েছে`) : t("Flag removed", "চিহ্ন সরানো হয়েছে"), tone: v ? "warn" : "ok" });
            }}
          />
        </div>
        <div className="mt-3 pl-8">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Why? e.g. refused 2 parcels in October", "কেন? যেমন অক্টোবরে ২টি পার্সেল নেননি")} className="min-h-16" />
          {note !== (c.notes ?? "") && (
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                variant="soft"
                onClick={() => {
                  setRisk(c.id, c.risky, note.trim() || undefined);
                  toast({ title: t("Note saved", "নোট সেভ হয়েছে") });
                }}
              >
                {t("Save note", "নোট সেভ করুন")}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* history */}
      <section className="px-5 py-4">
        <h3 className="mb-2 text-[13px] font-semibold text-ink-2">
          {t("Orders", "অর্ডার")} <span className="tnum font-normal text-ink-4">{f.num(history.length)}</span>
        </h3>
        {history.length === 0 ? (
          <p className="rounded-md bg-surface-2 px-4 py-6 text-center text-sm text-ink-3">{t("No orders yet. Their first one will show up here.", "এখনো কোনো অর্ডার নেই। প্রথম অর্ডার এখানে দেখাবে।")}</p>
        ) : (
          <ul className="-mx-2">
            {history.map((o) => (
              <li key={o.id}>
                <Link href={`/orders?id=${o.id}`} className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-surface-2">
                  <span className="tnum w-14 text-[13px] font-semibold text-ink">#{f.digits(String(o.no))}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-3">
                    {f.relative(o.createdAt, now)} · {o.lines.map((l) => l.name).join(", ")}
                  </span>
                  <StatusPill status={o.status} size="sm" />
                  <span className="tnum w-20 text-right text-[13px] font-medium text-ink">{f.money(orderTotals(o).total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={cn("figure truncate text-[17px] font-semibold text-ink", tone)}>{value}</dd>
    </div>
  );
}

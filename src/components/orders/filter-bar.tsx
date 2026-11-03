"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { Input, Segmented, Select } from "../ui/core";
import { DEFAULT_FILTERS, type DateRange, type OrderFilters, type PayFilter } from "./util";
import { CHANNELS } from "@/lib/domain";
import { useT } from "@/lib/hooks";
import { CHANNEL_LABEL, STATUS_LABEL } from "@/lib/labels";
import type { Channel, OrderStatus } from "@/lib/types";

const STATUS_OPTIONS: OrderStatus[] = ["draft", "confirmed", "packed", "shipped", "delivered", "returned", "cancelled"];

export function FilterBar({ value, onChange, staff }: { value: OrderFilters; onChange: (f: OrderFilters) => void; staff: string[] }) {
  const t = useT();
  const set = <K extends keyof OrderFilters>(k: K, v: OrderFilters[K]) => onChange({ ...value, [k]: v });
  const dirty = (Object.keys(DEFAULT_FILTERS) as (keyof OrderFilters)[]).some((k) => value[k] !== DEFAULT_FILTERS[k]);

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <Input
        value={value.q}
        onChange={(e) => set("q", e.target.value)}
        placeholder={t("Order #, phone or name", "অর্ডার নং, ফোন বা নাম")}
        leading={<MagnifyingGlass className="size-4" />}
        trailing={
          value.q ? (
            <button type="button" onClick={() => set("q", "")} aria-label={t("Clear search", "খোঁজা মুছুন")} className="grid size-7 place-items-center rounded-full hover:bg-sunken">
              <X className="size-3.5" />
            </button>
          ) : undefined
        }
        className="lg:w-[260px] lg:shrink-0"
        aria-label={t("Search orders", "অর্ডার খুঁজুন")}
      />
      <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-1 lg:overflow-visible lg:px-0">
        <Segmented<DateRange>
          ariaLabel={t("Date range", "সময়")}
          value={value.range}
          onChange={(v) => set("range", v)}
          className="shrink-0"
          options={[
            { value: "today", label: t("Today", "আজ") },
            { value: "7d", label: t("7 days", "৭ দিন") },
            { value: "30d", label: t("30 days", "৩০ দিন") },
            { value: "all", label: t("All", "সব") },
          ]}
        />
        <Select aria-label={t("Status", "অবস্থা")} value={value.status} onChange={(e) => set("status", e.target.value as OrderFilters["status"])} className="w-[150px] shrink-0">
          <option value="all">{t("Any status", "সব অবস্থা")}</option>
          <option value="open">{t("To pack & ship", "প্যাক ও পাঠাতে হবে")}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {t.pick(STATUS_LABEL[s])}
            </option>
          ))}
        </Select>
        <Select aria-label={t("Channel", "চ্যানেল")} value={value.channel} onChange={(e) => set("channel", e.target.value as Channel | "all")} className="w-[140px] shrink-0">
          <option value="all">{t("All channels", "সব চ্যানেল")}</option>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {t.pick(CHANNEL_LABEL[c])}
            </option>
          ))}
        </Select>
        <Select aria-label={t("Payment", "পেমেন্ট")} value={value.pay} onChange={(e) => set("pay", e.target.value as PayFilter)} className="w-[150px] shrink-0">
          <option value="all">{t("Any payment", "সব পেমেন্ট")}</option>
          <option value="cod_pending">{t("COD not collected", "COD বাকি")}</option>
          <option value="due">{t("Customer owes", "কাস্টমারের বাকি")}</option>
          <option value="paid">{t("Fully paid", "পুরো পরিশোধিত")}</option>
        </Select>
        <Select aria-label={t("Taken by", "নিয়েছেন")} value={value.staff} onChange={(e) => set("staff", e.target.value)} className="w-[150px] shrink-0">
          <option value="all">{t("Anyone", "যে কেউ")}</option>
          {staff.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        {dirty && (
          <button type="button" onClick={() => onChange(DEFAULT_FILTERS)} className="h-10 shrink-0 rounded-md px-3 text-[13px] font-medium text-brand-ink hover:bg-brand-50">
            {t("Clear filters", "ফিল্টার মুছুন")}
          </button>
        )}
      </div>
    </div>
  );
}

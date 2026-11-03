"use client";

import { GitMerge, MagnifyingGlass } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Checkbox, Input } from "../ui/core";
import { Sheet, useToast } from "../ui/overlays";
import { formatPhone } from "@/lib/domain";
import { useCan, useFmt, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import type { Customer } from "@/lib/types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ঀ-৿]/g, "");

/** Merge duplicates into this customer (FR-CUS-05): orders move over, tags and notes combine. */
export function MergeCustomersButton({ customer }: { customer: Customer }) {
  const t = useT();
  const can = useCan();
  const [open, setOpen] = useState(false);
  if (!can("delete_order")) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="grid size-8 place-items-center rounded-sm text-ink-2 hover:bg-sunken hover:text-ink" aria-label={t("Merge duplicates", "ডুপ্লিকেট একত্র")} title={t("Merge duplicates", "ডুপ্লিকেট একত্র")}>
        <GitMerge className="size-4" />
      </button>
      {open && <MergeSheet keep={customer} onClose={() => setOpen(false)} />}
    </>
  );
}

function MergeSheet({ keep, onClose }: { keep: Customer; onClose: () => void }) {
  const t = useT();
  const f = useFmt();
  const toast = useToast();
  const customers = useStore((s) => s.customers);
  const orders = useStore((s) => s.orders);
  const merge = useStore((s) => s.mergeCustomers);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const orderCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) if (o.customerId) m.set(o.customerId, (m.get(o.customerId) ?? 0) + 1);
    return m;
  }, [orders]);

  // Likely duplicates: same name, same address line, or phones that differ by a digit or two.
  const suggestions = useMemo(() => {
    const name = norm(keep.name);
    const line = norm(keep.address.line);
    return customers.filter((c) => {
      if (c.id === keep.id) return false;
      const samePhoneTail = c.phone.slice(-6) === keep.phone.slice(-6);
      return norm(c.name) === name || (line.length > 4 && norm(c.address.line) === line) || samePhoneTail;
    });
  }, [customers, keep]);

  const results = q.trim()
    ? customers.filter((c) => c.id !== keep.id && `${c.name} ${c.phone}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 12)
    : suggestions;

  return (
    <Sheet
      open
      onClose={onClose}
      title={t(`Merge into ${keep.name}`, `${keep.name}-এ একত্র করুন`)}
      sub={t("Their orders move here. Tags and notes are combined; their phone is kept as a second number.", "তাদের অর্ডার এখানে আসবে। ট্যাগ ও নোট একসাথে হবে; তাদের ফোন দ্বিতীয় নম্বর হিসেবে থাকবে।")}
      width={520}
      footer={
        <Button
          variant="primary"
          className="ml-auto"
          disabled={!picked.length}
          icon={<GitMerge className="size-4" />}
          onClick={() => {
            merge(keep.id, picked);
            toast({ title: t(`Merged ${picked.length} into ${keep.name}`, `${f.num(picked.length)} জন ${keep.name}-এ একত্র হয়েছে`) });
            onClose();
          }}
        >
          {picked.length ? t(`Merge ${picked.length}`, `${f.num(picked.length)} জন একত্র করুন`) : t("Merge", "একত্র করুন")}
        </Button>
      }
    >
      <div className="p-5">
        <Input leading={<MagnifyingGlass className="size-4" />} placeholder={t("Search by name or phone", "নাম বা ফোন দিয়ে খুঁজুন")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("Search customers", "কাস্টমার খুঁজুন")} />
        <p className="mb-2 mt-4 text-xs font-medium text-ink-3">{q.trim() ? t("Results", "ফলাফল") : t("Possible duplicates", "সম্ভাব্য ডুপ্লিকেট")}</p>
        {results.length ? (
          <ul className="divide-y divide-line rounded-md border border-line">
            {results.map((c) => {
              const on = picked.includes(c.id);
              return (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface-2">
                    <Checkbox checked={on} onChange={(v) => setPicked(v ? [...picked, c.id] : picked.filter((x) => x !== c.id))} label={c.name} />
                    <Avatar name={c.name} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{c.name}</span>
                      <span className="tnum block truncate text-xs text-ink-3">
                        {formatPhone(c.phone)} · {c.address.area || c.address.district}
                      </span>
                    </span>
                    <Badge>{t(`${orderCount.get(c.id) ?? 0} orders`, `${f.num(orderCount.get(c.id) ?? 0)} অর্ডার`)}</Badge>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-md bg-surface-2 px-3 py-4 text-center text-[13px] text-ink-3">{q.trim() ? t("No one matches.", "কেউ মেলেনি।") : t("No obvious duplicates. Search to pick someone.", "স্পষ্ট ডুপ্লিকেট নেই। খুঁজে বাছুন।")}</p>
        )}
      </div>
    </Sheet>
  );
}

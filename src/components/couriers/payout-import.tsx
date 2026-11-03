"use client";

import { CheckCircle, FileCsv, Sparkle, UploadSimple, WarningCircle, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Badge, Button, Checkbox, cn, Input, Panel, Segmented, Select, type Tone } from "../ui/core";
import { useToast } from "../ui/overlays";
import { api } from "./client";
import { detect, FIELDS, matchRows, parseCsv, summarize, type Field, type Layout, type MatchKind, type MatchRow } from "./payout-match";
import { orderTotals } from "@/lib/domain";
import { useCan, useFmt, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";

const KIND: Record<MatchKind, { en: string; bn: string; tone: Tone }> = {
  matched: { en: "Matched", bn: "মিলেছে", tone: "ok" },
  short: { en: "Short-paid", bn: "কম পরিশোধ", tone: "warn" },
  already: { en: "Already received", bn: "আগেই পাওয়া", tone: "neutral" },
  not_delivered: { en: "Not delivered here", bn: "এখানে ডেলিভারি হয়নি", tone: "warn" },
  unmatched: { en: "No matching order", bn: "অর্ডার মেলেনি", tone: "danger" },
};

const LAYOUT_NAME: Record<Layout, string> = { steadfast: "Steadfast", pathao: "Pathao", redx: "RedX", generic: "" };

/** Import a courier's COD payout statement and mark the matching orders as paid (FR-PAY-06). */
export function PayoutImport() {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const toast = useToast();
  const orders = useStore((s) => s.orders);
  const mode = useStore((s) => s.sync.mode);
  const markCodReceived = useStore((s) => s.markCodReceived);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; header: string[]; rows: string[][]; layout: Layout } | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<Field, number>>>({});
  const [filter, setFilter] = useState<"all" | "matched" | "problems">("all");
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [ref, setRef] = useState("");
  const [drag, setDrag] = useState(false);
  const [done, setDone] = useState<{ count: number; amount: number } | null>(null);

  const load = (name: string, text: string) => {
    const all = parseCsv(text);
    if (all.length < 2) {
      toast({ tone: "warn", title: t("That file has no rows", "ফাইলে কোনো সারি নেই"), body: t("Export the payout statement as CSV from your courier panel.", "কুরিয়ার প্যানেল থেকে পেমেন্ট স্টেটমেন্ট CSV হিসেবে নামান।") });
      return;
    }
    const d = detect(all[0]);
    setFile({ name, header: all[0], rows: all.slice(1), layout: d.layout });
    setMapping(d.mapping);
    setRef(name.replace(/\.[^.]+$/, "").slice(0, 40));
    setExcluded(new Set());
    setIncluded(new Set());
    setDone(null);
  };

  const onFile = async (fl?: File | null) => {
    if (!fl) return;
    if (fl.size > 5 * 1024 * 1024) return toast({ tone: "warn", title: t("File is larger than 5 MB", "ফাইল ৫ MB এর বেশি") });
    load(fl.name, await fl.text());
  };

  /** Builds a believable Steadfast statement from your own unpaid COD — handy for a first try. */
  const sample = () => {
    const pending = orders.filter((o) => o.status === "delivered" && o.settlement === "cod" && !o.codReceived && orderTotals(o).cod > 0).slice(0, 8);
    if (!pending.length) return toast({ tone: "info", title: t("No unpaid COD to match right now", "এখন মেলানোর মতো বাকি COD নেই") });
    const lines = [["Consignment ID", "Invoice", "Recipient Phone", "COD Amount", "Delivery Charge", "Payable Amount"]];
    pending.forEach((o, i) => {
      const cod = orderTotals(o).cod;
      const collected = i === 1 ? cod - 50 : cod; // one short-paid parcel
      const fee = o.courier?.fee ?? 60;
      lines.push([o.courier?.consignmentId ?? "", o.invoiceNo ?? "", o.customer?.phone ?? "", String(collected), String(fee), String(collected - fee)]);
    });
    lines.push(["99999999", "INV-UNKNOWN", "01700000000", "640", "60", "580"]);
    load(`steadfast-payout-${new Date().toISOString().slice(0, 10)}.csv`, lines.map((l) => l.map((c) => `"${c}"`).join(",")).join("\n"));
  };

  const matched: MatchRow[] = useMemo(() => (file ? matchRows(file.rows, mapping, orders) : []), [file, mapping, orders]);
  const sum = summarize(matched);
  const isSelected = (r: MatchRow) => !!r.order && (r.kind === "matched" ? !excluded.has(r.index) : r.kind === "short" ? included.has(r.index) : false);
  const selected = matched.filter(isSelected);
  const shown = matched.filter((r) => (filter === "all" ? true : filter === "matched" ? r.kind === "matched" : r.kind !== "matched"));
  const toggle = (r: MatchRow) => {
    if (r.kind === "matched")
      setExcluded((s) => {
        const n = new Set(s);
        if (n.has(r.index)) n.delete(r.index);
        else n.add(r.index);
        return n;
      });
    else if (r.kind === "short")
      setIncluded((s) => {
        const n = new Set(s);
        if (n.has(r.index)) n.delete(r.index);
        else n.add(r.index);
        return n;
      });
  };

  const confirm = async () => {
    const ids = selected.map((r) => r.order!.id);
    if (!ids.length) return;
    markCodReceived(ids, ref.trim() || undefined);
    const amount = selected.reduce((s, r) => s + r.collected, 0);
    setDone({ count: ids.length, amount });
    toast({ title: t(`${ids.length} orders marked as paid out`, `${f.num(ids.length)}টি অর্ডারের টাকা পাওয়া গেছে`), body: f.money(amount) });
    if (mode === "account") void api("/api/couriers/payouts", { method: "POST", json: { provider: file?.layout ?? "generic", fileName: file?.name ?? "", summary: { ...sum, marked: ids.length, amount, ref } } }).catch(() => {});
  };

  if (!can("deliver_return"))
    return (
      <Panel className="p-8 text-center">
        <p className="text-sm font-medium text-ink">{t("Payout matching is for owners, managers and accountants", "পেমেন্ট মেলানো মালিক, ম্যানেজার ও হিসাবরক্ষকের কাজ")}</p>
      </Panel>
    );

  if (!file)
    return (
      <Panel className="p-6 md:p-8">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center">
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">{t("Match a courier payout in one go", "এক বারে কুরিয়ারের পেমেন্ট মেলান")}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-3">
              {t(
                "Upload the CSV statement from Steadfast, Pathao or RedX. Each row is matched to an order by consignment ID, tracking code, invoice or phone and amount — then you confirm which orders were paid.",
                "স্টেডফাস্ট, পাঠাও বা রেডএক্সের CSV স্টেটমেন্ট দিন। প্রতিটি সারি কনসাইনমেন্ট আইডি, ট্র্যাকিং, ইনভয়েস বা ফোন ও টাকা দিয়ে অর্ডারের সাথে মেলানো হবে — তারপর আপনি নিশ্চিত করবেন।",
              )}
            </p>
            <ul className="mt-4 space-y-1.5 text-[13px] text-ink-2">
              {[t("Short payments are flagged, never hidden", "কম পরিশোধ আলাদা করে দেখানো হয়"), t("Nothing changes until you confirm", "নিশ্চিত না করা পর্যন্ত কিছু বদলায় না"), t("Works offline — the file stays on this device", "অফলাইনেও চলে — ফাইল এই ডিভাইসেই থাকে")].map((x) => (
                <li key={x} className="flex items-center gap-2">
                  <CheckCircle className="size-4 shrink-0 text-ok" weight="fill" />
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              void onFile(e.dataTransfer.files?.[0]);
            }}
            className={cn("flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors", drag ? "border-brand bg-brand-50" : "border-line-strong bg-surface-2")}
          >
            <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-ink">
              <FileCsv className="size-6" weight="duotone" />
            </span>
            <p className="text-sm font-medium text-ink">{t("Drop the payout CSV here", "পেমেন্ট CSV এখানে ফেলুন")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" icon={<UploadSimple className="size-4" />} onClick={() => fileRef.current?.click()}>
                {t("Choose file", "ফাইল বাছুন")}
              </Button>
              <Button variant="ghost" icon={<Sparkle className="size-4" />} onClick={sample}>
                {t("Try a sample statement", "নমুনা স্টেটমেন্ট দেখুন")}
              </Button>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
          </div>
        </div>
      </Panel>
    );

  return (
    <div className="space-y-4">
      <Panel className="p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-brand-50 text-brand-ink">
            <FileCsv className="size-5" weight="duotone" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
            <p className="text-xs text-ink-3">
              {t(`${file.rows.length} rows`, `${f.num(file.rows.length)}টি সারি`)}
              {file.layout !== "generic" && <> · {t(`${LAYOUT_NAME[file.layout]} layout detected`, `${LAYOUT_NAME[file.layout]} ফরম্যাট শনাক্ত`)}</>}
            </p>
          </div>
          <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={() => setFile(null)}>
            {t("Different file", "অন্য ফাইল")}
          </Button>
        </div>
        <details className="group mt-4 rounded-md border border-line bg-surface-2" open={mapping.collected === undefined}>
          <summary className="cursor-pointer select-none px-3 py-2.5 text-[13px] font-medium text-ink-2">{t("Which column is which", "কোন কলাম কোনটি")}</summary>
          <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-2 lg:grid-cols-4">
            {FIELDS.map((fd) => (
              <label key={fd.key} className="text-xs text-ink-3">
                <span className="mb-1 block font-medium">
                  {t(fd.en, fd.bn)}
                  {fd.required && <span className="text-danger"> *</span>}
                </span>
                <Select inputSize="sm" value={mapping[fd.key] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [fd.key]: e.target.value === "" ? undefined : Number(e.target.value) }))}>
                  <option value="">{t("— not in file —", "— ফাইলে নেই —")}</option>
                  {file.header.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `${t("Column", "কলাম")} ${i + 1}`}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          </div>
        </details>
      </Panel>

      {/* outcome strip: one row, proportional, so problems are visible at a glance */}
      <Panel className="p-4 md:p-5">
        <div className="flex h-2 overflow-hidden rounded-full bg-sunken" aria-hidden>
          {(["matched", "short", "already", "not_delivered", "unmatched"] as MatchKind[]).map((k) => {
            const n = matched.filter((r) => r.kind === k).length;
            const color = { matched: "var(--color-ok)", short: "var(--cash)", already: "var(--line-strong)", not_delivered: "var(--color-warn)", unmatched: "var(--color-danger)" }[k];
            return n ? <span key={k} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(n / matched.length) * 100}%`, background: color, marginRight: 2 }} /> : null;
          })}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
          {[
            [t("Matched", "মিলেছে"), sum.matched, "text-ok"],
            [t("Short-paid", "কম পরিশোধ"), sum.short, "text-cash-ink"],
            [t("Already received", "আগেই পাওয়া"), sum.already, "text-ink-2"],
            [t("Not delivered", "ডেলিভারি হয়নি"), sum.notDelivered, "text-warn"],
            [t("No order", "অর্ডার নেই"), sum.unmatched, "text-danger"],
          ].map(([label, n, tone]) => (
            <div key={String(label)}>
              <dt className="text-xs text-ink-3">{label}</dt>
              <dd className={cn("figure text-2xl font-semibold", tone as string)}>{f.num(Number(n))}</dd>
            </div>
          ))}
        </dl>
        {sum.short > 0 && (
          <p className="mt-3 flex items-start gap-2 rounded-md bg-cash-soft px-3 py-2 text-[13px] text-cash-ink">
            <WarningCircle className="mt-0.5 size-4 shrink-0" weight="fill" />
            {t(`The courier paid ${f.money(sum.shortBy)} less than these orders' COD. Check with them before marking them received.`, `এই অর্ডারগুলোর COD-এর চেয়ে কুরিয়ার ${f.money(sum.shortBy)} কম দিয়েছে। নিশ্চিত করার আগে কুরিয়ারের সাথে কথা বলুন।`)}
          </p>
        )}
      </Panel>

      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <Segmented<"all" | "matched" | "problems">
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: t("All", "সব") },
              { value: "matched", label: t("Matched", "মিলেছে") },
              { value: "problems", label: t("Needs a look", "দেখতে হবে") },
            ]}
          />
          <p className="tnum hidden text-[13px] text-ink-3 sm:block">{t(`Collected ${f.money(sum.collected)} · fees ${f.money(sum.fees)}`, `আদায় ${f.money(sum.collected)} · চার্জ ${f.money(sum.fees)}`)}</p>
        </div>
        <ul className="divide-y divide-line">
          {shown.map((r) => {
            const k = KIND[r.kind];
            const diff = r.collected - r.expected;
            const selectable = r.kind === "matched" || r.kind === "short";
            return (
              <li key={r.index} className={cn("flex items-center gap-3 px-4 py-3", !selectable && "opacity-80")}>
                {selectable ? <Checkbox checked={isSelected(r)} onChange={() => toggle(r)} label={t("Include", "অন্তর্ভুক্ত")} /> : <span className="size-[18px]" />}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    {r.order ? (
                      <Link href={`/orders?id=${r.order.id}`} className="tnum font-semibold text-ink hover:underline">
                        #{f.digits(String(r.order.no))}
                      </Link>
                    ) : (
                      <span className="tnum font-medium text-ink-3">{r.raw.slice(0, 3).filter(Boolean).join(" · ") || t(`Row ${r.index + 2}`, `সারি ${r.index + 2}`)}</span>
                    )}
                    {r.order?.customer && <span className="truncate text-ink-3">{r.order.customer.name}</span>}
                    <Badge tone={k.tone}>{t(k.en, k.bn)}</Badge>
                  </p>
                  {r.via && <p className="mt-0.5 text-xs text-ink-4">{t(`Matched by ${r.via === "phone" ? "phone + amount" : r.via}`, `মিলেছে ${r.via === "phone" ? "ফোন ও টাকা" : r.via} দিয়ে`)}</p>}
                </div>
                <div className="tnum text-right text-[13px]">
                  <p className="font-semibold text-ink">{f.money(r.collected)}</p>
                  {r.order && Math.abs(diff) >= 1 && <p className={cn("text-xs", diff < 0 ? "text-cash-ink" : "text-ink-3")}>{f.money(diff, { sign: true })}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 md:bottom-4">
        <Panel className="flex flex-wrap items-center gap-3 p-3 shadow-3">
          {done ? (
            <p className="flex flex-1 items-center gap-2 text-sm font-medium text-ok">
              <CheckCircle className="size-5" weight="fill" />
              {t(`${done.count} orders marked paid out · ${f.money(done.amount)}`, `${f.num(done.count)}টি অর্ডার পরিশোধিত · ${f.money(done.amount)}`)}
            </p>
          ) : (
            <>
              <div className="w-full sm:w-56">
                <Input inputSize="sm" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={t("Payout reference", "পেমেন্ট রেফারেন্স")} aria-label={t("Payout reference", "পেমেন্ট রেফারেন্স")} />
              </div>
              <p className="tnum flex-1 text-[13px] text-ink-3">{t(`${selected.length} selected · ${f.money(selected.reduce((s, r) => s + r.collected, 0))}`, `${f.num(selected.length)}টি বাছাই · ${f.money(selected.reduce((s, r) => s + r.collected, 0))}`)}</p>
              <Button variant="cash" disabled={!selected.length} onClick={confirm}>
                {t(`Mark ${selected.length} as received`, `${f.num(selected.length)}টি পাওয়া হিসেবে চিহ্নিত`)}
              </Button>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

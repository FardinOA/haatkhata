"use client";

import { Check } from "@phosphor-icons/react";
import { ProductThumb } from "@/components/bits";
import { Button, cn } from "@/components/ui/core";
import { Dialog } from "@/components/ui/overlays";
import { available } from "@/lib/domain";
import { useFmt, useT } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import type { Product, Variant } from "@/lib/types";
import { usePos } from "./use-pos";

/**
 * Quick variant picker. Two option types render as a matrix (e.g. colour ×
 * size) so the seller sees every combination's stock at once; tapping a cell
 * adds one and keeps the picker open for multi-size orders.
 */
export function VariantPicker({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const t = useT();
  const f = useFmt();
  const { addVariant, draft } = usePos();
  const allowNegative = useStore((s) => s.pos.allowNegativeStock);
  const p = product;
  const qtyIn = (v: Variant) => draft.lines.find((l) => l.variantId === v.id)?.qty ?? 0;
  const added = p ? p.variants.reduce((s, v) => s + qtyIn(v), 0) : 0;

  const cell = (v: Variant | undefined, label?: string) => {
    if (!v || !v.active) return <span className="grid h-14 w-full min-w-14 place-items-center rounded-md bg-sunken/60 text-xs text-ink-4">—</span>;
    const a = available(v);
    const inCart = qtyIn(v);
    const blocked = !allowNegative && a - inCart <= 0;
    const low = a > 0 && a <= v.lowStock;
    return (
      <button
        type="button"
        disabled={blocked && inCart === 0}
        onClick={() => !blocked && addVariant(v.id)}
        aria-label={`${Object.values(v.options).join(" / ")} — ${a} ${t("available", "আছে")}`}
        className={cn(
          "relative flex h-14 w-full min-w-14 flex-col items-center justify-center rounded-md border text-center transition-all",
          inCart ? "border-brand bg-brand-50" : "border-line bg-surface hover:border-brand hover:bg-brand-50/50",
          blocked && "cursor-not-allowed opacity-50 hover:border-line hover:bg-surface",
        )}
      >
        {label && <span className="text-[13px] font-semibold text-ink">{label}</span>}
        <span className={cn("tnum text-xs", a <= 0 ? "text-danger" : low ? "text-warn" : "text-ink-3")}>{a <= 0 ? t("Out", "নেই") : f.num(a)}</span>
        {inCart > 0 && (
          <span className="tnum absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-semibold text-brand-contrast">{f.num(inCart)}</span>
        )}
      </button>
    );
  };

  let body: React.ReactNode = null;
  if (p) {
    const [o1, o2] = p.optionTypes;
    if (o1 && o2) {
      const find = (a: string, b: string) => p.variants.find((v) => v.options[o1.name] === a && v.options[o2.name] === b);
      body = (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1.5">
            <thead>
              <tr>
                <th className="w-20" />
                {o1.values.map((a) => (
                  <th key={a} className="pb-1 text-center text-xs font-medium text-ink-3">
                    {a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {o2.values.map((b) => (
                <tr key={b}>
                  <th className="pr-1 text-left text-[13px] font-medium text-ink-2">{b}</th>
                  {o1.values.map((a) => (
                    <td key={a}>{cell(find(a, b))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } else if (o1) {
      body = (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {o1.values.map((val) => (
            <div key={val}>{cell(p.variants.find((v) => v.options[o1.name] === val), val)}</div>
          ))}
        </div>
      );
    }
  }

  const prices = p ? [...new Set(p.variants.map((v) => v.price))] : [];

  return (
    <Dialog
      open={!!p}
      onClose={onClose}
      width={520}
      title={
        p && (
          <span className="flex items-center gap-3">
            <ProductThumb product={p} size={44} />
            <span className="min-w-0">
              <span className="block truncate">{t(p.name, p.nameBn ?? p.name)}</span>
              <span className="block text-[13px] font-normal text-ink-3">
                {prices.map((x) => f.money(x)).join(" / ")} · {t("tap a cell to add", "যোগ করতে ঘরে চাপুন")}
              </span>
            </span>
          </span>
        )
      }
      footer={
        <Button variant="primary" onClick={onClose} icon={<Check className="size-4" weight="bold" />} data-autofocus>
          {added ? t(`Done · ${added} in cart`, `হয়েছে · কার্টে ${f.num(added)}টি`) : t("Done", "হয়েছে")}
        </Button>
      }
    >
      <div className="-mx-1.5 mt-3">{body}</div>
    </Dialog>
  );
}

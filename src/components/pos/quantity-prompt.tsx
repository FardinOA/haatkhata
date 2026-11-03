"use client";

import { Barcode } from "@phosphor-icons/react";
import { useCallback, useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/overlays";
import { cn } from "@/components/ui/core";
import { useFmt, useT } from "@/lib/hooks";

type Ask = { title: ReactNode; have: number; max: number };

/**
 * "Scanned again — how many?" One question covers both cases: an accidental
 * double scan (keep the number) and a stack of the same item (type how many).
 * Resolves to the quantity the cart should hold; closing keeps what it has.
 */
export function useQuantityPrompt() {
  const t = useT();
  const f = useFmt();
  const [state, setState] = useState<(Ask & { open: boolean; resolve: (n: number) => void }) | null>(null);
  const [qty, setQty] = useState(1);

  const ask = useCallback(
    (o: Ask) =>
      new Promise<number>((resolve) => {
        setQty(Math.min(o.have + 1, o.max));
        setState({ ...o, open: true, resolve });
      }),
    [],
  );

  const clamp = (n: number) => Math.max(1, Math.min(state?.max ?? Infinity, Number.isFinite(n) ? n : 1));
  const close = (n: number) => {
    if (!state?.open) return;
    state.resolve(n);
    setState({ ...state, open: false });
  };
  const keep = () => close(state?.have ?? 1);
  const set = () => close(clamp(qty));

  const stepBtn = "grid size-11 place-items-center text-xl font-medium text-ink-2 transition-colors hover:bg-sunken disabled:opacity-35";
  const node = (
    <Dialog
      open={!!state?.open}
      onClose={keep}
      title={state?.title}
      tone="brand"
      icon={<Barcode weight="bold" />}
      footer={
        <>
          <button type="button" className="h-10 rounded-md px-4 text-sm font-medium text-ink-2 hover:bg-sunken" onClick={keep}>
            {t(`Keep ${state?.have ?? 1}`, `${f.num(state?.have ?? 1)}টিই রাখুন`)}
          </button>
          <button type="button" className="h-10 rounded-md bg-brand px-4 text-sm font-medium text-brand-contrast" onClick={set}>
            {t("Set quantity", "সংখ্যা ঠিক করুন")}
          </button>
        </>
      }
    >
      <p>
        {t(`${state?.have ?? 1} already in the cart. How many should it have?`, `কার্টে আছে ${f.num(state?.have ?? 1)}টি। মোট কয়টি হবে?`)}
      </p>
      <form
        className="mt-4 flex items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          set();
        }}
      >
        <div className="inline-flex items-stretch overflow-hidden rounded-md border border-line-strong/80 bg-surface">
          <button type="button" aria-label={t("One less", "একটি কম")} className={stepBtn} disabled={qty <= 1} onClick={() => setQty((n) => clamp(n - 1))}>
            −
          </button>
          <input
            data-autofocus
            aria-label={t("Quantity in the cart", "কার্টে সংখ্যা")}
            inputMode="numeric"
            value={qty}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setQty(parseInt(e.target.value.replace(/\D/g, "") || "0", 10))}
            onBlur={() => setQty((n) => clamp(n))}
            className="tnum w-16 border-x border-line bg-transparent text-center font-display text-xl font-semibold text-ink focus:outline-none"
          />
          <button type="button" aria-label={t("One more", "একটি বেশি")} className={stepBtn} disabled={qty >= (state?.max ?? Infinity)} onClick={() => setQty((n) => clamp(n + 1))}>
            +
          </button>
        </div>
        {state && Number.isFinite(state.max) && <span className={cn("text-xs", qty > state.max ? "text-danger" : "text-ink-3")}>{t(`${state.max} in stock`, `স্টকে ${f.num(state.max)}টি`)}</span>}
      </form>
    </Dialog>
  );
  return [ask, node] as const;
}

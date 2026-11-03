"use client";

/**
 * Sheets, dialogs, menus, toasts and confirmations.
 * Motion is plain CSS (see "Overlay motion" in globals.css): elements carry
 * data-state="open|closed" and stay mounted just long enough to animate out.
 */
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";
import { cn, IconButton } from "./core";
import { useMediaQuery } from "@/lib/hooks";

const noop = () => () => {};
function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

function Portal({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  return mounted ? createPortal(children, document.body) : null;
}

/**
 * Keeps something rendered while its exit animation plays.
 * `present` is true while open or closing; call `onExited` from onAnimationEnd.
 */
export function usePresence(open: boolean) {
  const [closing, setClosing] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  // Derive "closing" from the open → closed edge during render (no effect needed).
  if (open !== wasOpen) {
    setWasOpen(open);
    setClosing(!open);
  }
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const onExited = useCallback(() => setClosing(false), []);
  return { present: open || (closing && !reduced), state: open ? ("open" as const) : ("closed" as const), onExited };
}

// Open modals, innermost last — only the top one reacts to Escape/Tab.
const modalStack: object[] = [];

/** Locks body scroll, traps focus and closes on Escape while open. */
function useModal(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const token = {};
    modalStack.push(token);
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== token) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      const target = ref.current?.querySelector<HTMLElement>("[data-autofocus]") ?? ref.current;
      target?.focus({ preventScroll: true });
    }, 30);
    return () => {
      modalStack.splice(modalStack.indexOf(token), 1);
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, onClose, ref]);
}

/* ------------------------------------------------------------------ Sheet */

/** Right-side panel on desktop, bottom sheet on phones. */
export function Sheet({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
  width = 520,
  headerExtra,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  headerExtra?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const desktop = useMediaQuery("(min-width: 768px)");
  const titleId = useId();
  const { present, state, onExited } = usePresence(open);
  useModal(open, onClose, ref);
  if (!present) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-50" data-state={state}>
        <div className="bk-scrim absolute inset-0 bg-[rgb(22_24_26/0.32)] backdrop-blur-[2px]" data-state={state} onClick={onClose} />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          data-state={state}
          onAnimationEnd={(e) => e.target === e.currentTarget && state === "closed" && onExited()}
          className={cn("bk-sheet absolute flex flex-col bg-surface shadow-3 focus:outline-none", desktop ? "inset-y-2 right-2 rounded-xl border border-line" : "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-xl")}
          style={desktop ? { width: `min(${width}px, calc(100vw - 16px))` } : undefined}
        >
          {!desktop && <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong" aria-hidden />}
          <header className="flex items-start gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-display text-lg font-semibold leading-tight tracking-[-0.01em] text-ink">
                {title}
              </h2>
              {sub && <div className="mt-1 text-[13px] text-ink-3">{sub}</div>}
            </div>
            {headerExtra}
            <IconButton label="Close" size="sm" onClick={onClose} className="-mr-1">
              <X className="size-4" weight="bold" />
            </IconButton>
          </header>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer && <footer className="flex items-center gap-2 border-t border-line bg-surface-2/60 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</footer>}
        </div>
      </div>
    </Portal>
  );
}

/* ------------------------------------------------------------------ Dialog */

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 440,
  icon,
  tone = "neutral",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
  icon?: ReactNode;
  tone?: "neutral" | "danger" | "brand" | "cash";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { present, state, onExited } = usePresence(open);
  useModal(open, onClose, ref);
  const toneCls = { neutral: "bg-sunken text-ink-2", danger: "bg-danger-soft text-danger", brand: "bg-brand-50 text-brand-ink", cash: "bg-cash-soft text-cash-ink" }[tone];
  if (!present) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-50 grid place-items-center p-4">
        <div className="bk-scrim absolute inset-0 bg-[rgb(22_24_26/0.36)] backdrop-blur-[2px]" data-state={state} onClick={onClose} />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          data-state={state}
          onAnimationEnd={(e) => e.target === e.currentTarget && state === "closed" && onExited()}
          className="bk-pop relative w-full rounded-xl border border-line bg-surface shadow-3 focus:outline-none"
          style={{ maxWidth: width }}
        >
          <div className="p-5">
            <div className="flex items-start gap-3">
              {icon && <div className={cn("grid size-10 shrink-0 place-items-center rounded-full [&>svg]:size-5", toneCls)}>{icon}</div>}
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 id={titleId} className="font-display text-lg font-semibold leading-snug text-ink">
                  {title}
                </h2>
                {children && <div className="mt-2 text-sm text-ink-2">{children}</div>}
              </div>
            </div>
          </div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}

/* ------------------------------------------------------------------ Menu */

export type MenuItem =
  | { type?: "item"; label: ReactNode; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean; hint?: ReactNode }
  | { type: "divider" }
  | { type: "label"; label: ReactNode };

export function Menu({ trigger, items, align = "end", width = 220 }: { trigger: (p: { open: boolean; toggle: () => void; ref: React.Ref<HTMLButtonElement> }) => ReactNode; items: MenuItem[]; align?: "start" | "end"; width?: number }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  // Next keeps hidden routes mounted; never come back to an open menu.
  useLayoutEffect(() => () => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const left = align === "end" ? Math.max(8, r.right - width) : Math.min(window.innerWidth - width - 8, r.left);
    const below = r.bottom + 6;
    const estH = items.length * 38 + 12;
    const top = below + estH > window.innerHeight ? Math.max(8, r.top - estH - 6) : below;
    setPos({ top, left });
  }, [open, align, width, items.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!list.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const els = [...(list.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [])];
        const i = els.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.key === "ArrowDown" ? els[(i + 1) % els.length] : els[(i - 1 + els.length) % els.length];
        next?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    setTimeout(() => list.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus(), 10);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, close]);

  return (
    <>
      {trigger({ open, toggle: () => setOpen((o) => !o), ref: btn })}
      {open && pos && (
        <Portal>
          <div ref={list} role="menu" data-state="open" className="bk-drop fixed z-[60] rounded-md border border-line bg-surface p-1 shadow-3" style={{ top: pos.top, left: pos.left, width }}>
            {items.map((it, i) =>
              it.type === "divider" ? (
                <div key={i} className="my-1 h-px bg-line" />
              ) : it.type === "label" ? (
                <div key={i} className="px-2.5 pb-1 pt-2 text-xs font-medium text-ink-4">
                  {it.label}
                </div>
              ) : (
                <button
                  key={i}
                  role="menuitem"
                  type="button"
                  disabled={it.disabled}
                  onClick={() => {
                    close();
                    it.onSelect();
                  }}
                  className={cn(
                    "flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-[13.5px] outline-none transition-colors disabled:opacity-40",
                    it.danger ? "text-danger hover:bg-danger-soft focus:bg-danger-soft" : "text-ink hover:bg-sunken focus:bg-sunken",
                  )}
                >
                  {it.icon && <span className="flex text-ink-3 [&>svg]:size-4">{it.icon}</span>}
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.hint && <span className="text-xs text-ink-4">{it.hint}</span>}
                </button>
              ),
            )}
          </div>
        </Portal>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ Toasts */

type Toast = { id: number; title: ReactNode; body?: ReactNode; tone: "ok" | "info" | "warn"; action?: { label: string; onClick: () => void } };
type ToastApi = (t: Omit<Toast, "id" | "tone"> & { tone?: Toast["tone"] }) => void;

const ToastCtx = createContext<ToastApi>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback<ToastApi>((t) => {
    const id = Date.now() + Math.random();
    setToasts((xs) => [...xs.slice(-2), { ...t, id, tone: t.tone ?? "ok" }]);
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), t.action ? 6000 : 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <Portal>
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6 md:left-auto md:right-6 md:items-end" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="bk-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 shadow-3">
              <span className={cn("mt-0.5 flex [&>svg]:size-5", t.tone === "ok" ? "text-ok" : t.tone === "warn" ? "text-warn" : "text-brand-ink")}>
                {t.tone === "ok" ? <CheckCircle weight="fill" /> : t.tone === "warn" ? <WarningCircle weight="fill" /> : <Info weight="fill" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{t.title}</p>
                {t.body && <p className="mt-0.5 text-[13px] text-ink-3">{t.body}</p>}
              </div>
              {t.action && (
                <button
                  type="button"
                  className="-my-0.5 rounded-sm px-2 py-1 text-[13px] font-semibold text-brand-ink hover:bg-brand-50"
                  onClick={() => {
                    t.action!.onClick();
                    setToasts((xs) => xs.filter((x) => x.id !== t.id));
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      </Portal>
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------------ Confirm */

export function useConfirm() {
  // Content stays after closing so the dialog can animate out with its text.
  const [state, setState] = useState<{ open: boolean; title: ReactNode; body?: ReactNode; confirm: string; cancel: string; danger?: boolean; resolve: (v: boolean) => void } | null>(null);
  const ask = useCallback(
    (o: { title: ReactNode; body?: ReactNode; confirm: string; cancel?: string; danger?: boolean }) =>
      new Promise<boolean>((resolve) => setState({ ...o, open: true, cancel: o.cancel ?? "Cancel", resolve })),
    [],
  );
  const close = (v: boolean) => {
    if (!state?.open) return;
    state.resolve(v);
    setState({ ...state, open: false });
  };
  const node = (
    <Dialog
      open={!!state?.open}
      onClose={() => close(false)}
      title={state?.title}
      tone={state?.danger ? "danger" : "brand"}
      icon={state?.danger ? <WarningCircle weight="fill" /> : <Info weight="fill" />}
      footer={
        <>
          <button type="button" className="h-10 rounded-md px-4 text-sm font-medium text-ink-2 hover:bg-sunken" onClick={() => close(false)}>
            {state?.cancel}
          </button>
          <button type="button" data-autofocus className={cn("h-10 rounded-md px-4 text-sm font-medium", state?.danger ? "bg-danger text-white" : "bg-brand text-brand-contrast")} onClick={() => close(true)}>
            {state?.confirm}
          </button>
        </>
      }
    >
      {state?.body}
    </Dialog>
  );
  return [ask, node] as const;
}

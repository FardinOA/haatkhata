"use client";

/**
 * The device store. Business data only changes through commands
 * (src/lib/commands.ts): each action below dispatches one, which applies
 * instantly here and, in account mode, is queued for the server.
 * UI-only preferences (language, dashboard layout, parked carts) stay local.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { uid } from "./base-data";
import { authorize, COMMANDS, CommandError, makeCtx, type CommandPayload, type CommandResult, type CommandType, type NewOrderInput, type StockInInput } from "./commands";
import { orderTotals } from "./domain";
import { DEFAULT_PRINTER, type PrinterPrefs } from "./print";
import { DASH_PRESETS, initialState, STORE_VERSION, WIDGET_SIZES, type AppState, type BusinessProfile, type DashRange, type InvoiceSettings, type PosSettings, type SyncState } from "./state";
import type { ThemeSettings } from "./theme";
import type {
  CartLine,
  Courier,
  Customer,
  Expense,
  Lang,
  MovementReason,
  Notice,
  Numerals,
  Order,
  OrderStatus,
  ParkedCart,
  Payment,
  Product,
  Purchase,
  ReturnRecord,
  Staff,
  Supplier,
  WidgetInstance,
  WidgetSize,
  WidgetType,
  Location,
} from "./types";

export * from "./state";
export type { NewOrderInput };

export interface AppActions {
  /** Low-level: apply a command locally and queue it. Returns undefined if it was refused. */
  dispatch: <T extends CommandType>(type: T, payload: CommandPayload<T>) => CommandResult<T> | undefined;

  seed: () => Promise<void>;
  resetDemo: () => Promise<void>;
  setLang: (l: Lang) => void;
  setNumerals: (n: Numerals) => void;
  setPrinter: (p: Partial<PrinterPrefs>) => void;
  setTheme: (t: Partial<ThemeSettings>) => void;
  setBusiness: (b: Partial<BusinessProfile>) => void;
  setInvoice: (i: Partial<InvoiceSettings>) => void;
  setPos: (p: Partial<PosSettings>) => void;
  setMonthlyGoal: (n: number) => void;
  switchUser: (staffId: string) => void;
  addStaff: (s: Omit<Staff, "id" | "color">) => void;
  updateStaff: (id: string, patch: Partial<Omit<Staff, "id">>) => void;
  removeStaff: (id: string) => void;

  setDashRange: (r: DashRange) => void;
  setLayout: (layout: WidgetInstance[]) => void;
  addWidget: (type: WidgetType) => void;
  removeWidget: (id: string) => void;
  resizeWidget: (id: string, size: WidgetSize) => void;
  applyDashPreset: (key: string) => void;

  saveProduct: (p: Product, opening?: Record<string, number>) => void;
  deleteProduct: (id: string) => void;
  duplicateProduct: (id: string) => string | null;
  addCategory: (name: string, nameBn?: string) => string;

  stockIn: (input: StockInInput) => string;
  adjustStock: (variantId: string, newOnHand: number, reason: Extract<MovementReason, "adjust" | "damage">, note?: string, locationId?: string) => void;
  transferStock: (from: string, to: string, lines: { variantId: string; qty: number }[], note?: string) => string | undefined;
  saveLocation: (location: Partial<Location> & { name: string }) => string | undefined;
  deleteLocation: (id: string) => void;
  savePurchaseOrder: (po: CommandPayload<"po.save">["po"]) => string | undefined;
  setPurchaseOrderStatus: (id: string, status: CommandPayload<"po.status">["status"]) => void;
  receivePurchaseOrder: (id: string, lines: CommandPayload<"po.receive">["lines"], paid: number, locationId?: string) => string | undefined;
  saveQuote: (quote: CommandPayload<"quote.save">["quote"]) => string | undefined;
  setQuoteStatus: (id: string, status: CommandPayload<"quote.status">["status"]) => void;
  convertQuote: (id: string, mode: "draft" | "confirm") => Order | undefined;
  exchangeOrder: (p: CommandPayload<"order.exchange">) => Order | undefined;
  mergeCustomers: (keepId: string, mergeIds: string[]) => void;
  saveRecurring: (template: CommandPayload<"recurring.save">["template"]) => string | undefined;
  deleteRecurring: (id: string) => void;
  addSupplier: (s: Omit<Supplier, "id" | "balance">) => string;
  paySupplier: (supplierId: string, amount: number) => void;

  createOrder: (input: NewOrderInput, mode: "draft" | "confirm" | "complete") => Order;
  updateOrderLines: (orderId: string, lines: CartLine[]) => void;
  transition: (orderId: string, to: OrderStatus, meta?: { courier?: Courier; note?: string }) => boolean;
  recordReturn: (orderId: string, lines: ReturnRecord["lines"], fee: number, refund: number, refundMethod?: Payment["method"]) => void;
  addPayment: (orderId: string, p: Omit<Payment, "id" | "at" | "by">) => void;
  markCodReceived: (orderIds: string[], ref?: string) => void;
  setCourier: (orderId: string, courier: Courier) => void;
  addOrderNote: (orderId: string, note: string) => void;
  logPrint: (orderIds: string[], what: string) => void;
  deleteDraft: (orderId: string) => void;

  upsertCustomer: (c: Partial<Customer> & { name: string; phone: string }) => string;
  setCustomerRisk: (id: string, risky: boolean, note?: string) => void;

  addExpense: (e: Omit<Expense, "id">) => void;
  deleteExpense: (id: string) => void;

  parkCart: (c: Omit<ParkedCart, "id" | "at">) => void;
  unpark: (id: string) => ParkedCart | undefined;

  markNoticesRead: () => void;
  pushNotice: (n: Omit<Notice, "id" | "at" | "read">) => void;

  /** Sync bookkeeping (used by src/lib/sync.ts). */
  setSync: (patch: Partial<SyncState>) => void;
}

export type Store = AppState & AppActions;

/* ------------------------------------------------------------- command errors */

type ErrorListener = (e: CommandError, type: CommandType) => void;
const errorListeners = new Set<ErrorListener>();

/**
 * The plan's monthly order cap, checked on the device before the sale is
 * recorded: the server refuses it too (billing/limits.ts), and a refused
 * command is wiped from the device on the next sync.
 */
function checkOrderCap(type: CommandType, payload: unknown, s: AppState) {
  if (type !== "order.create" && type !== "quote.convert") return;
  if ((payload as { mode?: string }).mode === "draft") return;
  const limit = s.plan.orderLimit;
  if (limit <= 0) throw new CommandError("Your shop has no active plan, so new orders are paused. Pick a plan in Settings → Plan & billing.", "limit");
  const now = new Date();
  const used = s.orders.filter((o) => {
    const d = new Date(o.createdAt);
    return o.status !== "draft" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  if (used >= limit) throw new CommandError(`You've used all ${limit.toLocaleString("en-IN")} orders on your plan this month. Upgrade in Settings → Plan & billing to keep taking orders.`, "limit");
}
/** UI subscribes to show a toast when a command is refused. */
export function onCommandError(fn: ErrorListener) {
  errorListeners.add(fn);
  return () => void errorListeners.delete(fn);
}

/* ------------------------------------------------------------- store */

export const useStore = create<Store>()(
  persist(
    immer((set, get) => {
      function dispatch<T extends CommandType>(type: T, payload: CommandPayload<T>): CommandResult<T> | undefined {
        const state = get();
        const me = currentActor(state);
        const id = uid("");
        const now = new Date().toISOString();
        let result: CommandResult<T> | undefined;
        try {
          if (state.sync.mode === "account") checkOrderCap(type, payload, state);
          authorize(type, payload, me.role, state);
          set((s) => {
            const fn = COMMANDS[type] as (s: AppState, p: CommandPayload<T>, ctx: ReturnType<typeof makeCtx>) => CommandResult<T>;
            result = fn(s, payload, makeCtx(id, now, { id: me.id, name: me.name, role: me.role }));
            if (s.sync.mode === "account") s.outbox.push({ id, type, payload: structuredClone(payload), at: now } as never);
          });
          return result;
        } catch (e) {
          if (e instanceof CommandError) {
            errorListeners.forEach((l) => l(e, type));
            return undefined;
          }
          throw e;
        }
      }

      return {
        ...initialState(),
        dispatch,

        seed: async () => {
          // The demo generator is only needed on first run, so it isn't in the main bundle.
          const { buildSeed } = await import("./seed");
          set((s) => {
            const data = buildSeed(new Date());
            Object.assign(s, data);
            const renew = new Date();
            renew.setDate(renew.getDate() + 19);
            s.plan.renewsAt = renew.toISOString();
            s.seeded = true;
          });
        },

        resetDemo: async () => {
          set(() => initialState());
          await get().seed();
        },

        /* ---------- per-user, device-only preferences */
        setLang: (l) => set((s) => void (s.lang = l)),
        setNumerals: (n) => set((s) => void (s.numerals = n)),
        setPrinter: (p) => set((s) => void Object.assign(s.printer, p)),
        switchUser: (id) => set((s) => void (s.currentUserId = id)),
        setDashRange: (r) => set((s) => void (s.dashboard.range = r)),
        setLayout: (layout) =>
          set((s) => {
            s.dashboard.layout = layout;
            s.dashboard.preset = null;
          }),
        addWidget: (type) =>
          set((s) => {
            if (s.dashboard.layout.some((x) => x.type === type)) return;
            s.dashboard.layout.push({ id: `w_${type}`, type, size: WIDGET_SIZES[type][0] });
            s.dashboard.preset = null;
          }),
        removeWidget: (id) =>
          set((s) => {
            s.dashboard.layout = s.dashboard.layout.filter((x) => x.id !== id);
            s.dashboard.preset = null;
          }),
        resizeWidget: (id, size) =>
          set((s) => {
            const x = s.dashboard.layout.find((y) => y.id === id);
            if (x) x.size = size;
            s.dashboard.preset = null;
          }),
        applyDashPreset: (key) =>
          set((s) => {
            const p = DASH_PRESETS[key];
            if (!p) return;
            s.dashboard.layout = p.layout.map((x) => ({ ...x }));
            s.dashboard.preset = key;
          }),
        parkCart: (c) => set((s) => void s.parked.unshift({ ...c, id: uid("pk_"), at: new Date().toISOString() })),
        unpark: (id) => {
          const c = get().parked.find((x) => x.id === id);
          set((s) => void (s.parked = s.parked.filter((x) => x.id !== id)));
          return c;
        },
        setSync: (patch) => set((s) => void Object.assign(s.sync, patch)),

        /* ---------- business data: commands */
        setTheme: (t) => void dispatch("theme.update", t),
        setBusiness: (b) => void dispatch("business.update", b),
        setInvoice: (i) => void dispatch("invoice.update", i),
        setPos: (p) => void dispatch("pos.update", p),
        setMonthlyGoal: (n) => void dispatch("goal.set", { amount: n }),
        addStaff: (st) => void dispatch("staff.add", st),
        updateStaff: (id, patch) => void dispatch("staff.update", { id, patch }),
        removeStaff: (id) => void dispatch("staff.remove", { id }),

        saveProduct: (product, opening) => void dispatch("product.save", { product, opening }),
        deleteProduct: (id) => void dispatch("product.delete", { id }),
        duplicateProduct: (id) => dispatch("product.duplicate", { id }) ?? null,
        addCategory: (name, nameBn) => dispatch("category.add", { name, nameBn }) ?? "",

        stockIn: (input) => dispatch("stock.in", input) ?? "",
        adjustStock: (variantId, newOnHand, reason, note, locationId) => void dispatch("stock.adjust", { variantId, newOnHand, reason, note, locationId }),
        transferStock: (from, to, lines, note) => dispatch("stock.transfer", { from, to, lines, note }),
        saveLocation: (location) => dispatch("location.save", { location }),
        deleteLocation: (id) => void dispatch("location.delete", { id }),
        savePurchaseOrder: (po) => dispatch("po.save", { po }),
        setPurchaseOrderStatus: (id, status) => void dispatch("po.status", { id, status }),
        receivePurchaseOrder: (id, lines, paid, locationId) => dispatch("po.receive", { id, lines, paid, locationId }),
        saveQuote: (quote) => dispatch("quote.save", { quote }),
        setQuoteStatus: (id, status) => void dispatch("quote.status", { id, status }),
        convertQuote: (id, mode) => dispatch("quote.convert", { id, mode }),
        exchangeOrder: (p) => dispatch("order.exchange", p),
        mergeCustomers: (keepId, mergeIds) => void dispatch("customer.merge", { keepId, mergeIds }),
        saveRecurring: (template) => dispatch("recurring.save", { template }),
        deleteRecurring: (id) => void dispatch("recurring.delete", { id }),
        addSupplier: (sup) => dispatch("supplier.add", sup) ?? "",
        paySupplier: (supplierId, amount) => void dispatch("supplier.pay", { supplierId, amount }),

        createOrder: (input, mode) => dispatch("order.create", { input, mode }) as Order,
        updateOrderLines: (orderId, lines) => void dispatch("order.updateLines", { orderId, lines }),
        transition: (orderId, to, meta) => dispatch("order.transition", { orderId, to, courier: meta?.courier, note: meta?.note }) ?? false,
        recordReturn: (orderId, lines, fee, refund, refundMethod) => void dispatch("order.return", { orderId, lines, fee, refund, refundMethod }),
        addPayment: (orderId, payment) => void dispatch("order.payment", { orderId, payment }),
        markCodReceived: (orderIds, ref) => void dispatch("order.codReceived", { orderIds, ref }),
        setCourier: (orderId, courier) => void dispatch("order.courier", { orderId, courier }),
        addOrderNote: (orderId, note) => void dispatch("order.note", { orderId, note }),
        logPrint: (orderIds, what) => void dispatch("order.print", { orderIds, what }),
        deleteDraft: (orderId) => void dispatch("order.deleteDraft", { orderId }),

        upsertCustomer: (c) => dispatch("customer.upsert", c) ?? "",
        setCustomerRisk: (id, risky, note) => void dispatch("customer.risk", { id, risky, note }),

        addExpense: (e) => void dispatch("expense.add", e),
        deleteExpense: (id) => void dispatch("expense.delete", { id }),

        markNoticesRead: () => void dispatch("notice.readAll", undefined as never),
        pushNotice: (n) => void dispatch("notice.push", n),
      };
    }),
    {
      // Pre-rename key; changing it would orphan every device's saved shop.
      name: "bechakena-pos",
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      migrate: (persisted, version) => {
        const s = persisted as AppState;
        if (version < 2) {
          s.outbox = [];
          s.sync = { mode: "demo", status: "idle", rejected: [] };
        }
        if (version < 3) {
          s.locations ??= [];
          s.purchaseOrders ??= [];
          s.quotes ??= [];
          s.recurring ??= [];
        }
        if (version < 4) s.printer ??= { ...DEFAULT_PRINTER };
        return s;
      },
    },
  ),
);

/* ------------------------------------------------------------- selectors */

// Until the first sync returns the team, act with the least privilege.
const PENDING_ACTOR: Staff = { id: "pending", name: "", phone: "", role: "sales", color: "#7C8288" };

export function currentActor(s: Pick<AppState, "staff" | "currentUserId">): Staff {
  return s.staff.find((x) => x.id === s.currentUserId) ?? s.staff[0] ?? PENDING_ACTOR;
}

export const useMe = () => useStore(currentActor);

export function getVariant(products: Product[], variantId: string) {
  for (const p of products) {
    const v = p.variants.find((x) => x.id === variantId);
    if (v) return { p, v };
  }
  return null;
}

export type { Purchase };
export { orderTotals };

/* ------------------------------------------------------------- recurring expenses */

/** Creates any monthly expenses that have fallen due (FR-EXP-02). Cheap to call; no-op when nothing is due. */
export function runDueRecurring() {
  const s = useStore.getState();
  if (!s.seeded || !s.recurring?.length) return;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const month = today.slice(0, 7);
  const due = s.recurring.some((r) => r.active && (!r.lastRun || r.lastRun < month) && now.getDate() >= r.dayOfMonth);
  if (due) s.dispatch("recurring.run", { today });
}

if (typeof window !== "undefined") {
  let last: unknown;
  useStore.subscribe((s) => {
    if (s.recurring === last) return;
    last = s.recurring;
    setTimeout(runDueRecurring, 0);
  });
}

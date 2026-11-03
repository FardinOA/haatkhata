/**
 * App state shape, defaults and dashboard presets. Shared by the device store
 * (store.ts) and the server, so it must stay free of browser-only code.
 */
import { CATEGORIES, STAFF } from "./base-data";
import type { QueuedCommand } from "./commands";
import { DEFAULT_PRINTER, type PrinterPrefs } from "./print";
import { DEFAULT_THEME, type ThemeSettings } from "./theme";
import type {
  Category,
  Channel,
  Customer,
  Expense,
  Lang,
  Notice,
  Numerals,
  Order,
  ParkedCart,
  Location,
  PurchaseOrder,
  Quote,
  RecurringExpense,
  Product,
  Purchase,
  Staff,
  StockMovement,
  Supplier,
  WidgetInstance,
  WidgetSize,
  WidgetType,
} from "./types";

/* ------------------------------------------------------------- settings */


export type InvoiceTemplate = "a4" | "a5" | "a4duo" | "letter" | "thermal80" | "thermal58" | "mushak";

export interface BusinessProfile {
  name: string;
  nameBn: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  facebook: string;
  logo: string | null; // data URL
  logoShape: "circle" | "rounded" | "square";
}

export interface InvoiceSettings {
  template: InvoiceTemplate;
  lang: Lang;
  numerals: Numerals;
  showSku: boolean;
  showImages: boolean;
  useBrandColor: boolean;
  footer: string;
  terms: string;
  thanks: string;
  prefix: string;
  showQr: boolean;
  /** VAT registration (FR-INV-12). Prices are VAT-inclusive when vatPercent > 0. */
  vatPercent?: number;
  bin?: string;
}

export interface PosSettings {
  deliveryPresets: { id: string; label: string; labelBn: string; amount: number }[];
  allowNegativeStock: boolean;
  lastChannel: Channel;
  defaultSettlement: "cod" | "due";
  /** Stock location the order screen sells from (FR-STK-10). */
  defaultLocationId?: string;
}

export interface DeliveryPreset {
  id: string;
  label: string;
  labelBn: string;
  amount: number;
}

export type DashRange = "today" | "7d" | "30d";

export const WIDGET_SIZES: Record<WidgetType, WidgetSize[]> = {
  greeting: ["xl"],
  kpis: ["xl", "l"],
  journey: ["xl", "l"],
  salesTrend: ["l", "m", "xl"],
  codCourier: ["s", "m"],
  lowStock: ["s", "m"],
  topProducts: ["s", "m"],
  channelMix: ["s", "m"],
  recentOrders: ["m", "l", "xl"],
  goal: ["s", "m"],
  heatmap: ["m", "l"],
  returnsWatch: ["s", "m"],
  dues: ["s", "m"],
  quickActions: ["s", "m", "l", "xl"],
  profitWaterfall: ["m", "l", "xl"],
};

const w = (type: WidgetType, size: WidgetSize): WidgetInstance => ({ id: `w_${type}`, type, size });

export const DASH_PRESETS: Record<string, { name: string; nameBn: string; note: string; layout: WidgetInstance[] }> = {
  owner: {
    name: "Owner's morning",
    nameBn: "মালিকের সকাল",
    note: "Money, profit and what needs attention",
    layout: [w("greeting", "xl"), w("kpis", "xl"), w("journey", "xl"), w("salesTrend", "l"), w("goal", "s"), w("codCourier", "s"), w("topProducts", "s"), w("lowStock", "s"), w("profitWaterfall", "m"), w("channelMix", "m"), w("heatmap", "l"), w("returnsWatch", "s"), w("recentOrders", "l"), w("dues", "s")],
  },
  packing: {
    name: "Packing desk",
    nameBn: "প্যাকিং ডেস্ক",
    note: "Today's parcels and stock to watch",
    layout: [w("greeting", "xl"), w("journey", "xl"), w("recentOrders", "l"), w("quickActions", "s"), w("lowStock", "m"), w("codCourier", "m")],
  },
  sales: {
    name: "Sales floor",
    nameBn: "সেলস ফ্লোর",
    note: "Orders, channels and the monthly target",
    layout: [w("greeting", "xl"), w("quickActions", "xl"), w("goal", "s"), w("channelMix", "s"), w("topProducts", "s"), w("recentOrders", "m"), w("heatmap", "m")],
  },
};

/* ------------------------------------------------------------- state */

export interface AppState {
  seeded: boolean;
  version: number;
  currentUserId: string;
  staff: Staff[];
  business: BusinessProfile;
  theme: ThemeSettings;
  lang: Lang;
  numerals: Numerals;
  invoice: InvoiceSettings;
  /** This device's printers; never synced. */
  printer: PrinterPrefs;
  pos: PosSettings;
  plan: { name: string; orderLimit: number; renewsAt: string };
  monthlyGoal: number;
  dashboard: { layout: WidgetInstance[]; range: DashRange; preset: string | null };

  categories: Category[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  movements: StockMovement[];
  suppliers: Supplier[];
  purchases: Purchase[];
  expenses: Expense[];
  notices: Notice[];
  parked: ParkedCart[];
  locations: Location[];
  purchaseOrders: PurchaseOrder[];
  quotes: Quote[];
  recurring: RecurringExpense[];
  nextOrderNo: number;
  nextInvoiceNo: number;
  nextPurchaseNo: number;
  /** Commands applied on this device but not yet confirmed by the server. */
  outbox: QueuedCommand[];
  sync: SyncState;
}

export interface SyncState {
  /** "demo" keeps everything on this device; "account" syncs with the server. */
  mode: "demo" | "account";
  userId?: string;
  businessId?: string;
  cursor?: string;
  lastSyncAt?: string;
  status: "idle" | "syncing" | "offline" | "error";
  error?: string;
  rejected: { id: string; type: string; error: string; at: string }[];
}


export const STORE_VERSION = 4;

/** A fresh, unshared copy every call — Immer freezes what it produces, so defaults must never be shared. */
export const initialState = (): AppState => structuredClone(baseState());

const baseState = (): AppState => ({
  seeded: false,
  version: STORE_VERSION,
  currentUserId: STAFF[0].id,
  staff: STAFF,
  business: {
    name: "Rongdhonu Boutique",
    nameBn: "রংধনু বুটিক",
    tagline: "Handloom & everyday wear, delivered",
    phone: "01711234567",
    email: "hello@rongdhonu.shop",
    address: "House 14, Road 3, Block B, Mirpur 10, Dhaka 1216",
    facebook: "fb.com/rongdhonu.boutique",
    logo: null,
    logoShape: "rounded",
  },
  theme: DEFAULT_THEME,
  lang: "en",
  numerals: "latin",
  invoice: {
    template: "a5",
    lang: "en",
    numerals: "latin",
    showSku: true,
    showImages: false,
    useBrandColor: true,
    footer: "Exchange within 3 days with this invoice. No cash refunds on sale items.",
    terms: "Check your parcel in front of the rider before paying.",
    thanks: "Thank you for shopping with us!",
    prefix: "INV",
    showQr: true,
  },
  printer: DEFAULT_PRINTER,
  pos: {
    deliveryPresets: [
      { id: "dp_in", label: "Inside Dhaka", labelBn: "ঢাকার ভিতরে", amount: 70 },
      { id: "dp_sub", label: "Dhaka suburbs", labelBn: "ঢাকার আশেপাশে", amount: 100 },
      { id: "dp_out", label: "Outside Dhaka", labelBn: "ঢাকার বাইরে", amount: 130 },
    ],
    allowNegativeStock: false,
    lastChannel: "facebook",
    defaultSettlement: "cod",
  },
  plan: { name: "Business", orderLimit: 2500, renewsAt: "" },
  monthlyGoal: 450000,
  dashboard: { layout: DASH_PRESETS.owner.layout, range: "7d", preset: "owner" },
  categories: CATEGORIES,
  products: [],
  customers: [],
  orders: [],
  movements: [],
  suppliers: [],
  purchases: [],
  expenses: [],
  notices: [],
  parked: [],
  locations: [],
  purchaseOrders: [],
  quotes: [],
  recurring: [],
  nextOrderNo: 1001,
  nextInvoiceNo: 1,
  nextPurchaseNo: 8,
  outbox: [],
  sync: { mode: "demo", status: "idle", rejected: [] },
});


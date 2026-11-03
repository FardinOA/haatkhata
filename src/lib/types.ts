// Core domain model — mirrors SRS §6.

export type Lang = "en" | "bn";
export type Numerals = "latin" | "bangla";

export type Channel = "facebook" | "instagram" | "whatsapp" | "tiktok" | "website" | "walkin" | "phone" | "other";

export type OrderStatus =
  | "draft"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "returned"
  | "partially_returned"
  | "cancelled";

export type PayMethod = "cash" | "bkash" | "nagad" | "rocket" | "bank" | "card";

export type BuiltinRole = "owner" | "manager" | "sales" | "packer" | "accountant";
/** Custom roles (FR-AUTH-06) are keyed `custom:<businessId>:<roleId>`. */
export type CustomRoleKey = `custom:${string}`;
export type Role = BuiltinRole | CustomRoleKey;

export interface CustomRoleDef {
  key: CustomRoleKey;
  id: string;
  businessId: string;
  name: string;
  nameBn?: string;
  permissions: Permission[];
  /** Largest order discount (%) without approval; ignored when `big_discount` is granted. */
  maxDiscountPct: number;
}

export type Permission =
  | "view_cost"
  | "edit_price"
  | "edit_stock"
  | "delete_order"
  | "big_discount"
  | "settings"
  | "billing"
  | "reports"
  | "pack_ship"
  | "deliver_return"
  | "create_order";

export type PatternId = "stripe" | "check" | "dots" | "wave" | "diamond" | "plain" | "paisley" | "weave";

export interface ProductArt {
  hue: string; // hex
  pattern: PatternId;
}

export interface OptionType {
  name: string;
  values: string[];
}

export interface Variant {
  id: string;
  sku: string;
  barcode?: string;
  options: Record<string, string>;
  price: number;
  cost: number; // weighted average cost
  mrp?: number;
  onHand: number;
  reserved: number;
  inTransit: number;
  damaged: number;
  lowStock: number;
  active: boolean;
  /** Units per location (sums to onHand). Missing = everything at the default location. */
  stockByLocation?: Record<string, number>;
  /** Batches with expiry, for products that track them. Sold earliest-expiry first. */
  batches?: Batch[];
}

export interface Product {
  id: string;
  name: string;
  nameBn?: string;
  categoryId: string;
  unit: string;
  description?: string;
  images: string[]; // data URLs
  art: ProductArt;
  optionTypes: OptionType[];
  variants: Variant[];
  status: "active" | "inactive";
  tags: string[];
  createdAt: string;
  /** Batch & expiry tracking for this product (FR-STK-12). */
  trackBatches?: boolean;
  /** Set when this product is a combo of other SKUs (FR-PRD-09). */
  bundle?: BundleComponent[];
}

export interface Category {
  id: string;
  name: string;
  nameBn: string;
}

export interface Address {
  line: string;
  area: string;
  district: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string; // local format 01XXXXXXXXX
  altPhone?: string;
  address: Address;
  channel: Channel;
  tags: string[];
  notes?: string;
  risky: boolean;
  fbLink?: string;
  /** Customer agreed to receive SMS such as payment reminders (FR-PAY-03). */
  smsConsent?: boolean;
  createdAt: string;
}

export interface OrderLine {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  variantLabel: string;
  sku: string;
  qty: number;
  price: number;
  discount: number; // ৳ off the whole line
  cost: number; // unit cost snapshot at sale time
  returnedQty: number;
}

export interface Payment {
  id: string;
  method: PayMethod;
  amount: number; // refunds are negative
  txnId?: string;
  at: string;
  by: string;
  kind: "advance" | "payment" | "refund";
}

export type OrderEventType = "created" | "status" | "payment" | "edit" | "print" | "note" | "return" | "cod";

export interface OrderEvent {
  id: string;
  at: string;
  by: string;
  type: OrderEventType;
  from?: OrderStatus;
  to?: OrderStatus;
  note?: string;
}

export interface ReturnRecord {
  id: string;
  at: string;
  lines: { lineId: string; qty: number; condition: "restock" | "damaged" }[];
  fee: number;
  refund: number;
}

export interface Courier {
  name: string;
  tracking?: string;
  fee?: number;
  /** Booked through a courier integration (F1). */
  provider?: CourierProvider;
  consignmentId?: string;
  /** Last status reported by the courier, in its own words. */
  courierStatus?: string;
}

export type CourierProvider = "steadfast" | "pathao" | "redx" | "paperfly" | "carrybee" | "sandbox";

export interface Order {
  id: string;
  no: number; // human number, e.g. 1042
  invoiceNo?: string;
  channel: Channel;
  customerId?: string;
  customer: { name: string; phone: string; address?: Address } | null;
  lines: OrderLine[];
  discount: { type: "flat" | "pct"; value: number };
  deliveryCharge: number;
  otherCharges: number;
  payments: Payment[];
  /** What happens to the unpaid remainder. */
  settlement: "cod" | "due";
  status: OrderStatus;
  courier?: Courier;
  codReceived?: { at: string; ref?: string };
  notesInternal?: string;
  notesInvoice?: string;
  events: OrderEvent[];
  returns: ReturnRecord[];
  createdAt: string;
  createdBy: string;
  /** Where stock for this order is taken from (FR-STK-10). */
  locationId?: string;
  /** Exchange links (FR-ORD-06). */
  exchangeOf?: string;
  exchangedTo?: string;
  /** Converted from this quotation (FR-INV-11). */
  quoteId?: string;
}

export type MovementReason = "opening" | "purchase" | "sale" | "return" | "adjust" | "damage" | "transfer";

export interface StockMovement {
  id: string;
  productId: string;
  variantId: string;
  delta: number;
  reason: MovementReason;
  refLabel?: string; // "Order #1042", "PUR-0007"
  refId?: string;
  balance: number; // on-hand after this movement
  by: string;
  at: string;
  note?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address?: string;
  balance: number; // we owe them
}

export interface Purchase {
  id: string;
  ref: string;
  supplierId?: string;
  date: string;
  lines: { variantId: string; productId: string; qty: number; unitCost: number }[];
  total: number;
  paid: number;
  note?: string;
}

export type ExpenseCategory = "delivery" | "return_fee" | "packaging" | "ads" | "rent" | "salary" | "other";

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  method: PayMethod;
  note?: string;
  refOrderId?: string;
}

export interface Staff {
  id: string;
  name: string;
  phone: string;
  role: Role;
  color: string;
}

export interface Notice {
  id: string;
  at: string;
  kind: "low_stock" | "new_order" | "cod_overdue" | "plan" | "return";
  title: string;
  body?: string;
  href?: string;
  read: boolean;
}

export type WidgetType =
  | "greeting"
  | "kpis"
  | "journey"
  | "salesTrend"
  | "codCourier"
  | "lowStock"
  | "topProducts"
  | "channelMix"
  | "recentOrders"
  | "goal"
  | "heatmap"
  | "returnsWatch"
  | "dues"
  | "quickActions"
  | "profitWaterfall";

export type WidgetSize = "s" | "m" | "l" | "xl";

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  size: WidgetSize;
}

export interface CartLine {
  key: string;
  productId: string;
  variantId: string;
  qty: number;
  price: number;
  discount: number;
}

export interface ParkedCart {
  id: string;
  label: string;
  at: string;
  lines: CartLine[];
  customer: { name: string; phone: string; address?: Address } | null;
  channel: Channel;
}

/* ------------------------------------------------------------ inventory & documents (F2) */

export interface Location {
  id: string;
  name: string;
  nameBn: string;
  isDefault: boolean;
  active: boolean;
}

export interface Batch {
  id: string;
  code: string;
  /** YYYY-MM-DD */
  expiry?: string;
  qty: number;
}

export interface BundleComponent {
  variantId: string;
  qty: number;
}

export type PurchaseOrderStatus = "draft" | "ordered" | "partial" | "received" | "closed" | "cancelled";

export interface PurchaseOrder {
  id: string;
  no: string; // PO-0001
  supplierId?: string;
  status: PurchaseOrderStatus;
  lines: { variantId: string; productId: string; qty: number; received: number; unitCost: number }[];
  expectedAt?: string;
  locationId?: string;
  note?: string;
  createdAt: string;
  createdBy: string;
  history: { at: string; by: string; note: string }[];
}

export type QuoteStatus = "draft" | "sent" | "accepted" | "converted" | "expired";

export interface Quote {
  id: string;
  no: string; // Q-0001
  status: QuoteStatus;
  customer: { name: string; phone: string; address?: Address } | null;
  channel: Channel;
  lines: { productId: string; variantId: string; name: string; variantLabel: string; qty: number; price: number; discount: number }[];
  discount: { type: "flat" | "pct"; value: number };
  deliveryCharge: number;
  validUntil: string; // YYYY-MM-DD
  notes?: string;
  orderId?: string;
  createdAt: string;
  createdBy: string;
}

export interface RecurringExpense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  method: PayMethod;
  note?: string;
  /** 1–28 */
  dayOfMonth: number;
  /** YYYY-MM of the last month an expense was created for. */
  lastRun?: string;
  active: boolean;
}

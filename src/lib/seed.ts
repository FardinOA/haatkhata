/**
 * Demo data for "Rongdhonu Boutique" — a Facebook-first clothing seller in
 * Dhaka. Deterministic (seeded PRNG) but anchored to the current date, so the
 * dashboard always has a believable "today". Stock is built backwards from
 * orders so that every variant's on-hand equals the sum of its ledger.
 */
import { CATEGORIES, STAFF, uid } from "./base-data";
import { DHAKA_AREAS, DISTRICTS } from "./geo";

export { CATEGORIES, STAFF, uid };
import type {
  Channel,
  Customer,
  Expense,
  Notice,
  Order,
  OrderEvent,
  OrderLine,
  OrderStatus,
  PatternId,
  Payment,
  Product,
  Purchase,
  ReturnRecord,
  StockMovement,
  Supplier,
  Variant,
  Location,
  PurchaseOrder,
  Quote,
  RecurringExpense,
} from "./types";

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}




type ProductSpec = {
  name: string;
  nameBn: string;
  cat: string;
  price: number;
  cost: number;
  mrp?: number;
  hue: string;
  pattern: PatternId;
  options: { name: string; values: string[] }[];
  prefix: string;
  pop: number; // relative popularity
};

const SPECS: ProductSpec[] = [
  { name: "Dhakai Jamdani Saree", nameBn: "ঢাকাই জামদানি শাড়ি", cat: "cat_saree", price: 6500, cost: 4200, mrp: 7200, hue: "#B23A48", pattern: "diamond", options: [{ name: "Colour", values: ["Red", "Teal", "Off-white"] }], prefix: "JMD", pop: 3 },
  { name: "Tangail Cotton Saree", nameBn: "টাঙ্গাইল সুতি শাড়ি", cat: "cat_saree", price: 1850, cost: 1150, hue: "#D79A1E", pattern: "stripe", options: [{ name: "Colour", values: ["Mustard", "Indigo", "Green"] }], prefix: "TNG", pop: 6 },
  { name: "Cotton Three-piece", nameBn: "সুতি থ্রি-পিস", cat: "cat_three", price: 1450, cost: 880, mrp: 1650, hue: "#E58F7A", pattern: "paisley", options: [{ name: "Colour", values: ["Peach", "Mint", "Navy"] }], prefix: "TPC", pop: 9 },
  { name: "Block-print Kurti", nameBn: "ব্লক প্রিন্ট কুর্তি", cat: "cat_kurti", price: 890, cost: 480, hue: "#3446C4", pattern: "dots", options: [{ name: "Size", values: ["S", "M", "L", "XL"] }, { name: "Colour", values: ["Indigo", "Rust"] }], prefix: "KRT", pop: 12 },
  { name: "Linen Panjabi", nameBn: "লিনেন পাঞ্জাবি", cat: "cat_panjabi", price: 1650, cost: 950, hue: "#7FA7C9", pattern: "weave", options: [{ name: "Size", values: ["38", "40", "42", "44"] }, { name: "Colour", values: ["White", "Sky"] }], prefix: "PNJ", pop: 7 },
  { name: "Georgette Hijab", nameBn: "জর্জেট হিজাব", cat: "cat_hijab", price: 350, cost: 160, hue: "#8C6E63", pattern: "plain", options: [{ name: "Colour", values: ["Black", "Beige", "Dusty rose", "Olive"] }], prefix: "HJB", pop: 14 },
  { name: "Nakshi Kantha Cushion Cover", nameBn: "নকশি কাঁথা কুশন কভার", cat: "cat_home", price: 650, cost: 320, hue: "#C2306B", pattern: "wave", options: [{ name: "Size", values: ['16"', '18"'] }], prefix: "NKC", pop: 4 },
  { name: "Jute Tote Bag", nameBn: "পাটের টোট ব্যাগ", cat: "cat_acc", price: 450, cost: 210, hue: "#A68A5B", pattern: "check", options: [], prefix: "JTB", pop: 5 },
  { name: "Silk Orna", nameBn: "সিল্ক ওড়না", cat: "cat_hijab", price: 980, cost: 560, hue: "#9C2A7C", pattern: "paisley", options: [{ name: "Colour", values: ["Magenta", "Gold"] }], prefix: "ORN", pop: 5 },
  { name: "Kids Cotton Frock", nameBn: "বাচ্চাদের সুতি ফ্রক", cat: "cat_kids", price: 750, cost: 390, hue: "#E7A3B4", pattern: "dots", options: [{ name: "Size", values: ["2–3y", "4–5y", "6–7y"] }], prefix: "FRK", pop: 4 },
  { name: "Oxidised Jhumka", nameBn: "অক্সিডাইজড ঝুমকা", cat: "cat_acc", price: 290, cost: 110, hue: "#6F7A80", pattern: "diamond", options: [], prefix: "JHM", pop: 6 },
  { name: "Muslin Scarf", nameBn: "মসলিন স্কার্ফ", cat: "cat_hijab", price: 1250, cost: 700, hue: "#D9B8A0", pattern: "weave", options: [{ name: "Colour", values: ["Rose", "Ivory"] }], prefix: "MSL", pop: 3 },
  { name: "Herbal Mehendi Cone", nameBn: "হারবাল মেহেদি কোন", cat: "cat_acc", price: 120, cost: 55, hue: "#7A5A2E", pattern: "plain", options: [], prefix: "MHD", pop: 4 },
];

const FIRST = ["Ayesha", "Farhana", "Sumaiya", "Tasnim", "Raisa", "Jannatul", "Sadia", "Mehjabin", "Anika", "Nabila", "Lamia", "Shirin", "Rumana", "Tahmina", "Sharmin", "Afroza", "Mitu", "Puja", "Ananya", "Dipa", "Rafiq", "Arif", "Sabbir", "Imran", "Fahim", "Mahmud", "Shuvo", "Riyad", "Nadia", "Fatema", "Maliha", "Sanjida", "Rehana", "Kakoli", "Tania", "Sabrina", "Moushumi", "Shampa", "Joya", "Ishrat"];
const LAST = ["Rahman", "Hossain", "Akter", "Islam", "Chowdhury", "Ahmed", "Khan", "Sultana", "Begum", "Sarker", "Das", "Roy", "Haque", "Karim", "Mia", "Siddiqui", "Biswas", "Talukder"];
const STREETS = ["Road 7, House 23", "Lane 4, Flat B2", "House 12/A", "Block C, House 44", "Road 11, House 8", "Sector 6, House 19", "Holding 221", "Para road, House 5", "Flat 3C, Road 2", "House 67, 2nd floor"];
const TOWN_AREAS: Record<string, string[]> = {
  Chattogram: ["Agrabad", "GEC", "Nasirabad", "Halishahar"],
  Sylhet: ["Zindabazar", "Amberkhana", "Uposhohor"],
  Rajshahi: ["Shaheb Bazar", "Uposhohor"],
  Khulna: ["Sonadanga", "Khalishpur"],
  Gazipur: ["Tongi", "Joydebpur"],
  Narayanganj: ["Chashara", "Fatullah"],
  Cumilla: ["Kandirpar", "Tomsom Bridge"],
  Bogura: ["Satmatha", "Sherpur road"],
  Rangpur: ["Jahaj Company", "Lalbag"],
  Barishal: ["Sadar road", "Nathullabad"],
  Mymensingh: ["Ganginarpar", "Charpara"],
};

const CHANNEL_WEIGHTS: [Channel, number][] = [
  ["facebook", 50], ["instagram", 12], ["whatsapp", 15], ["walkin", 11], ["tiktok", 6], ["phone", 4], ["website", 2],
];

export type SeedResult = {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  movements: StockMovement[];
  suppliers: Supplier[];
  purchases: Purchase[];
  expenses: Expense[];
  notices: Notice[];
  nextOrderNo: number;
  nextInvoiceNo: number;
  locations: Location[];
  purchaseOrders: PurchaseOrder[];
  quotes: Quote[];
  recurring: RecurringExpense[];
};

export function buildSeed(now = new Date()): SeedResult {
  const rnd = mulberry32(20261102);
  const pickW = <T,>(items: [T, number][]) => {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let r = rnd() * total;
    for (const [v, w] of items) if ((r -= w) <= 0) return v;
    return items[items.length - 1][0];
  };
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  let idc = 0;
  const id = (p: string) => `${p}${(++idc).toString(36).padStart(4, "0")}`;

  const DAY = 86_400_000;
  const at = (daysBack: number, hour: number, minute = int(0, 59)) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysBack);
    d.setHours(hour, minute, int(0, 59), 0);
    return d;
  };

  /* ---------------- products */
  const products: Product[] = SPECS.map((s, pi) => {
    const pid = id("p_");
    const combos: Record<string, string>[] = s.options.length
      ? s.options.reduce<Record<string, string>[]>(
          (acc, opt) => acc.flatMap((c) => opt.values.map((v) => ({ ...c, [opt.name]: v }))),
          [{}],
        )
      : [{}];
    const variants: Variant[] = combos.map((options, vi) => ({
      id: id("v_"),
      sku: `${s.prefix}-${String(101 + vi)}`,
      barcode: `2${String(100000000000 + pi * 1000 + vi * 7 + 13).slice(-11)}`,
      options,
      price: s.price,
      cost: s.cost,
      mrp: s.mrp,
      onHand: 0,
      reserved: 0,
      inTransit: 0,
      damaged: 0,
      lowStock: s.price > 3000 ? 2 : 5,
      active: true,
    }));
    return {
      id: pid,
      name: s.name,
      nameBn: s.nameBn,
      categoryId: s.cat,
      unit: "pcs",
      description: "",
      images: [],
      art: { hue: s.hue, pattern: s.pattern },
      optionTypes: s.options,
      variants,
      status: "active",
      tags: pi < 3 ? ["bestseller"] : [],
      createdAt: at(58, 11).toISOString(),
    };
  });

  /* ---------------- customers */
  const customers: Customer[] = [];
  const usedPhones = new Set<string>();
  for (let i = 0; i < 64; i++) {
    let phone: string;
    do phone = `01${pick(["3", "5", "6", "7", "8", "9"])}${String(int(10000000, 99999999))}`;
    while (usedPhones.has(phone));
    usedPhones.add(phone);
    const inDhaka = rnd() < 0.58;
    const district = inDhaka ? "Dhaka" : pick(Object.keys(TOWN_AREAS).concat(DISTRICTS.slice(10, 40).map(([d]) => d)));
    const area = inDhaka ? pick(DHAKA_AREAS) : pick(TOWN_AREAS[district] ?? ["Sadar"]);
    customers.push({
      id: id("c_"),
      name: `${pick(FIRST)} ${pick(LAST)}`,
      phone,
      address: { line: pick(STREETS), area, district },
      channel: pickW(CHANNEL_WEIGHTS.filter(([c]) => c !== "walkin")),
      tags: [],
      risky: false,
      createdAt: at(int(30, 60), int(10, 22)).toISOString(),
    });
  }
  // A handful of loyal regulars and a few serial returners.
  const regulars = customers.slice(0, 8);
  regulars.forEach((c) => c.tags.push("regular"));
  const returners = customers.slice(8, 11);
  customers[3].tags.push("wholesale");
  customers[9].risky = true;
  customers[9].notes = "Refused 2 parcels in October. Ask for advance.";

  /* ---------------- orders */
  const orders: Order[] = [];
  const expenses: Expense[] = [];
  let orderNo = 1001;
  let invoiceNo = 1;
  const allVariants = products.flatMap((p) => p.variants.map((v) => ({ p, v, w: SPECS[products.indexOf(p)].pop / p.variants.length })));

  const statusFor = (age: number, ch: Channel, isReturner: boolean): OrderStatus => {
    if (ch === "walkin") return rnd() < 0.03 ? "cancelled" : "delivered";
    if (age === 0) return pickW<OrderStatus>([["draft", 12], ["confirmed", 48], ["packed", 26], ["shipped", 10], ["cancelled", 4]]);
    if (age === 1) return pickW<OrderStatus>([["confirmed", 12], ["packed", 20], ["shipped", 62], ["cancelled", 6]]);
    if (age <= 3) return pickW<OrderStatus>([["shipped", 34], ["delivered", 52], ["returned", isReturner ? 40 : 9], ["cancelled", 5]]);
    return pickW<OrderStatus>([["delivered", 82], ["returned", isReturner ? 60 : 9], ["partially_returned", 2], ["cancelled", 4]]);
  };

  for (let age = 44; age >= 0; age--) {
    const dow = at(age, 12).getDay();
    // Growth trend + Friday/Saturday bump.
    const base = 4 + (44 - age) * 0.11 + (dow === 5 || dow === 6 ? 2 : 0);
    const count = Math.max(1, Math.round(base + (rnd() - 0.4) * 4));
    const nowHour = now.getHours();
    for (let k = 0; k < count; k++) {
      const channel = pickW(CHANNEL_WEIGHTS);
      // Online orders cluster in the evening, walk-ins in the afternoon.
      let hour = channel === "walkin" ? int(11, 19) : pickW<number>([[10, 2], [12, 2], [14, 3], [16, 3], [19, 5], [20, 6], [21, 7], [22, 5], [23, 2]]);
      if (age === 0 && hour > nowHour) hour = Math.max(8, nowHour - int(0, 3));
      const created = at(age, hour);
      if (created > now) created.setTime(now.getTime() - int(5, 90) * 60_000);

      const repeat = rnd() < 0.35;
      const isReturnerPick = rnd() < 0.08;
      const customer =
        channel === "walkin" && rnd() < 0.6
          ? null
          : isReturnerPick
            ? pick(returners)
            : repeat
              ? pick(regulars)
              : pick(customers);
      const isReturner = !!customer && returners.includes(customer);
      const status = statusFor(age, channel, isReturner);

      const lineCount = pickW([[1, 60], [2, 30], [3, 10]]);
      const lines: OrderLine[] = [];
      for (let li = 0; li < lineCount; li++) {
        const { p, v } = pickW(allVariants.map((x) => [x, x.w] as [typeof x, number]));
        if (lines.some((l) => l.variantId === v.id)) continue;
        const qty = pickW([[1, 80], [2, 16], [3, 4]]);
        lines.push({
          id: id("l_"),
          productId: p.id,
          variantId: v.id,
          name: p.name,
          variantLabel: Object.values(v.options).join(" / "),
          sku: v.sku,
          qty,
          price: v.price,
          discount: 0,
          cost: v.cost,
          returnedQty: 0,
        });
      }

      const district = customer?.address.district ?? "Dhaka";
      const deliveryCharge = channel === "walkin" ? 0 : district === "Dhaka" ? 70 : 130;
      const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
      const discount = rnd() < 0.16 ? { type: "flat" as const, value: pick([50, 100, 150, 200]) } : { type: "flat" as const, value: 0 };
      const total = subtotal - discount.value + deliveryCharge;

      const createdBy = channel === "walkin" ? pick([STAFF[0], STAFF[1]]) : pickW([[STAFF[2], 6], [STAFF[0], 3], [STAFF[1], 2]]);
      const events: OrderEvent[] = [{ id: id("e_"), at: created.toISOString(), by: createdBy.name, type: "created" }];
      const payments: Payment[] = [];
      const t = created.getTime();

      if (channel === "walkin") {
        const method = pickW<Payment["method"]>([["cash", 6], ["bkash", 3], ["card", 1]]);
        // Known walk-in regulars sometimes buy on credit (বাকি) and pay part now.
        const onCredit = !!customer && rnd() < 0.4;
        const paidNow = onCredit ? Math.round((total * pick([0.3, 0.5, 0.6])) / 10) * 10 : total;
        if (status !== "cancelled" && paidNow > 0)
          payments.push({ id: id("pay_"), method, amount: paidNow, at: created.toISOString(), by: createdBy.name, kind: "payment" });
      } else if (rnd() < (isReturner ? 0.1 : 0.32)) {
        const adv = rnd() < 0.7 ? deliveryCharge : total;
        payments.push({ id: id("pay_"), method: pickW<Payment["method"]>([["bkash", 7], ["nagad", 3]]), amount: adv, txnId: `TX${int(10000000, 99999999)}`, at: new Date(t + 20 * 60_000).toISOString(), by: createdBy.name, kind: "advance" });
      }

      const order: Order = {
        id: id("o_"),
        no: orderNo++,
        channel,
        customerId: customer?.id,
        customer: customer ? { name: customer.name, phone: customer.phone, address: customer.address } : null,
        lines,
        discount,
        deliveryCharge,
        otherCharges: 0,
        payments,
        settlement: channel === "walkin" ? "due" : "cod",
        status,
        events,
        returns: [],
        createdAt: created.toISOString(),
        createdBy: createdBy.name,
        notesInvoice: rnd() < 0.1 ? "Please handle with care — gift." : undefined,
      };

      // Walk through the lifecycle so the timeline is believable.
      const step = (to: OrderStatus, offsetH: number, by = STAFF[3].name) => {
        const from = events.filter((e) => e.type === "status").at(-1)?.to ?? "draft";
        const when = Math.min(now.getTime() - 60_000, t + offsetH * 3_600_000);
        events.push({ id: id("e_"), at: new Date(when).toISOString(), by, type: "status", from, to });
        return when;
      };

      if (channel === "walkin") {
        if (status === "delivered") step("delivered", 0.02, createdBy.name);
        else step("cancelled", 0.1, createdBy.name);
      } else if (status !== "draft") {
        if (status === "cancelled") {
          if (rnd() < 0.5) step("confirmed", 0.3, createdBy.name);
          step("cancelled", 2, STAFF[1].name);
        } else {
          step("confirmed", 0.3, createdBy.name);
          if (["packed", "shipped", "delivered", "returned", "partially_returned"].includes(status)) step("packed", 12);
          if (["shipped", "delivered", "returned", "partially_returned"].includes(status)) {
            step("shipped", 16);
            const courier = pickW([["Steadfast", 45], ["Pathao", 30], ["RedX", 25]]);
            order.courier = { name: courier, tracking: `${courier.slice(0, 2).toUpperCase()}${int(1000000, 9999999)}`, fee: district === "Dhaka" ? 60 : 110 };
          }
          if (status === "delivered" || status === "partially_returned") step("delivered", int(28, 70), STAFF[1].name);
          if (status === "returned" || status === "partially_returned") {
            const when = step(status, int(50, 96), STAFF[1].name);
            const retLines =
              status === "returned"
                ? lines.map((l) => ({ lineId: l.id, qty: l.qty, condition: (rnd() < 0.88 ? "restock" : "damaged") as "restock" | "damaged" }))
                : [{ lineId: lines[0].id, qty: 1, condition: "restock" as const }];
            retLines.forEach((r) => {
              const l = lines.find((x) => x.id === r.lineId)!;
              l.returnedQty = r.qty;
            });
            const fee = order.courier?.fee ?? 60;
            const rec: ReturnRecord = { id: id("r_"), at: new Date(when).toISOString(), lines: retLines, fee, refund: 0 };
            order.returns.push(rec);
            expenses.push({ id: id("x_"), category: "return_fee", amount: fee, date: rec.at, method: "cash", note: `Return fee · Order #${order.no}`, refOrderId: order.id });
            events.push({ id: id("e_"), at: rec.at, by: STAFF[1].name, type: "return", note: `${retLines.reduce((s, r) => s + r.qty, 0)} item(s) back · fee ৳${fee}` });
          }
          // Couriers pay out within about a week; only recent deliveries are still pending.
          if (status === "delivered" && (age >= 7 ? true : age >= 4 ? rnd() < 0.55 : false)) {
            const recAt = new Date(Math.min(now.getTime() - 3_600_000, t + int(3, 6) * DAY));
            if (recAt < now) {
              order.codReceived = { at: recAt.toISOString(), ref: `PAYOUT-${int(10000, 99999)}` };
              events.push({ id: id("e_"), at: order.codReceived.at, by: STAFF[0].name, type: "cod", note: `COD received from ${order.courier?.name}` });
            }
          }
        }
      }
      if (status !== "draft") order.invoiceNo = `INV-${created.getFullYear()}-${String(invoiceNo++).padStart(6, "0")}`;
      orders.push(order);
    }
  }
  orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  /* ---------------- stock, built backwards from orders */
  const suppliers: Supplier[] = [
    { id: "sup_tangail", name: "Tangail Taant Ghor", phone: "01715443322", address: "Pathrail, Tangail", balance: 18500 },
    { id: "sup_narsingdi", name: "Narsingdi Fabric House", phone: "01819332211", address: "Baburhat, Narsingdi", balance: 0 },
    { id: "sup_islampur", name: "Islampur Wholesale", phone: "01913887766", address: "Islampur, Old Dhaka", balance: 6200 },
  ];
  const movements: StockMovement[] = [];
  const purchases: Purchase[] = [];
  const restockAt = at(12, 15);
  const restockLines: Purchase["lines"] = [];

  type Ev = { at: string; delta: number; reason: StockMovement["reason"]; refLabel: string; refId: string; by: string };
  const flows = new Map<string, Ev[]>();
  const push = (vid: string, e: Ev) => flows.set(vid, [...(flows.get(vid) ?? []), e]);

  for (const o of orders) {
    const shipEv = o.events.find((e) => e.type === "status" && (e.to === "shipped" || (o.channel === "walkin" && e.to === "delivered")));
    for (const l of o.lines) {
      const v = products.find((p) => p.id === l.productId)!.variants.find((x) => x.id === l.variantId)!;
      if (o.status === "confirmed" || o.status === "packed") v.reserved += l.qty;
      if (o.status === "shipped") v.inTransit += l.qty;
      if (shipEv) push(v.id, { at: shipEv.at, delta: -l.qty, reason: "sale", refLabel: `Order #${o.no}`, refId: o.id, by: shipEv.by });
      for (const r of o.returns) {
        for (const rl of r.lines.filter((x) => x.lineId === l.id)) {
          if (rl.condition === "restock") push(v.id, { at: r.at, delta: rl.qty, reason: "return", refLabel: `Order #${o.no}`, refId: o.id, by: STAFF[1].name });
          else v.damaged += rl.qty;
        }
      }
    }
  }

  products.forEach((p, pi) => {
    p.variants.forEach((v, vi) => {
      const evs = (flows.get(v.id) ?? []).sort((a, b) => a.at.localeCompare(b.at));
      // Target available stock — a few variants deliberately low or out.
      const roll = (pi * 7 + vi * 3) % 17;
      const targetAvail = roll === 0 ? 0 : roll < 3 ? int(1, v.lowStock) : int(v.lowStock + 3, v.price > 3000 ? 9 : 34);
      v.onHand = targetAvail + v.reserved;
      const netOut = -evs.reduce((s, e) => s + e.delta, 0);
      const total = v.onHand + netOut;
      let restock = Math.round(total * 0.3);
      const outBefore = evs.filter((e) => e.at < restockAt.toISOString()).reduce((s, e) => s - e.delta, 0);
      if (total - restock < outBefore + 1) restock = 0;
      const opening = total - restock;

      const all: Ev[] = [
        { at: at(50, 10).toISOString(), delta: opening, reason: "opening" as const, refLabel: "Opening stock", refId: "", by: STAFF[0].name },
        ...(restock > 0 ? [{ at: restockAt.toISOString(), delta: restock, reason: "purchase" as const, refLabel: "PUR-0007", refId: "pur_7", by: STAFF[1].name }] : []),
        ...evs,
      ].sort((a, b) => a.at.localeCompare(b.at));
      let bal = 0;
      for (const e of all) {
        bal += e.delta;
        movements.push({ id: id("m_"), productId: p.id, variantId: v.id, delta: e.delta, reason: e.reason, refLabel: e.refLabel, refId: e.refId || undefined, balance: bal, by: e.by, at: e.at });
      }
      if (restock > 0) restockLines.push({ variantId: v.id, productId: p.id, qty: restock, unitCost: v.cost });
    });
  });

  const restockTotal = restockLines.reduce((s, l) => s + l.qty * l.unitCost, 0);
  purchases.push({ id: "pur_7", ref: "PUR-0007", supplierId: "sup_tangail", date: restockAt.toISOString(), lines: restockLines, total: restockTotal, paid: restockTotal - 18500, note: "Eid restock" });

  /* ---------------- operating expenses */
  for (let age = 44; age >= 0; age -= 7) {
    expenses.push({ id: id("x_"), category: "ads", amount: int(25, 45) * 100, date: at(age, 11).toISOString(), method: "card", note: "Facebook boost — weekly" });
    expenses.push({ id: id("x_"), category: "packaging", amount: int(8, 14) * 100, date: at(age, 13).toISOString(), method: "cash", note: "Poly mailers, tape" });
  }
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 10);
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 10);
  for (const d of [prevMonth, monthStart]) {
    expenses.push({ id: id("x_"), category: "rent", amount: 15000, date: d.toISOString(), method: "bank", note: "Shop + storeroom rent" });
    expenses.push({ id: id("x_"), category: "salary", amount: 22000, date: d.toISOString(), method: "bkash", note: "Mim, Rakib" });
  }

  /* ---------------- notices */
  const lowVariants = products.flatMap((p) => p.variants.filter((v) => v.onHand - v.reserved <= v.lowStock).map((v) => ({ p, v })));
  const notices: Notice[] = [
    ...lowVariants.slice(0, 3).map(({ p, v }, i) => ({
      id: id("n_"),
      at: new Date(now.getTime() - (i + 1) * 47 * 60_000).toISOString(),
      kind: "low_stock" as const,
      title: `${p.name} ${Object.values(v.options).join(" / ")} is running low`,
      body: `${Math.max(0, v.onHand - v.reserved)} left to sell`,
      href: `/products/${p.id}`,
      read: false,
    })),
    { id: id("n_"), at: new Date(now.getTime() - 26 * 60_000).toISOString(), kind: "new_order", title: "Mim created 3 new orders", body: "From Facebook in the last hour", href: "/orders", read: false },
    { id: id("n_"), at: new Date(now.getTime() - 5 * 3_600_000).toISOString(), kind: "cod_overdue", title: "Pathao payout is 6 days late", body: "Follow up on delivered COD orders", href: "/orders?view=cod", read: true },
    { id: id("n_"), at: new Date(now.getTime() - 26 * 3_600_000).toISOString(), kind: "plan", title: "Business plan renews in 19 days", body: "Pay with bKash or Nagad from Settings", href: "/settings?tab=plan", read: true },
  ];

  /* ---------------- locations, batches, bundle, purchase orders, quotes, recurring */
  const locations: Location[] = [
    { id: "loc_shop", name: "Shop", nameBn: "দোকান", isDefault: true, active: true },
    { id: "loc_wh", name: "Warehouse", nameBn: "গুদাম", isDefault: false, active: true },
    { id: "loc_home", name: "Home store", nameBn: "বাসার স্টক", isDefault: false, active: true },
  ];
  products.forEach((p, pi) =>
    p.variants.forEach((v, vi) => {
      if (v.onHand < 8 || (pi + vi) % 3 === 0) return;
      const wh = Math.floor(v.onHand * 0.4);
      const home = (pi + vi) % 5 === 0 ? Math.min(2, v.onHand - wh) : 0;
      v.stockByLocation = { loc_shop: v.onHand - wh - home, loc_wh: wh, ...(home ? { loc_home: home } : {}) };
    }),
  );
  const mehendi = products.find((p) => p.variants[0]?.sku.startsWith("MHD"));
  if (mehendi) {
    mehendi.trackBatches = true;
    const v = mehendi.variants[0];
    const first = Math.floor(v.onHand * 0.4);
    const iso = (days: number) => new Date(now.getTime() + days * DAY).toISOString().slice(0, 10);
    v.batches = [
      { id: "bt_mhd_a", code: "MH-0925", expiry: iso(12), qty: first },
      { id: "bt_mhd_b", code: "MH-1025", expiry: iso(76), qty: v.onHand - first },
    ].filter((b) => b.qty > 0);
  }
  const vBy = (prefix: string, i = 0) => products.find((p) => p.variants[0]?.sku.startsWith(prefix))?.variants[i];
  const comps = [vBy("ORN"), vBy("JHM"), vBy("JTB")].filter(Boolean) as Variant[];
  if (comps.length === 3) {
    const n = Math.max(0, Math.min(...comps.map((c) => c.onHand - c.reserved)));
    products.push({
      id: "p_combo_eid",
      name: "Eid Gift Combo",
      nameBn: "ঈদ গিফট কম্বো",
      categoryId: "cat_acc",
      unit: "set",
      description: "Silk orna, oxidised jhumka and a jute tote.",
      images: [],
      art: { hue: "#B4531F", pattern: "diamond" },
      optionTypes: [],
      variants: [{ id: "v_combo_eid", sku: "CMB-101", options: {}, price: 1550, cost: comps.reduce((t, c) => t + c.cost, 0), mrp: 1720, onHand: n, reserved: 0, inTransit: 0, damaged: 0, lowStock: 2, active: true }],
      status: "active",
      tags: ["combo"],
      createdAt: at(9, 12).toISOString(),
      bundle: comps.map((c) => ({ variantId: c.id, qty: 1 })),
    });
  }
  const tng = products.find((p) => p.variants[0]?.sku.startsWith("TNG"));
  const krt = products.find((p) => p.variants[0]?.sku.startsWith("KRT"));
  const purchaseOrders: PurchaseOrder[] = [];
  if (tng)
    purchaseOrders.push({
      id: "po_seed_2",
      no: "PO-0002",
      supplierId: "sup_tangail",
      status: "ordered",
      lines: tng.variants.map((v) => ({ variantId: v.id, productId: tng.id, qty: 10, received: 0, unitCost: 1120 })),
      expectedAt: at(-4, 12).toISOString(),
      locationId: "loc_wh",
      note: "Puja collection — confirm colours on WhatsApp",
      createdAt: at(3, 15).toISOString(),
      createdBy: STAFF[1].name,
      history: [
        { at: at(3, 15).toISOString(), by: STAFF[1].name, note: "Created" },
        { at: at(3, 16).toISOString(), by: STAFF[0].name, note: "Sent to supplier" },
      ],
    });
  if (krt)
    purchaseOrders.push({
      id: "po_seed_1",
      no: "PO-0001",
      supplierId: "sup_narsingdi",
      status: "partial",
      lines: krt.variants.slice(0, 4).map((v, i) => ({ variantId: v.id, productId: krt.id, qty: 12, received: i < 2 ? 12 : 0, unitCost: 470 })),
      expectedAt: at(1, 12).toISOString(),
      createdAt: at(15, 11).toISOString(),
      createdBy: STAFF[1].name,
      history: [
        { at: at(15, 11).toISOString(), by: STAFF[1].name, note: "Created" },
        { at: at(15, 12).toISOString(), by: STAFF[1].name, note: "Sent to supplier" },
        { at: at(12, 15).toISOString(), by: STAFF[3].name, note: "Received 24 units" },
      ],
    });
  const wholesale = customers[3];
  const tp = products.find((p) => p.variants[0]?.sku.startsWith("TPC"));
  const quotes: Quote[] =
    tp && wholesale
      ? [
          {
            id: "q_seed_1",
            no: "Q-0001",
            status: "sent",
            customer: { name: wholesale.name, phone: wholesale.phone, address: wholesale.address },
            channel: "whatsapp",
            lines: tp.variants.map((v) => ({ productId: tp.id, variantId: v.id, name: tp.name, variantLabel: Object.values(v.options).join(" / "), qty: 6, price: 1300, discount: 0 })),
            discount: { type: "flat", value: 500 },
            deliveryCharge: 0,
            validUntil: new Date(now.getTime() + 6 * DAY).toISOString().slice(0, 10),
            notes: "Wholesale price for 18 pieces. Delivery free inside Dhaka.",
            createdAt: at(1, 18).toISOString(),
            createdBy: STAFF[0].name,
          },
        ]
      : [];
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const recurring: RecurringExpense[] = [
    { id: "rx_rent", category: "rent", amount: 15000, method: "bank", note: "Shop + storeroom rent", dayOfMonth: 1, lastRun: thisMonth, active: true },
    { id: "rx_salary", category: "salary", amount: 22000, method: "bkash", note: "Mim, Rakib", dayOfMonth: 1, lastRun: thisMonth, active: true },
  ];

  return { products, customers, orders, movements, suppliers, purchases, expenses, notices, nextOrderNo: orderNo, nextInvoiceNo: invoiceNo, locations, purchaseOrders, quotes, recurring };
}

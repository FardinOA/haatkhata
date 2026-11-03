import type { Channel, ExpenseCategory, MovementReason, OrderStatus, PayMethod, Role } from "./types";

/** [English, Bangla] pairs. Pick with `pick(label, lang)` or `useT()`. */
export type Bi = readonly [string, string];

export const STATUS_LABEL: Record<OrderStatus, Bi> = {
  draft: ["Draft", "খসড়া"],
  confirmed: ["Confirmed", "নিশ্চিত"],
  packed: ["Packed", "প্যাক হয়েছে"],
  shipped: ["Shipped", "পাঠানো হয়েছে"],
  delivered: ["Delivered", "ডেলিভারি হয়েছে"],
  returned: ["Returned", "ফেরত এসেছে"],
  partially_returned: ["Part returned", "আংশিক ফেরত"],
  cancelled: ["Cancelled", "বাতিল"],
};

/** Verb form, for buttons that move an order to that status. */
export const STATUS_ACTION: Partial<Record<OrderStatus, Bi>> = {
  confirmed: ["Confirm", "নিশ্চিত করুন"],
  packed: ["Mark packed", "প্যাক করা হয়েছে"],
  shipped: ["Mark shipped", "পাঠানো হয়েছে"],
  delivered: ["Mark delivered", "ডেলিভারি হয়েছে"],
  returned: ["Record return", "ফেরত নিন"],
  cancelled: ["Cancel order", "অর্ডার বাতিল"],
};

export const STATUS_COLOR: Record<OrderStatus, string> = {
  draft: "var(--color-st-draft)",
  confirmed: "var(--color-st-confirmed)",
  packed: "var(--color-st-packed)",
  shipped: "var(--color-st-shipped)",
  delivered: "var(--color-st-delivered)",
  returned: "var(--color-st-returned)",
  partially_returned: "var(--color-st-returned)",
  cancelled: "var(--color-st-cancelled)",
};

export const CHANNEL_LABEL: Record<Channel, Bi> = {
  facebook: ["Facebook", "ফেসবুক"],
  instagram: ["Instagram", "ইনস্টাগ্রাম"],
  whatsapp: ["WhatsApp", "হোয়াটসঅ্যাপ"],
  tiktok: ["TikTok", "টিকটক"],
  website: ["Website", "ওয়েবসাইট"],
  walkin: ["Walk-in", "দোকানে"],
  phone: ["Phone call", "ফোন কল"],
  other: ["Other", "অন্যান্য"],
};

export const CHANNEL_COLOR: Record<Channel, string> = {
  facebook: "#1877F2",
  instagram: "#D62976",
  whatsapp: "#1FA855",
  tiktok: "#0096AD",
  website: "#7058D8",
  walkin: "#C77700",
  phone: "#B4532A",
  other: "#8A9097",
};

export const PAY_LABEL: Record<PayMethod, Bi> = {
  cash: ["Cash", "নগদ"],
  bkash: ["bKash", "বিকাশ"],
  nagad: ["Nagad", "নগদ (মোবাইল)"],
  rocket: ["Rocket", "রকেট"],
  bank: ["Bank", "ব্যাংক"],
  card: ["Card", "কার্ড"],
};

export const PAY_COLOR: Record<PayMethod, string> = {
  cash: "#3E8E5A",
  bkash: "#D81B72",
  nagad: "#EC6A1C",
  rocket: "#8C3FA8",
  bank: "#2F5FAF",
  card: "#3B4250",
};

export const ROLE_LABEL: Record<Role, Bi> = {
  owner: ["Owner", "মালিক"],
  manager: ["Manager", "ম্যানেজার"],
  sales: ["Sales", "সেলস"],
  packer: ["Packer", "প্যাকার"],
  accountant: ["Accountant", "হিসাবরক্ষক"],
};

export const REASON_LABEL: Record<MovementReason, Bi> = {
  opening: ["Opening stock", "শুরুর স্টক"],
  purchase: ["Stock in", "স্টক ইন"],
  sale: ["Sold", "বিক্রি"],
  return: ["Returned", "ফেরত"],
  adjust: ["Adjustment", "সমন্বয়"],
  damage: ["Damaged", "নষ্ট"],
  transfer: ["Transfer", "স্থানান্তর"],
};

export const EXPENSE_LABEL: Record<ExpenseCategory, Bi> = {
  delivery: ["Delivery", "ডেলিভারি"],
  return_fee: ["Return fee", "ফেরত চার্জ"],
  packaging: ["Packaging", "প্যাকেজিং"],
  ads: ["Facebook ads", "বিজ্ঞাপন"],
  rent: ["Rent", "ভাড়া"],
  salary: ["Salary", "বেতন"],
  other: ["Other", "অন্যান্য"],
};

export function pick(b: Bi, lang: "en" | "bn") {
  return lang === "bn" ? b[1] : b[0];
}

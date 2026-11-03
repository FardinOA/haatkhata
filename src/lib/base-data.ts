/** Small, always-loaded basics. The full demo generator (seed.ts) is loaded lazily. */
import type { Category, Staff } from "./types";

export function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
}

export const STAFF: Staff[] = [
  { id: "st_nusrat", name: "Nusrat Jahan", phone: "01711234567", role: "owner", color: "#0E6B53" },
  { id: "st_tanvir", name: "Tanvir Ahmed", phone: "01819876543", role: "manager", color: "#3446C4" },
  { id: "st_mim", name: "Mim Akter", phone: "01911223344", role: "sales", color: "#C2306B" },
  { id: "st_rakib", name: "Rakib Hasan", phone: "01611556677", role: "packer", color: "#E0A100" },
];

export const CATEGORIES: Category[] = [
  { id: "cat_saree", name: "Saree", nameBn: "শাড়ি" },
  { id: "cat_three", name: "Three-piece", nameBn: "থ্রি-পিস" },
  { id: "cat_kurti", name: "Kurti & tops", nameBn: "কুর্তি ও টপস" },
  { id: "cat_panjabi", name: "Panjabi", nameBn: "পাঞ্জাবি" },
  { id: "cat_hijab", name: "Hijab & scarf", nameBn: "হিজাব ও স্কার্ফ" },
  { id: "cat_home", name: "Home & kantha", nameBn: "ঘর ও কাঁথা" },
  { id: "cat_acc", name: "Accessories", nameBn: "এক্সেসরিজ" },
  { id: "cat_kids", name: "Kids", nameBn: "শিশু" },
];

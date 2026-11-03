import { ChartLineUp, ChatCircleDots, FileText, GearSix, House, Package, Tag, UsersThree, Wallet, Warehouse, type Icon } from "@phosphor-icons/react";

export type NavItem = { href: string; en: string; bn: string; icon: Icon; group: "sell" | "stock" | "money" | "system"; key: string };

export const NAV: NavItem[] = [
  { key: "home", href: "/dashboard", en: "Home", bn: "হোম", icon: House, group: "sell" },
  { key: "orders", href: "/orders", en: "Orders", bn: "অর্ডার", icon: Package, group: "sell" },
  { key: "inbox", href: "/inbox", en: "Inbox", bn: "ইনবক্স", icon: ChatCircleDots, group: "sell" },
  { key: "quotes", href: "/quotes", en: "Quotations", bn: "কোটেশন", icon: FileText, group: "sell" },
  { key: "customers", href: "/customers", en: "Customers", bn: "কাস্টমার", icon: UsersThree, group: "sell" },
  { key: "products", href: "/products", en: "Products", bn: "পণ্য", icon: Tag, group: "stock" },
  { key: "inventory", href: "/inventory", en: "Stock", bn: "স্টক", icon: Warehouse, group: "stock" },
  { key: "money", href: "/money", en: "Cash & COD", bn: "টাকা ও COD", icon: Wallet, group: "money" },
  { key: "reports", href: "/reports", en: "Reports", bn: "রিপোর্ট", icon: ChartLineUp, group: "money" },
  { key: "settings", href: "/settings", en: "Settings", bn: "সেটিংস", icon: GearSix, group: "system" },
];

export const NAV_GROUPS: { key: NavItem["group"]; en: string; bn: string }[] = [
  { key: "sell", en: "Sell", bn: "বিক্রি" },
  { key: "stock", en: "Stock", bn: "স্টক" },
  { key: "money", en: "Money", bn: "টাকা" },
];

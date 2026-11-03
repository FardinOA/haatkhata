import type { Metadata } from "next";
import { Landing } from "@/components/marketing/landing";

export const metadata: Metadata = {
  title: { absolute: "BechaKena — স্টক, বিক্রি আর ইনভয়েস এক জায়গায় | POS for Facebook sellers" },
  description:
    "ফেসবুক, ইনস্টাগ্রাম ও হোয়াটসঅ্যাপ বিক্রেতাদের জন্য বাংলা POS — স্টক, ইনভয়েস, কুরিয়ার, COD আর আসল লাভ এক জায়গায়। Stock, invoices, couriers and COD for social sellers in Bangladesh. From ৳299 a month, no setup fee.",
  keywords: ["POS Bangladesh", "f-commerce", "Facebook seller", "inventory", "invoice", "COD", "বাংলা POS", "স্টক হিসাব"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "BechaKena",
    locale: "bn_BD",
    alternateLocale: ["en_US"],
    title: "BechaKena — every order, from the chat to the cash",
    description: "Stock, invoices, couriers and COD for Facebook, Instagram and WhatsApp sellers. Bangla-first, works offline, from ৳299 a month.",
  },
  twitter: { card: "summary_large_image", title: "BechaKena — every order, from the chat to the cash" },
};

export default function Home() {
  return <Landing />;
}

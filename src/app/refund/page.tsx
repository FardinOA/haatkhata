import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Refund Policy", description: "রিফান্ড নীতি — when HaatKhata refunds a payment and how.", alternates: { canonical: "/refund" } };

export default function Page() {
  return <LegalPage slug="refund" />;
}

import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Contact", description: "যোগাযোগ — reach HaatKhata support by email or phone.", alternates: { canonical: "/contact" } };

export default function Page() {
  return <LegalPage slug="contact" />;
}

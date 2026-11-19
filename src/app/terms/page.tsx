import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms of Service", description: "ব্যবহারের শর্তাবলী — the agreement for using HaatKhata.", alternates: { canonical: "/terms" } };

export default function Page() {
  return <LegalPage slug="terms" />;
}

import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacy Policy", description: "গোপনীয়তা নীতি — what HaatKhata collects, why, and who it's shared with.", alternates: { canonical: "/privacy" } };

export default function Page() {
  return <LegalPage slug="privacy" />;
}

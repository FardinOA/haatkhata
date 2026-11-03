import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicInvoiceView } from "@/components/storefront/public-invoice";

export const metadata: Metadata = {
  title: "Your invoice",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PublicInvoicePage({ params, searchParams }: PageProps<"/i/[token]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
      {Promise.all([params, searchParams]).then(([{ token }, sp]) => (
        <PublicInvoiceView token={token} lang={sp.lang === "en" || sp.lang === "bn" ? sp.lang : undefined} />
      ))}
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { PhoneScanner } from "@/components/scan/phone-scanner";

export const metadata: Metadata = {
  title: "Phone scanner",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Opened on a phone from the order screen's QR code — no sign-in, the link is the key. */
export default function PhoneScannerPage({ params, searchParams }: PageProps<"/scan/[token]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
      {Promise.all([params, searchParams]).then(([{ token }, sp]) => (
        <PhoneScanner token={token} lang={sp.lang === "bn" ? "bn" : "en"} />
      ))}
    </Suspense>
  );
}

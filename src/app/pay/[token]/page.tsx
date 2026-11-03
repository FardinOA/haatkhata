import { Suspense } from "react";
import { PayView } from "@/components/couriers/pay-view";

export const metadata = { title: "Pay for your order", robots: { index: false } };

export default function PayPage() {
  // The token is read on the client; everything below streams in.
  return (
    <Suspense>
      <PayView />
    </Suspense>
  );
}

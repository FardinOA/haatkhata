"use client";

import { Suspense } from "react";
import { OrdersScreen } from "@/components/orders/orders-screen";

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersScreen />
    </Suspense>
  );
}

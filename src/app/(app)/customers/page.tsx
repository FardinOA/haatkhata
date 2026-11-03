"use client";

import { Suspense } from "react";
import { CustomersScreen } from "@/components/customers/customers-screen";

export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersScreen />
    </Suspense>
  );
}

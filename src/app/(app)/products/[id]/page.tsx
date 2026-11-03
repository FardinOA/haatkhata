"use client";

import { useParams } from "next/navigation";
import { ProductEditor } from "@/components/products/editor";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  // Keyed so switching between products (e.g. after Duplicate) starts a fresh draft.
  return <ProductEditor key={id} productId={id} />;
}

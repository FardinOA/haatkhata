import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Storefront } from "@/components/storefront/storefront";
import { getCatalogue } from "@/server/public/storefront";

export const metadata: Metadata = {
  title: "Shop",
  description: "Order directly from the shop — pay cash on delivery.",
};

async function Catalogue({ slug }: { slug: string }) {
  const data = await getCatalogue(slug);
  if (!data) notFound();
  return <Storefront data={data} />;
}

export default function StorefrontPage({ params }: PageProps<"/s/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
      {params.then(({ slug }) => (
        <Catalogue slug={slug} />
      ))}
    </Suspense>
  );
}

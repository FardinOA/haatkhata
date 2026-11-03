"use client";

import { ProductThumb } from "../bits";
import { cn } from "../ui/core";
import type { Product } from "@/lib/types";

/**
 * Full-bleed product art for cards and editor previews. Photos cover the
 * frame; generated swatches are cropped square-to-fill (frames must be square
 * or wider than tall), and plain fabrics get
 * a soft fold of light instead of a monogram.
 */
export function CardArt({ product, className, hover = true }: { product: Pick<Product, "art" | "images" | "name">; className?: string; hover?: boolean }) {
  const zoom = hover ? "transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.04]" : "";
  return (
    <div className={cn("overflow-hidden bg-sunken", className ?? "relative")}>
      {product.images[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.images[0]} alt="" className={cn("absolute inset-0 size-full object-cover", zoom)} />
      ) : product.art.pattern === "plain" ? (
        <div
          className={cn("absolute inset-0", zoom)}
          style={{
            background: `linear-gradient(115deg, color-mix(in oklab, ${product.art.hue} 88%, white) 0%, ${product.art.hue} 38%, color-mix(in oklab, ${product.art.hue} 78%, black) 62%, color-mix(in oklab, ${product.art.hue} 92%, white) 100%)`,
          }}
        />
      ) : (
        <div className={cn("absolute left-1/2 top-1/2 aspect-square w-full -translate-x-1/2 -translate-y-1/2", zoom)}>
          <ProductThumb product={product} size={160} rounded="sm" className="!h-full !w-full !rounded-none" />
        </div>
      )}
    </div>
  );
}

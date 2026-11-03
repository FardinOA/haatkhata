"use client";

import { useMemo } from "react";
import { barcodeFor } from "@/lib/barcode";

/** Crisp, scannable barcode as SVG (EAN-13 when valid, otherwise Code 128). */
export function Barcode({ value, height = 40, showText = true, className }: { value: string; height?: number; showText?: boolean; className?: string }) {
  const code = useMemo(() => {
    try {
      return barcodeFor(value);
    } catch {
      return null;
    }
  }, [value]);
  if (!code) return <span className="text-[10px] text-danger">Can&apos;t encode {value}</span>;
  const quiet = 10;
  const total = code.widths.reduce((a, b) => a + b, 0) + quiet * 2;
  let x = quiet;
  const bars: { x: number; w: number }[] = [];
  code.widths.forEach((w, i) => {
    if (i % 2 === 0) bars.push({ x, w });
    x += w;
  });
  return (
    <svg viewBox={`0 0 ${total} ${height + (showText ? 12 : 0)}`} className={className} role="img" aria-label={`Barcode ${value}`} preserveAspectRatio="none" shapeRendering="crispEdges">
      <rect width={total} height={height + (showText ? 12 : 0)} fill="#fff" />
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="#000" />
      ))}
      {showText && (
        <text x={total / 2} y={height + 10} textAnchor="middle" fontSize="10" fontFamily="ui-monospace, monospace" fill="#000" letterSpacing="1">
          {code.text}
        </text>
      )}
    </svg>
  );
}

"use client";

import { useId } from "react";
import { cn } from "@/components/ui/core";
import type { PaperSpec } from "@/lib/print";

/** How long a till roll is drawn, in mm. Both rolls share it so only the width differs. */
export const ROLL_MM = 200;

const INK = "var(--ink-2)";
const FAINT = "var(--ink-4)";

/**
 * A to-scale miniature of a sheet of paper with a sketch of what prints on it.
 * Everything on one shelf shares `scale` (px per mm), so a 58 mm roll really
 * does look small next to an A4 page.
 */
export function PaperGlyph({ spec, scale, fit, active, className }: { spec: PaperSpec; scale?: number; fit?: number; active?: boolean; className?: string }) {
  const mmH = spec.h ?? ROLL_MM;
  const k = fit ? fit / Math.max(spec.w, mmH) : (scale ?? 0.3);
  const W = Math.round(spec.w * k);
  const H = Math.round(mmH * k);
  const tiny = Math.max(W, H) < 30;
  const accent = active ? "var(--brand)" : "var(--ink-4)";
  const body =
    spec.group === "roll" ? (
      <Roll W={W} H={H} accent={accent} tiny={tiny} />
    ) : spec.id === "a4duo" ? (
      <>
        <Sheet x={0} W={W / 2} H={H} accent={accent} tiny={tiny} />
        <Sheet x={W / 2} W={W / 2} H={H} accent={accent} tiny={tiny} />
        <line x1={W / 2} x2={W / 2} y1={2} y2={H - 2} stroke={INK} strokeDasharray="2 2" strokeWidth={1} />
      </>
    ) : spec.id === "a4sheet" ? (
      <LabelSheet W={W} H={H} accent={accent} />
    ) : spec.group === "label" ? (
      <Label W={W} H={H} accent={accent} tall={mmH > spec.w} tiny={tiny} />
    ) : (
      <Sheet x={0} W={W} H={H} accent={accent} tiny={tiny} vat={spec.id === "mushak"} />
    );

  const roll = spec.group === "roll";
  const fid = `pg${useId().replace(/:/g, "")}`;
  const outline = roll ? tornPath(W, H) : roundRect(W, H, spec.group === "label" ? Math.min(3, W * 0.06) : 1.5);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={cn("block shrink-0 overflow-visible", className)} aria-hidden>
      <defs>
        <filter id={fid} x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor="#16181a" floodOpacity="0.14" />
        </filter>
        {/* Sketch lines never spill past the paper on tiny glyphs. */}
        <clipPath id={`${fid}c`}>
          <path d={outline} />
        </clipPath>
      </defs>
      <path d={outline} fill="#fff" stroke={active ? "var(--brand)" : "var(--line-strong)"} strokeWidth={1} filter={`url(#${fid})`} />
      <g clipPath={`url(#${fid}c)`}>{body}</g>
    </svg>
  );
}

function roundRect(W: number, H: number, r: number) {
  return `M${r},0.5 H${W - r} Q${W - 0.5},0.5 ${W - 0.5},${r} V${H - r} Q${W - 0.5},${H - 0.5} ${W - r},${H - 0.5} H${r} Q0.5,${H - 0.5} 0.5,${H - r} V${r} Q0.5,0.5 ${r},0.5 Z`;
}

/** Straight top, saw-tooth bottom: a till receipt just torn off. */
function tornPath(W: number, H: number) {
  const teeth = Math.max(3, Math.round(W / 5));
  const step = (W - 1) / teeth;
  let d = `M0.5,0.5 H${W - 0.5} V${H - 3}`;
  for (let i = teeth; i > 0; i--) d += ` L${0.5 + (i - 0.5) * step},${H - 0.5} L${0.5 + (i - 1) * step},${H - 3}`;
  return `${d} Z`;
}

const bar = (x: number, y: number, w: number, h: number, fill: string, key?: string | number) => <rect key={key} x={x} y={y} width={Math.max(0, w)} height={h} rx={h / 2} fill={fill} />;

function Roll({ W, H, accent, tiny }: { W: number; H: number; accent: string; tiny: boolean }) {
  const p = Math.max(2.5, W * 0.12);
  const cx = W / 2;
  const logo = Math.max(3, W * 0.2);
  const rows = tiny ? 3 : 5;
  const top = p + logo + 7;
  const gap = Math.max(3.2, (H * 0.5) / (rows + 2));
  return (
    <g>
      <rect x={cx - logo / 2} y={p} width={logo} height={logo} rx={1} fill={accent} />
      {bar(cx - W * 0.25, p + logo + 2.5, W * 0.5, 1.6, INK)}
      <line x1={p} x2={W - p} y1={top} y2={top} stroke={FAINT} strokeDasharray="1.5 1.5" strokeWidth={1} />
      {Array.from({ length: rows }, (_, i) => (
        <g key={i}>
          {bar(p, top + 4 + i * gap, (W - 2 * p) * (i % 2 ? 0.42 : 0.55), 1.3, FAINT)}
          {bar(W - p - (W - 2 * p) * 0.2, top + 4 + i * gap, (W - 2 * p) * 0.2, 1.3, FAINT)}
        </g>
      ))}
      {bar(p, top + 6 + rows * gap, W - 2 * p, 2.2, INK)}
      {!tiny && <rect x={cx - W * 0.16} y={top + 12 + rows * gap} width={W * 0.32} height={W * 0.32} rx={1} fill="none" stroke={FAINT} strokeWidth={1} />}
    </g>
  );
}

function Sheet({ x, W, H, accent, tiny, vat }: { x: number; W: number; H: number; accent: string; tiny: boolean; vat?: boolean }) {
  const p = Math.max(3, W * 0.1);
  const logo = Math.max(3, W * 0.1);
  const iw = W - 2 * p;
  const rows = tiny ? 3 : Math.min(6, Math.floor(H / 14));
  const head = p + logo + 4;
  const tableTop = head + Math.max(5, H * 0.12);
  const gap = Math.max(3.4, H * 0.045);
  return (
    <g transform={`translate(${x} 0)`}>
      <rect x={p} y={p} width={logo} height={logo} rx={1} fill={accent} />
      {bar(p + logo + 2, p + logo * 0.25, iw * 0.3, 1.6, INK)}
      {bar(W - p - iw * 0.22, p, iw * 0.22, 2, accent)}
      {bar(W - p - iw * 0.16, p + 4, iw * 0.16, 1.3, FAINT)}
      <rect x={p} y={head} width={iw} height={vat ? 1.6 : 1} fill={accent} />
      {bar(p, head + 4, iw * 0.34, 1.3, FAINT)}
      {bar(p, head + 7.5, iw * 0.26, 1.3, FAINT)}
      {Array.from({ length: rows }, (_, i) => (
        <g key={i}>
          {bar(p, tableTop + i * gap, iw * (i % 2 ? 0.38 : 0.5), 1.3, FAINT)}
          {bar(W - p - iw * 0.14, tableTop + i * gap, iw * 0.14, 1.3, FAINT)}
        </g>
      ))}
      {bar(W - p - iw * 0.32, tableTop + rows * gap + 3, iw * 0.32, 2.2, INK)}
      {!tiny && bar(p, H - p - 1.3, iw, 1.3, FAINT)}
    </g>
  );
}

function Label({ W, H, accent, tall, tiny }: { W: number; H: number; accent: string; tall: boolean; tiny: boolean }) {
  const p = Math.max(2.5, W * 0.08);
  const iw = W - 2 * p;
  const qr = tiny ? 0 : Math.min(iw * 0.28, H * 0.32);
  const codH = Math.max(4, H * (tall ? 0.12 : 0.22));
  return (
    <g>
      {bar(p, p, iw * 0.4, 1.6, accent)}
      <line x1={p} x2={W - p} y1={p + 4} y2={p + 4} stroke={INK} strokeWidth={1} />
      {bar(p, p + 8, iw * 0.5, 2.2, INK)}
      {bar(p, p + 12.5, (iw - qr) * 0.8, 1.3, FAINT)}
      {bar(p, p + 15.5, (iw - qr) * 0.65, 1.3, FAINT)}
      {qr > 0 && <rect x={W - p - qr} y={p + 7} width={qr} height={qr} rx={0.8} fill="none" stroke={INK} strokeWidth={1} />}
      {tall && (
        <g>
          {Array.from({ length: 4 }, (_, i) => bar(p, H * 0.42 + i * 4, iw * (i % 2 ? 0.5 : 0.65), 1.3, FAINT, i))}
          {Array.from({ length: 14 }, (_, i) => (
            <rect key={i} x={p + i * (iw / 14)} y={H - p - codH - 9} width={i % 3 ? 1 : 1.8} height={6} fill={INK} />
          ))}
        </g>
      )}
      <rect x={p} y={H - p - codH} width={iw * 0.6} height={codH} rx={1} fill="none" stroke={INK} strokeWidth={1.4} />
    </g>
  );
}

function LabelSheet({ W, H, accent }: { W: number; H: number; accent: string }) {
  const cw = W / 2;
  const ch = H / 4;
  return (
    <g>
      {Array.from({ length: 8 }, (_, i) => {
        const x = (i % 2) * cw;
        const y = Math.floor(i / 2) * ch;
        return (
          <g key={i}>
            <rect x={x + 2.5} y={y + 2.5} width={cw - 5} height={ch - 5} rx={1.5} fill="none" stroke={FAINT} strokeWidth={1} strokeDasharray="1.5 1.5" />
            {bar(x + 5, y + 5, cw * 0.35, 1.5, accent)}
            {bar(x + 5, y + 9, cw * 0.5, 1.3, FAINT)}
            <rect x={x + 5} y={y + ch - 10} width={cw * 0.4} height={5} rx={0.8} fill="none" stroke={INK} strokeWidth={1} />
          </g>
        );
      })}
    </g>
  );
}

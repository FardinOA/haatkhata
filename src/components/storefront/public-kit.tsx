/**
 * Small, dependency-light pieces shared by public pages (customer invoice,
 * catalogue). Deliberately free of the app store so these pages stay fast.
 */
import { themeVars } from "@/lib/theme";
import type { PatternId } from "@/lib/types";

/** Seller's brand colours, scoped to one subtree. */
export function brandStyle(accent: string): React.CSSProperties {
  return themeVars(accent) as React.CSSProperties;
}

export function SellerMark({ name, logo, shape = "rounded", size = 44 }: { name: string; logo?: string | null; shape?: string; size?: number }) {
  const radius = shape === "circle" ? "9999px" : shape === "square" ? `${size * 0.14}px` : `${size * 0.28}px`;
  if (logo)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt={name} width={size} height={size} className="shrink-0 bg-white object-contain" style={{ width: size, height: size, borderRadius: radius }} />;
  const letters = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span className="grid shrink-0 place-items-center bg-brand font-display font-semibold text-brand-contrast" style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.4 }} aria-label={name}>
      {letters}
    </span>
  );
}

/** Textile swatch for products without photos (same motifs as the app). */
export function Swatch({ hue, pattern, label, className, tile = 40 }: { hue: string; pattern: PatternId | string; label: string; className?: string; /** Larger = finer pattern on big surfaces. */ tile?: number }) {
  const id = `sw${hue.replace("#", "")}${pattern}`;
  const light = `color-mix(in oklab, ${hue} 22%, white)`;
  const mid = `color-mix(in oklab, ${hue} 60%, white)`;
  const rotate = pattern === "stripe" || pattern === "weave" ? 0 : 45;
  return (
    <svg viewBox={`0 0 ${tile} ${tile}`} preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={label}>
      <defs>
        <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform={`rotate(${rotate})`}>
          <rect width="10" height="10" fill={pattern === "dots" || pattern === "diamond" || pattern === "plain" ? hue : light} />
          {pattern === "stripe" && (
            <>
              <rect width="10" height="3" fill={hue} />
              <rect y="5" width="10" height="1" fill={mid} />
            </>
          )}
          {pattern === "check" && (
            <>
              <rect width="5" height="10" fill={mid} opacity="0.7" />
              <rect width="10" height="5" fill={mid} opacity="0.7" />
            </>
          )}
          {pattern === "dots" && <circle cx="5" cy="5" r="1.7" fill={light} />}
          {pattern === "wave" && <path d="M0 5 Q2.5 2 5 5 T10 5" stroke={hue} strokeWidth="1.4" fill="none" />}
          {pattern === "diamond" && <rect x="3" y="3" width="4" height="4" fill={light} />}
          {pattern === "paisley" && <path d="M5 2c2 0 3 1.6 2.2 3.2C6.4 6.8 4 7 3.4 8.6 3 6.4 2.6 2 5 2z" fill={hue} />}
          {pattern === "weave" && (
            <>
              <rect width="10" height="10" fill={mid} />
              <rect width="5" height="2" fill={light} />
              <rect x="5" y="5" width="5" height="2" fill={light} />
            </>
          )}
        </pattern>
      </defs>
      <rect width={tile} height={tile} fill={`url(#${id})`} />
      {pattern === "plain" && label && (
        <text x={tile / 2} y={tile / 2} dy="0.35em" textAnchor="middle" fontSize={tile * 0.32} fontWeight="600" fill="#fff" opacity="0.92">
          {label.slice(0, 1)}
        </text>
      )}
    </svg>
  );
}

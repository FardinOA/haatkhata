"use client";

import { WIDGETS } from "./widgets";
import { cn } from "../ui/core";
import type { Range } from "@/lib/analytics";
import { useStore } from "@/lib/store";
import type { WidgetInstance, WidgetSize } from "@/lib/types";

export const SPAN: Record<WidgetSize, string> = {
  s: "col-span-12 sm:col-span-6 xl:col-span-4",
  m: "col-span-12 lg:col-span-6",
  l: "col-span-12 xl:col-span-8",
  xl: "col-span-12",
};

export function WidgetBody({ w, range }: { w: WidgetInstance; range: Range }) {
  const def = WIDGETS[w.type];
  if (!def) return null;
  const C = def.component;
  return <C size={w.size} range={range} />;
}

/** The everyday, read-only grid. Drag-and-drop code loads only when customising. */
export function StaticGrid({ range: rangeProp }: { range?: Range }) {
  const layout = useStore((s) => s.dashboard.layout);
  const storeRange = useStore((s) => s.dashboard.range);
  const range = rangeProp ?? storeRange;
  return (
    <div className="grid grid-cols-12 gap-[var(--gap)]">
      {layout.map((w) => (
        <div key={w.id} className={cn("relative min-w-0", SPAN[w.size])}>
          <div className="h-full">
            <WidgetBody w={w} range={range} />
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical, X } from "@phosphor-icons/react";
import { useState } from "react";
import { SPAN, WidgetBody } from "./static-grid";
import { WIDGETS } from "./widgets";
import { cn } from "../ui/core";
import type { Range } from "@/lib/analytics";
import { useT } from "@/lib/hooks";
import { useStore, WIDGET_SIZES } from "@/lib/store";
import type { WidgetInstance, WidgetSize } from "@/lib/types";


const SIZE_LABEL: Record<WidgetSize, [string, string]> = { s: ["S", "ছোট"], m: ["M", "মাঝারি"], l: ["L", "বড়"], xl: ["Full", "পুরো"] };

export function DashboardGrid({ editing = true, range }: { editing?: boolean; range: Range }) {
  const layout = useStore((s) => s.dashboard.layout);
  const setLayout = useStore((s) => s.setLayout);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over || e.active.id === e.over.id) return;
    const from = layout.findIndex((w) => w.id === e.active.id);
    const to = layout.findIndex((w) => w.id === e.over!.id);
    setLayout(arrayMove(layout, from, to));
  };
  const active = layout.find((w) => w.id === activeId);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <SortableContext items={layout.map((w) => w.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-12 gap-[var(--gap)]">
          {layout.map((w) => (
            <SortableWidget key={w.id} w={w} editing={editing} range={range} />
          ))}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
        {active ? (
          <div className="pointer-events-none rotate-[0.6deg] scale-[1.01] opacity-95 shadow-3">
            <WidgetBody w={active} range={range} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}


function SortableWidget({ w, editing, range }: { w: WidgetInstance; editing: boolean; range: Range }) {
  const t = useT();
  const resize = useStore((s) => s.resizeWidget);
  const remove = useStore((s) => s.removeWidget);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: w.id, disabled: !editing });
  const def = WIDGETS[w.type];
  const sizes = WIDGET_SIZES[w.type];
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative min-w-0", SPAN[w.size], editing && "pt-6", isDragging && "z-10 opacity-30")}
    >
      <div className={cn("h-full", editing && "pointer-events-none select-none rounded-lg opacity-90 [&>*]:outline [&>*]:outline-2 [&>*]:outline-offset-2 [&>*]:outline-dashed [&>*]:outline-brand-300")} aria-hidden={editing || undefined}>
        <WidgetBody w={w} range={range} />
      </div>
      {editing && (
        <div className="absolute left-2 right-2 top-0 z-20 flex items-center justify-between gap-2">
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={t(`Move ${def.en}`, `${def.bn} সরান`)}
            className="inline-flex h-8 cursor-grab touch-none items-center gap-1.5 rounded-full border border-line bg-surface pl-1.5 pr-3 text-xs font-semibold text-ink shadow-2 active:cursor-grabbing"
          >
            <DotsSixVertical className="size-4 text-ink-3" weight="bold" />
            {t(def.en, def.bn)}
          </button>
          <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-0.5 shadow-2">
            {sizes.length > 1 &&
              sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => resize(w.id, s)}
                  aria-pressed={w.size === s}
                  aria-label={t(`Size ${SIZE_LABEL[s][0]}`, `আকার ${SIZE_LABEL[s][1]}`)}
                  className={cn("h-7 min-w-7 rounded-full px-2 text-[11px] font-semibold transition-colors", w.size === s ? "bg-brand text-brand-contrast" : "text-ink-3 hover:bg-sunken hover:text-ink")}
                >
                  {t(SIZE_LABEL[s][0], SIZE_LABEL[s][1])}
                </button>
              ))}
            <button type="button" onClick={() => remove(w.id)} aria-label={t(`Remove ${def.en}`, `${def.bn} সরিয়ে ফেলুন`)} className="grid size-7 place-items-center rounded-full text-ink-3 hover:bg-danger-soft hover:text-danger">
              <X className="size-3.5" weight="bold" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

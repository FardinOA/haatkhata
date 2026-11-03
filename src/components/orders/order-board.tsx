"use client";

import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { Prohibit } from "@phosphor-icons/react";
import { useState } from "react";
import { ChannelIcon, StatusGlyph } from "../bits";
import { cn } from "../ui/core";
import { useToast } from "../ui/overlays";
import { ShipDialog } from "./dialogs";
import { ItemStack } from "./order-list";
import { PayChip } from "./util";
import { canTransition, orderTotals } from "@/lib/domain";
import { useFmt, useNow, useT } from "@/lib/hooks";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/labels";
import { useMe, useStore } from "@/lib/store";
import type { Order, OrderStatus, Product } from "@/lib/types";

const COLUMNS: OrderStatus[] = ["draft", "confirmed", "packed", "shipped", "delivered"];
const CARD_LIMIT = 25;

export function OrderBoard({ orders, products, onOpen }: { orders: Order[]; products: Map<string, Product>; onOpen: (id: string) => void }) {
  const t = useT();
  const f = useFmt();
  const me = useMe();
  const toast = useToast();
  const transition = useStore((s) => s.transition);
  const [dragging, setDragging] = useState<Order | null>(null);
  const [pendingShip, setPendingShip] = useState<Order | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const onStart = (e: DragStartEvent) => setDragging((e.active.data.current?.order as Order) ?? null);
  const onEnd = (e: DragEndEvent) => {
    const o = e.active.data.current?.order as Order | undefined;
    setDragging(null);
    const to = e.over?.id as OrderStatus | undefined;
    if (!o || !to || to === o.status) return;
    if (!canTransition(o.status, to, me.role)) {
      toast({ title: t(`Can't move #${o.no} to ${STATUS_LABEL[to][0]}`, `#${o.no} ${STATUS_LABEL[to][1]}-এ নেওয়া যাবে না`), body: t("Orders move one step at a time, and some steps need a manager.", "অর্ডার ধাপে ধাপে এগোয়, কিছু ধাপে ম্যানেজার লাগে।"), tone: "warn" });
      return;
    }
    if (to === "shipped") return setPendingShip(o);
    if (transition(o.id, to)) toast({ title: t(`#${o.no} → ${STATUS_LABEL[to][0]}`, `#${o.no} → ${STATUS_LABEL[to][1]}`) });
  };

  return (
    <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setDragging(null)}>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:snap-none md:grid-cols-5 md:overflow-visible md:px-0">
        {COLUMNS.map((s) => {
          const list = orders.filter((o) => o.status === s);
          const legal = dragging ? dragging.status === s || canTransition(dragging.status, s, me.role) : true;
          return (
            <Column key={s} status={s} legal={legal} dragging={!!dragging} isSource={dragging?.status === s} count={list.length} value={list.reduce((a, o) => a + orderTotals(o).total, 0)}>
              {list.slice(0, CARD_LIMIT).map((o) => (
                <Card key={o.id} order={o} products={products} onOpen={onOpen} />
              ))}
              {list.length > CARD_LIMIT && (
                <p className="py-2 text-center text-xs text-ink-4">{t(`+${list.length - CARD_LIMIT} more — use the list view`, `+${f.num(list.length - CARD_LIMIT)}টি আরও — লিস্ট ভিউ দেখুন`)}</p>
              )}
              {list.length === 0 && <p className="rounded-md border border-dashed border-line-strong/70 py-8 text-center text-xs text-ink-4">{t("No orders here", "এখানে কোনো অর্ডার নেই")}</p>}
            </Column>
          );
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22,1,0.36,1)" }}>
        {dragging ? <CardFace order={dragging} products={products} lifted /> : null}
      </DragOverlay>
      {pendingShip && (
        <ShipDialog
          open
          onClose={() => setPendingShip(null)}
          onConfirm={(c) => {
            if (transition(pendingShip.id, "shipped", { courier: c })) toast({ title: t(`#${pendingShip.no} handed to ${c.name}`, `#${pendingShip.no} ${c.name}-এ দেওয়া হয়েছে`) });
            setPendingShip(null);
          }}
        />
      )}
    </DndContext>
  );
}

function Column({ status, legal, dragging, isSource, count, value, children }: { status: OrderStatus; legal: boolean; dragging: boolean; isSource: boolean; count: number; value: number; children: React.ReactNode }) {
  const t = useT();
  const f = useFmt();
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !legal });
  const color = STATUS_COLOR[status];
  return (
    <section
      ref={setNodeRef}
      aria-label={t.pick(STATUS_LABEL[status])}
      className={cn(
        "flex w-[82vw] max-w-[320px] shrink-0 snap-start flex-col rounded-lg border bg-surface-2 transition-[opacity,border-color,background-color] duration-150 md:w-auto md:max-w-none",
        dragging && !legal ? "border-line opacity-45" : dragging && !isSource ? "border-dashed" : "border-line",
        isOver && legal && "bg-[color-mix(in_oklab,var(--c)_7%,white)]",
      )}
      style={{ "--c": color, borderColor: dragging && legal && !isSource ? color : undefined } as React.CSSProperties}
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span style={{ color }} className="flex">
          <StatusGlyph status={status} />
        </span>
        <h3 className="flex-1 truncate text-[13px] font-semibold text-ink">{t.pick(STATUS_LABEL[status])}</h3>
        {dragging && !legal ? (
          <Prohibit className="size-4 text-ink-4" />
        ) : (
          <span className="tnum rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink-2 shadow-1">{f.num(count)}</span>
        )}
      </header>
      <p className="tnum px-3 pb-2 text-xs text-ink-3">{f.money(value)}</p>
      <div className="scroll-thin flex max-h-[calc(100dvh-340px)] min-h-[160px] flex-col gap-2 overflow-y-auto px-2 pb-2">{children}</div>
    </section>
  );
}

function Card({ order, products, onOpen }: { order: Order; products: Map<string, Product>; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id, data: { order } });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(order.id)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter") onOpen(order.id);
      }}
      data-testid="board-card"
      className={cn("touch-manipulation outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-md", isDragging && "opacity-30")}
    >
      <CardFace order={order} products={products} />
    </div>
  );
}

function CardFace({ order, products, lifted }: { order: Order; products: Map<string, Product>; lifted?: boolean }) {
  const t = useT();
  const f = useFmt();
  const now = useNow();
  return (
    <div className={cn("cursor-grab rounded-md border border-line bg-surface p-3 shadow-1 transition-shadow hover:shadow-2", lifted && "rotate-[1.5deg] cursor-grabbing shadow-3")}>
      <div className="flex items-center justify-between gap-2">
        <span className="tnum flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <ChannelIcon channel={order.channel} className="size-3.5" />#{f.digits(String(order.no))}
        </span>
        <span className="text-[11px] text-ink-4">{f.relative(order.createdAt, now)}</span>
      </div>
      <p className="mt-1 truncate text-[13.5px] font-medium text-ink-2">{order.customer?.name ?? t("Walk-in customer", "দোকানের কাস্টমার")}</p>
      <div className="mt-2.5">
        <ItemStack order={order} products={products} size={24} />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line/70 pt-2.5">
        <PayChip order={order} className="h-5 px-1.5 text-[11px]" />
        <span className="tnum text-[13px] font-semibold text-ink">{f.money(orderTotals(order).total)}</span>
      </div>
    </div>
  );
}

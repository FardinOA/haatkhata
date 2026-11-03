"use client";

import { ArrowsClockwise, ArrowUUpLeft, ChatText, Copy, CopySimple, DotsThree, HandCoins, LinkBreak, LinkSimple, Phone, PencilSimple, Plus, Printer, Sticker, Trash, Truck, Wallet, XCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChannelTag, PayTag, ProductThumb, RiskLabel, RiskRing, StatusPill } from "../bits";
import { Avatar, Button, cn, IconButton, Input } from "../ui/core";
import { Menu, Sheet, useConfirm, useToast } from "../ui/overlays";
import { CodDialog, PaymentDialog, ReturnDialog, ShipDialog } from "./dialogs";
import { ExchangeDialog, OrderDocLinks } from "./exchange-dialog";
import { NetworkRisk } from "../couriers/network-risk";
import { usePrint } from "../invoice/print-dialog";
import { CourierActions, CourierTracking } from "../couriers/order-extras";
import { payState } from "./util";
import { createCustomerLink, revokeCustomerLink } from "../storefront/public-link";
import { canTransition, customerStats, formatPhone, orderProfit, orderTotals, riskLevel, TRANSITIONS } from "@/lib/domain";
import { useCan, useFmt, useNow, useT } from "@/lib/hooks";
import { STATUS_ACTION, STATUS_COLOR, STATUS_LABEL } from "@/lib/labels";
import { useMe, useStore } from "@/lib/store";
import type { Order, OrderEvent, OrderStatus } from "@/lib/types";

type DialogKind = "ship" | "pay" | "return" | "cod" | "courier" | "exchange" | null;

export function OrderSheet({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const order = useStore((s) => (orderId ? s.orders.find((o) => o.id === orderId) : undefined));
  const t = useT();
  const f = useFmt();
  return (
    <Sheet
      open={!!order}
      onClose={onClose}
      width={580}
      title={
        order ? (
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="tnum">#{f.digits(String(order.no))}</span>
            <StatusPill status={order.status} />
          </span>
        ) : (
          ""
        )
      }
      sub={order ? <SheetSub order={order} /> : null}
      headerExtra={order ? <MoreMenu order={order} onClose={onClose} /> : null}
    >
      {order ? <OrderBody key={order.id} order={order} /> : <p className="p-6 text-sm text-ink-3">{t("Order not found.", "অর্ডার পাওয়া যায়নি।")}</p>}
    </Sheet>
  );
}

function SheetSub({ order }: { order: Order }) {
  const t = useT();
  const f = useFmt();
  const now = useNow();
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <ChannelTag channel={order.channel} />
      <span className="text-ink-4">·</span>
      <span title={`${f.date(order.createdAt)} ${f.time(order.createdAt)}`}>{f.relative(order.createdAt, now)}</span>
      <span className="text-ink-4">·</span>
      <span>
        {t("by", "নিয়েছেন")} {order.createdBy}
      </span>
      {order.invoiceNo && (
        <>
          <span className="text-ink-4">·</span>
          <span className="tnum">{order.invoiceNo}</span>
        </>
      )}
    </span>
  );
}

function MoreMenu({ order, onClose }: { order: Order; onClose: () => void }) {
  const t = useT();
  const can = useCan();
  const me = useMe();
  const toast = useToast();
  const transition = useStore((s) => s.transition);
  const deleteDraft = useStore((s) => s.deleteDraft);
  const printing = usePrint();
  const router = useRouter();
  const [ask, confirmNode] = useConfirm();
  const canCancel = canTransition(order.status, "cancelled", me.role);
  const accountMode = useStore((s) => s.sync.mode === "account");
  return (
    <>
      <Menu
        width={230}
        items={[
          {
            label: t("Print invoice…", "ইনভয়েস প্রিন্ট…"),
            icon: <Printer />,
            onSelect: () => printing.choose([order.id], "invoice", { labels: !!order.customer }),
          },
          {
            label: t("Print delivery label…", "ডেলিভারি লেবেল প্রিন্ট…"),
            icon: <Sticker />,
            disabled: !order.customer,
            onSelect: () => printing.choose([order.id], "label"),
          },
          {
            label: t("Duplicate as new order", "নতুন অর্ডার হিসেবে কপি"),
            icon: <CopySimple />,
            onSelect: () => router.push(`/pos?duplicate=${order.id}`),
          },
          // Customer link (FR-INV-04): read-only invoice + delivery status, revocable.
          ...(accountMode
            ? [
                {
                  label: t("Copy customer link", "কাস্টমার লিংক কপি"),
                  icon: <LinkSimple />,
                  onSelect: async () => {
                    try {
                      await navigator.clipboard?.writeText(await createCustomerLink(order.id));
                      toast({ title: t("Customer link copied", "কাস্টমার লিংক কপি হয়েছে"), body: t("They see the invoice and delivery status — never your costs.", "তারা ইনভয়েস ও ডেলিভারির অবস্থা দেখবেন — আপনার খরচ নয়।") });
                    } catch (e) {
                      toast({ tone: "warn", title: (e as Error).message });
                    }
                  },
                },
                {
                  label: t("Turn off customer link", "কাস্টমার লিংক বন্ধ"),
                  icon: <LinkBreak />,
                  onSelect: async () => {
                    try {
                      await revokeCustomerLink(order.id);
                      toast({ tone: "info", title: t("The old link no longer works", "পুরোনো লিংক আর কাজ করবে না") });
                    } catch (e) {
                      toast({ tone: "warn", title: (e as Error).message });
                    }
                  },
                },
              ]
            : []),
          ...(canCancel || (order.status === "draft" && can("delete_order")) ? [{ type: "divider" as const }] : []),
          ...(canCancel
            ? [
                {
                  label: t("Cancel order", "অর্ডার বাতিল"),
                  icon: <XCircle />,
                  danger: true,
                  onSelect: async () => {
                    const ok = await ask({
                      title: t(`Cancel order #${order.no}?`, `অর্ডার #${order.no} বাতিল করবেন?`),
                      body: t("Held stock is released. The invoice number stays, marked VOID.", "রিজার্ভ স্টক ছেড়ে দেওয়া হবে। ইনভয়েস নম্বর VOID হিসেবে থাকবে।"),
                      confirm: t("Cancel order", "অর্ডার বাতিল"),
                      cancel: t("Keep it", "রেখে দিন"),
                      danger: true,
                    });
                    if (ok && transition(order.id, "cancelled"))
                      toast({
                        title: t(`Order #${order.no} cancelled`, `অর্ডার #${order.no} বাতিল হয়েছে`),
                        tone: "info",
                      });
                  },
                },
              ]
            : []),
          ...(order.status === "draft" && can("delete_order")
            ? [
                {
                  label: t("Delete draft", "খসড়া মুছুন"),
                  icon: <Trash />,
                  danger: true,
                  onSelect: async () => {
                    const ok = await ask({
                      title: t("Delete this draft?", "খসড়াটি মুছবেন?"),
                      body: t("Drafts never touched stock, so nothing else changes.", "খসড়া স্টকে প্রভাব ফেলে না, তাই আর কিছু বদলাবে না।"),
                      confirm: t("Delete", "মুছুন"),
                      danger: true,
                    });
                    if (ok) {
                      deleteDraft(order.id);
                      onClose();
                      toast({
                        title: t("Draft deleted", "খসড়া মোছা হয়েছে"),
                        tone: "info",
                      });
                    }
                  },
                },
              ]
            : []),
        ]}
        trigger={({ toggle, ref }) => (
          <IconButton ref={ref} label={t("More actions", "আরও")} size="sm" onClick={toggle}>
            <DotsThree className="size-5" weight="bold" />
          </IconButton>
        )}
      />
      {confirmNode}
      {printing.node}
    </>
  );
}

/* ------------------------------------------------------------ body */

function OrderBody({ order }: { order: Order }) {
  const t = useT();
  const f = useFmt();
  const can = useCan();
  const me = useMe();
  const toast = useToast();
  const products = useStore((s) => s.products);
  const orders = useStore((s) => s.orders);
  const customer = useStore((s) => (order.customerId ? s.customers.find((c) => c.id === order.customerId) : undefined));
  const transition = useStore((s) => s.transition);
  const recordReturn = useStore((s) => s.recordReturn);
  const addPayment = useStore((s) => s.addPayment);
  const markCod = useStore((s) => s.markCodReceived);
  const setCourier = useStore((s) => s.setCourier);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const totals = orderTotals(order);
  const pstate = payState(order);
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const next = TRANSITIONS[order.status].filter((to) => to !== "returned" && to !== "cancelled" && canTransition(order.status, to, me.role));
  const canReturn = (order.status === "shipped" || order.status === "delivered") && can("deliver_return");

  const move = (to: OrderStatus) => {
    if (to === "shipped") return setDialog("ship");
    if (transition(order.id, to))
      toast({
        title: t(`#${order.no} → ${STATUS_LABEL[to][0]}`, `#${order.no} → ${STATUS_LABEL[to][1]}`),
      });
  };

  return (
    <div className="pb-6">
      <Progress order={order} />
      <OrderDocLinks order={order} />

      {(next.length > 0 || canReturn || totals.remaining > 0 || pstate === "cod_with_courier") && order.status !== "cancelled" && (
        <div className="flex flex-wrap gap-2 border-b border-line px-5 pb-4">
          {next.map((to, i) => (
            <Button key={to} variant={i === 0 ? "primary" : "secondary"} onClick={() => move(to)} icon={to === "shipped" ? <Truck className="size-4" /> : undefined}>
              {t.pick(STATUS_ACTION[to]!)}
            </Button>
          ))}
          {canReturn && (
            <Button variant="secondary" icon={<ArrowUUpLeft className="size-4" />} onClick={() => setDialog("return")}>
              {t("Record return", "ফেরত নিন")}
            </Button>
          )}
          {canReturn && !order.exchangedTo && (
            <Button variant="ghost" icon={<ArrowsClockwise className="size-4" />} onClick={() => setDialog("exchange")}>
              {t("Exchange", "বদল")}
            </Button>
          )}
          {pstate === "cod_with_courier" && can("deliver_return") && (
            <Button variant="cash" icon={<HandCoins className="size-4" weight="fill" />} onClick={() => setDialog("cod")}>
              {t("COD received", "COD পেয়েছি")}
            </Button>
          )}
          {totals.remaining > 0 && order.status !== "returned" && pstate !== "cod_with_courier" && (
            <Button variant="ghost" icon={<Wallet className="size-4" />} onClick={() => setDialog("pay")}>
              {t("Record payment", "পেমেন্ট যোগ")}
            </Button>
          )}
          <CourierActions order={order} />
        </div>
      )}

      {/* customer */}
      <Section title={t("Customer", "কাস্টমার")}>
        {order.customer ? (
          <>
            <CustomerBlock order={order} customer={customer} orders={orders} />
            <NetworkRisk phone={order.customer.phone} className="mt-3" />
          </>
        ) : (
          <p className="text-sm text-ink-3">{t("Walk-in sale — no customer saved.", "দোকানে বিক্রি — কাস্টমার সেভ করা হয়নি।")}</p>
        )}
      </Section>

      {/* items */}
      <Section title={t(`Items · ${totals.units}`, `পণ্য · ${f.num(totals.units)}টি`)}>
        <ul className="-my-1 divide-y divide-line/70">
          {order.lines.map((l) => {
            const p = productMap.get(l.productId);
            return (
              <li key={l.id} className="flex items-center gap-3 py-2.5">
                {p ? <ProductThumb product={p} size={44} /> : <span className="size-11 rounded-md bg-sunken" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{t.lang === "bn" ? (p?.nameBn ?? l.name) : l.name}</p>
                  <p className="truncate text-xs text-ink-3">
                    {[l.variantLabel, l.sku].filter(Boolean).join(" · ")}
                    {l.returnedQty > 0 && <span className="ml-1.5 font-medium text-st-returned">· {t(`${l.returnedQty} returned`, `${f.num(l.returnedQty)}টি ফেরত`)}</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tnum text-sm font-medium text-ink">{f.money(l.qty * l.price - l.discount)}</p>
                  <p className="tnum text-xs text-ink-3">
                    {f.num(l.qty)} × {f.money(l.price)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* money */}
      <Section title={t("Money", "টাকা")}>
        <dl className="space-y-1.5 text-sm">
          <Row label={t("Subtotal", "সাবটোটাল")} value={f.money(totals.subtotal)} />
          {totals.discount > 0 && <Row label={t("Discount", "ছাড়")} value={`−${f.money(totals.discount)}`} />}
          {order.deliveryCharge > 0 && <Row label={t("Delivery charge", "ডেলিভারি চার্জ")} value={f.money(order.deliveryCharge)} />}
          {order.otherCharges > 0 && <Row label={t("Other charges", "অন্যান্য চার্জ")} value={f.money(order.otherCharges)} />}
          <div className="flex items-baseline justify-between border-t border-line pt-2">
            <dt className="font-medium text-ink">{t("Total", "মোট")}</dt>
            <dd className="figure text-xl font-semibold text-ink">{f.money(totals.total)}</dd>
          </div>
          {order.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-[13px]">
              <dt className="flex items-center gap-2 text-ink-3">
                <PayTag method={p.method} />
                <span>{p.kind === "advance" ? t("advance", "অগ্রিম") : p.kind === "refund" ? t("refund", "ফেরত") : ""}</span>
                {p.txnId && <span className="tnum text-xs text-ink-4">{p.txnId}</span>}
              </dt>
              <dd className={cn("tnum", p.amount < 0 ? "text-st-returned" : "text-ink-2")}>{f.money(p.amount)}</dd>
            </div>
          ))}
          {totals.remaining > 0 && order.status !== "cancelled" && (
            <div className="mt-2 flex items-center justify-between rounded-md bg-cash-soft px-3 py-2.5">
              <dt className="text-[13px] font-medium text-cash-ink">
                {order.settlement === "cod" ? (order.codReceived ? t("COD received", "COD পাওয়া গেছে") : t("Cash on delivery", "ক্যাশ অন ডেলিভারি")) : t("Customer owes", "কাস্টমারের বাকি")}
              </dt>
              <dd className="figure text-lg font-semibold text-cash-ink">{f.money(totals.remaining)}</dd>
            </div>
          )}
          {can("view_cost") && order.status !== "draft" && order.status !== "cancelled" && (
            <div className="mt-2 flex items-center justify-between rounded-md border border-dashed border-line-strong px-3 py-2 text-[13px]">
              <span className="text-ink-3">
                {t("Cost", "খরচ")} <span className="tnum text-ink-2">{f.money(totals.cogs)}</span>
              </span>
              <span className="text-ink-3">
                {t("Gross profit", "লাভ")} <span className={cn("tnum font-semibold", orderProfit(order) >= 0 ? "text-ok" : "text-danger")}>{f.money(orderProfit(order))}</span>
              </span>
            </div>
          )}
        </dl>
      </Section>

      {/* courier */}
      {order.courier && (
        <Section
          title={t("Courier", "কুরিয়ার")}
          action={
            can("pack_ship") && (
              <Button size="sm" variant="ghost" icon={<PencilSimple className="size-3.5" />} onClick={() => setDialog("courier")}>
                {t("Edit", "এডিট")}
              </Button>
            )
          }
        >
          {order.courier.consignmentId ? (
            <CourierTracking order={order} />
          ) : (
            <div className="flex items-center gap-3 text-sm">
              <span className="grid size-9 place-items-center rounded-md bg-sunken text-ink-2">
                <Truck className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{order.courier.name}</p>
                <p className="tnum text-xs text-ink-3">{order.courier.tracking ?? t("No tracking ID yet", "ট্র্যাকিং আইডি নেই")}</p>
              </div>
              {order.courier.fee !== undefined && can("view_cost") && (
                <span className="tnum text-[13px] text-ink-3">
                  {t("fee", "চার্জ")} {f.money(order.courier.fee)}
                </span>
              )}
              {order.courier.tracking && (
                <IconButton
                  size="sm"
                  label={t("Copy tracking ID", "ট্র্যাকিং আইডি কপি")}
                  onClick={() => {
                    navigator.clipboard?.writeText(order.courier!.tracking!);
                    toast({
                      title: t("Tracking ID copied", "ট্র্যাকিং আইডি কপি হয়েছে"),
                    });
                  }}
                >
                  <Copy className="size-4" />
                </IconButton>
              )}
            </div>
          )}
        </Section>
      )}

      {(order.notesInvoice || order.notesInternal) && (
        <Section title={t("Notes", "নোট")}>
          {order.notesInvoice && (
            <p className="text-sm text-ink-2">
              <span className="text-ink-4">{t("On invoice: ", "ইনভয়েসে: ")}</span>
              {order.notesInvoice}
            </p>
          )}
          {order.notesInternal && (
            <p className="mt-1 text-sm text-ink-2">
              <span className="text-ink-4">{t("Internal: ", "ভেতরের: ")}</span>
              {order.notesInternal}
            </p>
          )}
        </Section>
      )}

      <Timeline order={order} />

      {dialog === "ship" || dialog === "courier" ? (
        <ShipDialog
          open
          initial={dialog === "courier" ? order.courier : undefined}
          onClose={() => setDialog(null)}
          onConfirm={(c) => {
            if (dialog === "courier") {
              setCourier(order.id, c);
              toast({
                title: t("Courier details saved", "কুরিয়ারের তথ্য সেভ হয়েছে"),
              });
            } else if (transition(order.id, "shipped", { courier: c }))
              toast({
                title: t(`#${order.no} handed to ${c.name}`, `#${order.no} ${c.name}-এ দেওয়া হয়েছে`),
              });
            setDialog(null);
          }}
        />
      ) : null}
      {dialog === "pay" && (
        <PaymentDialog
          open
          order={order}
          onClose={() => setDialog(null)}
          onConfirm={(p) => {
            addPayment(order.id, { ...p, kind: "payment" });
            toast({
              title: t(`${f.money(p.amount)} recorded`, `${f.money(p.amount)} যোগ হয়েছে`),
            });
            setDialog(null);
          }}
        />
      )}
      {dialog === "exchange" && (
        <ExchangeDialog
          order={order}
          onClose={() => setDialog(null)}
          onDone={(next) => {
            toast({ title: t(`Exchange sent as order #${next.no}`, `বদল অর্ডার #${f.digits(String(next.no))} হিসেবে পাঠানো হয়েছে`), body: t("Returned items are back in stock.", "ফেরত পণ্য স্টকে ফিরেছে।") });
            setDialog(null);
          }}
        />
      )}
      {dialog === "return" && (
        <ReturnDialog
          open
          order={order}
          onClose={() => setDialog(null)}
          onConfirm={(lines, fee, refund, method) => {
            recordReturn(order.id, lines, fee, refund, method);
            toast({
              title: t("Return recorded", "ফেরত রেকর্ড হয়েছে"),
              body: t("Restocked items are available to sell again.", "রিস্টক করা পণ্য আবার বিক্রি করা যাবে।"),
            });
            setDialog(null);
          }}
        />
      )}
      {dialog === "cod" && (
        <CodDialog
          open
          amount={totals.remaining}
          count={1}
          onClose={() => setDialog(null)}
          onConfirm={(ref) => {
            markCod([order.id], ref);
            toast({
              title: t("COD marked received", "COD পাওয়া হিসেবে চিহ্নিত"),
            });
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}

function Section({ title, children, action }: { title: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-4 last:border-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-ink-2">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-ink-3">{label}</dt>
      <dd className="tnum text-ink-2">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------ progress */

const STEPS: OrderStatus[] = ["confirmed", "packed", "shipped", "delivered"];

/** Where this parcel is on its journey, with the time each stop was reached. */
function Progress({ order }: { order: Order }) {
  const t = useT();
  const f = useFmt();
  const reached = new Map<OrderStatus, string>();
  for (const e of order.events) if (e.type === "status" && e.to) reached.set(e.to, e.at);
  const terminal = order.status === "cancelled" || order.status === "returned" || order.status === "partially_returned" ? order.status : null;
  const steps: OrderStatus[] = terminal === "cancelled" ? [...STEPS.filter((s) => reached.has(s)), "cancelled"] : terminal ? [...STEPS.filter((s) => s !== "delivered" || reached.has("delivered")), terminal] : STEPS;
  const currentIdx = order.status === "draft" ? -1 : steps.indexOf(order.status);

  return (
    <div className="px-5 py-5">
      <ol className="flex items-start">
        {steps.map((s, i) => {
          const at = reached.get(s);
          const done = i <= currentIdx || !!at;
          const color = STATUS_COLOR[s];
          return (
            <li key={s} className="flex min-w-0 flex-1 basis-0 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <span className={cn("h-0.5 flex-1", i === 0 ? "opacity-0" : "")} style={{ background: done ? color : "var(--line)" }} />
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-full border-2 text-[10px] font-bold"
                  style={
                    done
                      ? { background: color, borderColor: color, color: "#fff" }
                      : {
                          borderColor: "var(--line-strong)",
                          background: "var(--surface)",
                        }
                  }
                >
                  {done ? "✓" : ""}
                </span>
                <span
                  className={cn("h-0.5 flex-1", i === steps.length - 1 ? "opacity-0" : "")}
                  style={{
                    background: i < currentIdx ? STATUS_COLOR[steps[i + 1]] : "var(--line)",
                  }}
                />
              </div>
              <span className={cn("mt-2 text-[12px] font-medium", done ? "text-ink" : "text-ink-4")}>{t.pick(STATUS_LABEL[s])}</span>
              <span className="tnum text-[11px] text-ink-4">{at ? `${f.dateShort(at)}, ${f.time(at)}` : "—"}</span>
            </li>
          );
        })}
      </ol>
      {order.status === "draft" && <p className="mt-3 text-center text-[13px] text-ink-3">{t("Draft — stock isn't held until you confirm.", "খসড়া — নিশ্চিত না করা পর্যন্ত স্টক রিজার্ভ হয় না।")}</p>}
    </div>
  );
}

/* ------------------------------------------------------------ customer */

function CustomerBlock({ order, customer, orders }: { order: Order; customer: ReturnType<typeof useStore.getState>["customers"][number] | undefined; orders: Order[] }) {
  const t = useT();
  const f = useFmt();
  const toast = useToast();
  const c = order.customer!;
  const stats = customer ? customerStats(customer, orders) : null;
  const level = customer && stats ? riskLevel(customer, stats) : "new";
  return (
    <div>
      <div className="flex items-start gap-3">
        <Avatar name={c.name} size={40} />
        <div className="min-w-0 flex-1">
          {customer ? (
            <Link href={`/customers?id=${customer.id}`} className="block truncate text-[15px] font-semibold text-ink hover:underline">
              {c.name}
            </Link>
          ) : (
            <p className="truncate text-[15px] font-semibold text-ink">{c.name}</p>
          )}
          <p className="tnum text-[13px] text-ink-2">{f.digits(formatPhone(c.phone))}</p>
          {c.address && <p className="mt-1 text-[13px] text-ink-3">{[c.address.line, c.address.area, c.address.district].filter(Boolean).join(", ")}</p>}
        </div>
        <div className="flex gap-1">
          <a href={`tel:${c.phone}`} aria-label={t("Call", "কল করুন")} className="grid size-9 place-items-center rounded-full bg-brand-50 text-brand-ink hover:bg-brand-100">
            <Phone className="size-4" weight="fill" />
          </a>
          <IconButton
            size="sm"
            label={t("Copy phone", "ফোন কপি")}
            className="rounded-full"
            onClick={() => {
              navigator.clipboard?.writeText(c.phone);
              toast({
                title: t("Phone number copied", "ফোন নম্বর কপি হয়েছে"),
              });
            }}
          >
            <Copy className="size-4" />
          </IconButton>
        </div>
      </div>
      {stats && (
        <div className="mt-3 flex items-center gap-3 rounded-md bg-surface-2 px-3 py-2.5">
          <RiskRing level={level} delivered={stats.delivered} returned={stats.returned} size={34} />
          <div className="min-w-0 flex-1">
            <RiskLabel level={level} />
            <p className="tnum text-xs text-ink-3">
              {t(`${stats.orders} orders · ${stats.returned} returned · spent ${f.money(stats.spent)}`, `${f.num(stats.orders)}টি অর্ডার · ${f.num(stats.returned)}টি ফেরত · ${f.money(stats.spent)}`)}
            </p>
          </div>
          {customer?.risky && <span className="text-xs font-medium text-danger">{t("Flagged", "চিহ্নিত")}</span>}
        </div>
      )}
      {customer?.notes && <p className="mt-2 rounded-md border-l-2 border-warn bg-warn-soft/60 px-3 py-2 text-[13px] text-ink-2">{customer.notes}</p>}
    </div>
  );
}

/* ------------------------------------------------------------ timeline */

function eventIcon(e: OrderEvent) {
  switch (e.type) {
    case "created":
      return <Plus className="size-3.5" weight="bold" />;
    case "payment":
      return <Wallet className="size-3.5" />;
    case "edit":
      return <PencilSimple className="size-3.5" />;
    case "print":
      return <Printer className="size-3.5" />;
    case "note":
      return <ChatText className="size-3.5" />;
    case "return":
      return <ArrowUUpLeft className="size-3.5" />;
    case "cod":
      return <HandCoins className="size-3.5" />;
    default:
      return null;
  }
}

function Timeline({ order }: { order: Order }) {
  const t = useT();
  const f = useFmt();
  const now = useNow();
  const addNote = useStore((s) => s.addOrderNote);
  const [note, setNote] = useState("");
  const events = [...order.events].sort((a, b) => b.at.localeCompare(a.at));
  const describe = (e: OrderEvent) => {
    switch (e.type) {
      case "created":
        return t("Order created", "অর্ডার তৈরি");
      case "status":
        return e.to ? t(`Moved to ${STATUS_LABEL[e.to][0]}`, `${STATUS_LABEL[e.to][1]}`) : "";
      case "payment":
        return t("Payment recorded", "পেমেন্ট যোগ");
      case "edit":
        return t("Order edited", "অর্ডার এডিট");
      case "print":
        return t(`${e.note ?? "Document"} printed`, `${e.note ?? "ডকুমেন্ট"} প্রিন্ট`);
      case "note":
        return t("Note", "নোট");
      case "return":
        return t("Return recorded", "ফেরত রেকর্ড");
      case "cod":
        return t("COD received", "COD পাওয়া গেছে");
    }
  };
  return (
    <Section title={t("Timeline", "টাইমলাইন")}>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!note.trim()) return;
          addNote(order.id, note.trim());
          setNote("");
        }}
      >
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Add a note for your team…", "টিমের জন্য নোট লিখুন…")} className="flex-1" />
        <Button type="submit" disabled={!note.trim()}>
          {t("Add", "যোগ")}
        </Button>
      </form>
      <ol className="relative">
        {events.map((e, i) => {
          const color = e.type === "status" && e.to ? STATUS_COLOR[e.to] : e.type === "cod" || e.type === "payment" ? "var(--cash-ink)" : "var(--ink-3)";
          return (
            <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
              {i < events.length - 1 && <span className="absolute left-[11px] top-6 h-[calc(100%-20px)] w-px bg-line" aria-hidden />}
              <span
                className="relative grid size-6 shrink-0 place-items-center rounded-full"
                style={{
                  color,
                  background: e.type === "status" ? `color-mix(in oklab, ${color} 14%, white)` : "var(--sunken)",
                }}
              >
                {eventIcon(e) ?? <span className="size-2 rounded-full" style={{ background: color }} />}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[13.5px] text-ink">
                  <span className="font-medium">{describe(e)}</span>
                  {e.note && e.type !== "print" && <span className="text-ink-2"> — {e.note}</span>}
                </p>
                <p className="text-xs text-ink-4" title={`${f.date(e.at)} ${f.time(e.at)}`}>
                  {e.by} · {f.relative(e.at, now)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

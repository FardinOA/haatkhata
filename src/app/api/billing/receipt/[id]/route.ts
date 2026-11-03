import { and, eq } from "drizzle-orm";
import { requireBusiness } from "@/server/auth/session";
import { PLANS, type PlanId } from "@/server/billing/plans";
import { db, schema } from "@/server/db";
import { subscriptionPayments } from "@/server/db/schema-billing";
import { route } from "@/server/http";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const taka = (n: number) => `৳${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const d = (x: Date | null) => (x ? x.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Dhaka" }) : "—");

/** VAT-inclusive receipt for a subscription payment (FR-SUB-03), ready to print or save as PDF. */
export const GET = route(async (_req: Request, ctx: RouteContext<"/api/billing/receipt/[id]">) => {
  const a = await requireBusiness();
  const { id } = await ctx.params;
  const [p] = await db.select().from(subscriptionPayments).where(and(eq(subscriptionPayments.id, id), eq(subscriptionPayments.businessId, a.businessId)));
  if (!p || p.status !== "paid") return new Response("Receipt not found", { status: 404 });
  const [b] = await db.select().from(schema.businesses).where(eq(schema.businesses.id, a.businessId));
  const plan = PLANS[p.plan as PlanId];
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Receipt ${esc(p.invoiceNo ?? "")}</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@page{size:A5;margin:14mm}body{font:13px/1.55 system-ui,sans-serif;color:#16181A;max-width:520px;margin:32px auto;padding:0 16px}
h1{font-size:22px;margin:0}.muted{color:#686E74}.row{display:flex;justify-content:space-between;padding:6px 0}.line{border-top:1px solid #E2E4DE;margin:10px 0}
.total{font-size:18px;font-weight:700;border-top:2px solid #16181A;padding-top:10px}.stamp{display:inline-block;border:2px solid #18915A;color:#18915A;border-radius:6px;padding:2px 10px;font-weight:700;letter-spacing:.04em;transform:rotate(-4deg)}
button{margin-top:24px;height:40px;padding:0 18px;border-radius:10px;border:1px solid #CDD1C8;background:#fff;font:600 14px system-ui;cursor:pointer}@media print{button{display:none}}</style></head><body>
<div class="row"><div><h1>BechaKena</h1><div class="muted">Subscription receipt</div></div><div style="text-align:right"><div><b>${esc(p.invoiceNo ?? "")}</b></div><div class="muted">${d(p.paidAt)}</div></div></div>
<div class="line"></div><div class="muted">Billed to</div><div><b>${esc(b.name)}</b><br>${esc(b.address || "")}<br>${esc(b.phone || "")}</div><div class="line"></div>
<div class="row"><span>${esc(plan?.name ?? p.plan)} plan · ${p.months} month${p.months > 1 ? "s" : ""}${p.creditMonths ? ` + ${p.creditMonths} bonus (referral)` : ""}</span><span>${taka(p.amount - p.vatAmount)}</span></div>
<div class="row muted"><span>Period</span><span>${d(p.periodStart)} – ${d(p.periodEnd)}</span></div>
<div class="row"><span>VAT ${p.vatPct}% (included)</span><span>${taka(p.vatAmount)}</span></div>
<div class="row total"><span>Total paid</span><span>${taka(p.amount)}</span></div>
<div class="row muted"><span>Paid with ${esc(p.method)} via ${esc(p.gateway)}</span><span>Ref ${esc(p.gatewayRef ?? "—")}</span></div>
<p style="margin-top:22px"><span class="stamp">PAID</span></p><button onclick="print()">Print or save as PDF</button></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
});

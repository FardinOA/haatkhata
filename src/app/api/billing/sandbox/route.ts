import { completePayment, failPayment, findPayment } from "@/server/billing/service";
import { sandboxAllowed } from "@/server/integrations/billing/sandbox";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Development checkout page standing in for a real gateway. */
export async function GET(req: Request) {
  if (!sandboxAllowed()) return new Response("Not found", { status: 404 });
  const id = new URL(req.url).searchParams.get("payment") ?? "";
  const p = await findPayment(id);
  if (!p) return new Response("Payment not found", { status: 404 });
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sandbox checkout</title>
<style>body{margin:0;font:15px/1.5 system-ui,sans-serif;background:#F3F4F0;color:#16181A;display:grid;place-items:center;min-height:100vh;padding:16px}
.card{background:#fff;border:1px solid #E2E4DE;border-radius:16px;padding:28px;max-width:380px;width:100%;box-shadow:0 16px 40px -8px rgb(22 24 26/.16)}
.tag{display:inline-block;background:#FDF1D9;color:#7A4D00;border-radius:99px;padding:2px 10px;font-size:12px;font-weight:600}
h1{font-size:20px;margin:14px 0 4px}.amt{font-size:34px;font-weight:700;margin:12px 0}.muted{color:#686E74;font-size:13px}
button{width:100%;height:48px;border-radius:12px;border:0;font:600 15px system-ui;cursor:pointer;margin-top:10px}
.pay{background:#0E6B53;color:#fff}.no{background:#fff;border:1px solid #CDD1C8;color:#16181A}</style></head>
<body><form class="card" method="post"><span class="tag">Sandbox — no real money</span><h1>BechaKena ${esc(p.plan)} plan</h1>
<p class="muted">${p.months} month${p.months > 1 ? "s" : ""} · paying with ${esc(p.method)}</p><div class="amt">৳${p.amount.toLocaleString("en-IN")}</div>
<input type="hidden" name="payment" value="${esc(p.id)}"><button class="pay" name="result" value="paid">Approve payment</button><button class="no" name="result" value="cancelled">Cancel</button></form></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function POST(req: Request) {
  if (!sandboxAllowed()) return new Response("Not found", { status: 404 });
  const form = await req.formData();
  const id = String(form.get("payment") ?? "");
  const result = String(form.get("result") ?? "cancelled");
  const p = await findPayment(id);
  if (!p) return new Response("Payment not found", { status: 404 });
  if (result === "paid") await completePayment(id, { amount: p.amount, ref: `SBX-${id}` });
  else await failPayment(id, "cancelled");
  return Response.redirect(new URL(`/settings?tab=plan&payment=${result === "paid" ? "success" : "cancelled"}`, req.url), 303);
}

import { eq } from "drizzle-orm";
import { completePayment, failPayment } from "@/server/billing/service";
import { db } from "@/server/db";
import { subscriptionPayments } from "@/server/db/schema-billing";
import { executeBkash } from "@/server/integrations/billing/bkash";

/** bKash sends the buyer back with ?paymentID=&status=success|failure|cancel. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const paymentID = u.searchParams.get("paymentID") ?? "";
  const status = u.searchParams.get("status");
  const back = (r: string) => Response.redirect(new URL(`/settings?tab=plan&payment=${r}`, req.url), 303);
  const [p] = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.gatewayRef, paymentID));
  if (!p) return back("failed");
  if (status !== "success") {
    await failPayment(p.id, status === "cancel" ? "cancelled" : "failed", { status });
    return back(status === "cancel" ? "cancelled" : "failed");
  }
  const r = await executeBkash(paymentID);
  if (r.completed && (!r.invoice || r.invoice === p.id)) {
    await completePayment(p.id, { amount: r.amount, ref: r.trxId, payload: { paymentID, trxID: r.trxId } });
    return back("success");
  }
  await failPayment(p.id, "failed", { paymentID, message: r.message });
  return back("failed");
}

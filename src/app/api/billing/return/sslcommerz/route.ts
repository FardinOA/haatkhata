import { completePayment, failPayment, findPayment } from "@/server/billing/service";
import { validateSslcommerz } from "@/server/integrations/billing/sslcommerz";

/** The buyer's browser comes back here (success, fail or cancel). Never trust it without validating. */
export async function POST(req: Request) {
  const form = Object.fromEntries((await req.formData()).entries()) as Record<string, string>;
  const back = (r: string) => Response.redirect(new URL(`/settings?tab=plan&payment=${r}`, req.url), 303);
  const p = form.tran_id ? await findPayment(form.tran_id) : null;
  if (!p) return back("failed");
  if (form.status === "VALID" || form.status === "VALIDATED") {
    const v = await validateSslcommerz(form.val_id ?? "");
    if (v.valid && v.tranId === p.id) {
      await completePayment(p.id, { amount: v.amount, ref: v.bankTranId ?? form.val_id, payload: { val_id: form.val_id, card_type: v.cardType } });
      return back("success");
    }
    return back("failed");
  }
  await failPayment(p.id, form.status === "CANCELLED" ? "cancelled" : "failed", { status: form.status });
  return back(form.status === "CANCELLED" ? "cancelled" : "failed");
}

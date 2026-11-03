import { completePayment, findPayment } from "@/server/billing/service";
import { validateSslcommerz, verifySslcommerzSignature } from "@/server/integrations/billing/sslcommerz";

/** Server-to-server notification from SSLCommerz. Signature + validation API, then idempotent activation. */
export async function POST(req: Request) {
  const form = Object.fromEntries((await req.formData()).entries()) as Record<string, string>;
  if (!verifySslcommerzSignature(form)) return new Response("bad signature", { status: 400 });
  const p = form.tran_id ? await findPayment(form.tran_id) : null;
  if (!p) return new Response("unknown payment", { status: 404 });
  if (form.status === "VALID" || form.status === "VALIDATED") {
    const v = await validateSslcommerz(form.val_id ?? "");
    if (!v.valid || v.tranId !== p.id) return new Response("not valid", { status: 400 });
    await completePayment(p.id, { amount: v.amount, ref: v.bankTranId ?? form.val_id, payload: { val_id: form.val_id, via: "ipn" } });
  }
  return new Response("ok");
}

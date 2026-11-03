import { eq } from "drizzle-orm";
import { z } from "zod";
import { orderTotals } from "@/lib/domain";
import { requireBusiness } from "@/server/auth/session";
import { requireRole } from "@/server/business";
import { schema, withTenant } from "@/server/db";
import { HttpError, json, route } from "@/server/http";
import { sendCustomerSms } from "@/server/notify/sms";

/** Due reminder SMS for a customer who has agreed to messages (FR-PAY-03). */
export const POST = route(async (req: Request) => {
  const a = await requireBusiness();
  await requireRole(a.role, ["owner", "manager", "accountant", "sales"]);
  const { customerId } = await json(req, z.object({ customerId: z.string() }));
  const data = await withTenant(a.businessId, async (tx) => {
    const [c] = await tx.select().from(schema.customers).where(eq(schema.customers.id, customerId));
    if (!c) throw new HttpError(404, "Customer not found");
    const orders = await tx.select().from(schema.orders).where(eq(schema.orders.customerId, customerId));
    let due = 0;
    for (const o of orders) {
      if (o.status === "draft" || o.status === "cancelled" || o.settlement !== "due") continue;
      const pays = await tx.select().from(schema.payments).where(eq(schema.payments.orderId, o.id));
      due += orderTotals({ lines: await tx.select().from(schema.orderLines).where(eq(schema.orderLines.orderId, o.id)), discount: o.discount, deliveryCharge: o.deliveryCharge, otherCharges: o.otherCharges, payments: pays, settlement: "due" } as never).due;
    }
    const [b] = await tx.select({ name: schema.businesses.name, phone: schema.businesses.phone }).from(schema.businesses).where(eq(schema.businesses.id, a.businessId));
    return { c, due, b };
  });
  if (data.due <= 0) throw new HttpError(400, "This customer doesn't owe anything.");
  const r = await sendCustomerSms(a.businessId, { key: "due_reminder", to: data.c.phone, customerId, force: true, vars: { customer: data.c.name, shop: data.b?.name, shop_phone: data.b?.phone, due: String(Math.round(data.due)) } });
  if (r.status === "skipped" && r.reason === "no_consent") throw new HttpError(409, "This customer hasn't agreed to SMS reminders. Ask them first and tick consent on their profile.", "no_consent");
  if (r.status === "skipped" && r.reason === "no_credits") throw new HttpError(402, "Not enough SMS credits. Top up from Settings.", "no_credits");
  if (r.status === "failed") throw new HttpError(502, `The SMS gateway didn't accept it: ${r.reason}`);
  return r;
});

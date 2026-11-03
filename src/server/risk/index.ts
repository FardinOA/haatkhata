import "server-only";
import { sql } from "drizzle-orm";
import { scoreRisk, type Counts, type NetworkCounts } from "@/components/couriers/risk-score";
import { normalizePhone } from "@/lib/domain";
import { withTenant } from "../db";

/**
 * This shop's own history (through row-level security) plus anonymised
 * counts from every other shop (through bk_network_risk, which can only
 * return four numbers — never another merchant's identity or data).
 */
export async function riskForPhone(businessId: string, rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  return withTenant(businessId, async (tx) => {
    const own = await tx.execute(sql`
      select count(*) filter (where status in ('delivered','partially_returned'))::int as delivered,
             count(*) filter (where status = 'returned')::int as returned,
             count(*) filter (where status = 'cancelled')::int as cancelled,
             (select bool_or(risky) from customers where phone = ${phone}) as flagged
      from orders where customer->>'phone' = ${phone}`);
    const net = await tx.execute(sql`select * from bk_network_risk(${phone})`);
    const o = own.rows[0] as Counts & { flagged: boolean | null };
    const n = net.rows[0] as NetworkCounts;
    return { phone, ...scoreRisk({ delivered: o.delivered, returned: o.returned, cancelled: o.cancelled }, n.merchants > 0 ? n : null, !!o.flagged) };
  });
}

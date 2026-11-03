import { riskForPhone } from "@/server/risk";
import { HttpError, route } from "@/server/http";
import { actor } from "../couriers/_auth";

/** Return-risk for a buyer's phone: this shop's history + anonymised network counts. */
export const GET = route(async (req: Request) => {
  const a = await actor();
  const phone = new URL(req.url).searchParams.get("phone") ?? "";
  const r = await riskForPhone(a.businessId, phone);
  if (!r) throw new HttpError(400, "Enter a Bangladeshi mobile number");
  return r;
});

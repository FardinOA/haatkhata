import { syncOpenConsignments } from "@/server/integrations/couriers/service";
import { route } from "@/server/http";
import { actor } from "../_auth";

/** "Check couriers now" for this shop — the cron does the same for every shop. */
export const POST = route(async () => {
  const a = await actor(["owner", "manager", "packer"]);
  return syncOpenConsignments(100, a.businessId);
});

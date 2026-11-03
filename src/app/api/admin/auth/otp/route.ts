import { z } from "zod";
import { requestAdminOtp } from "@/server/admin/service";
import { clientIp, json, route } from "@/server/http";

export const POST = route(async (req: Request) => {
  const { phone } = await json(req, z.object({ phone: z.string().min(10).max(20) }));
  return requestAdminOtp(phone, clientIp(req));
});

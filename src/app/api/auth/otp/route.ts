import { z } from "zod";
import { requestOtp } from "@/server/auth/session";
import { clientIp, json, route } from "@/server/http";

export const POST = route(async (req: Request) => {
  const { phone } = await json(req, z.object({ phone: z.string().min(10).max(20) }));
  return requestOtp(phone, clientIp(req));
});

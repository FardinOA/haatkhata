import "server-only";
import { bkash } from "./bkash";
import { nagad } from "./nagad";
import { sandboxPay } from "./sandbox";
import type { PayAdapter, PayProvider } from "./types";

export const PAY_ADAPTERS: Record<PayProvider, PayAdapter> = { bkash, nagad, sandbox: sandboxPay };
export const payAdapter = (p: string) => {
  const a = PAY_ADAPTERS[p as PayProvider];
  if (!a) throw new Error(`Unknown payment provider ${p}`);
  return a;
};

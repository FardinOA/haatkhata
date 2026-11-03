import "server-only";
import type { CourierProvider } from "@/lib/types";
import { carrybee } from "./carrybee";
import { paperfly } from "./paperfly";
import { pathao } from "./pathao";
import { redx } from "./redx";
import { sandbox } from "./sandbox";
import { steadfast } from "./steadfast";
import type { CourierAdapter } from "./types";

export const ADAPTERS: Record<CourierProvider, CourierAdapter> = { steadfast, pathao, redx, paperfly, carrybee, sandbox };

export function adapter(p: string): CourierAdapter {
  const a = ADAPTERS[p as CourierProvider];
  if (!a) throw new Error(`Unknown courier ${p}`);
  return a;
}

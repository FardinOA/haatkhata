import { route } from "@/server/http";

/** VAPID public key for the browser's push subscription. */
export const GET = route(async () => ({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null }));

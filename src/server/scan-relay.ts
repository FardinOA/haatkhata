import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { networkInterfaces } from "node:os";

/**
 * Phone-as-scanner relay (FR-POS-02). A desktop order screen and a phone
 * share a link; the phone streams scanned codes up, the desktop answers with
 * what it did (added / out of stock), both over Server-Sent Events.
 *
 * Nothing touches the database: channels live in memory on the one app
 * server and vanish when both sides hang up. The link itself is stateless —
 * a random pair id signed for one business — so it survives restarts and a
 * phone can keep it on its home screen.
 */

export type DesktopEvent = { type: "code"; id: string; code: string } | { type: "phone"; connected: boolean };
export type PhoneEvent = { type: "result"; id: string; ok: boolean; title: string; detail?: string } | { type: "desktop"; connected: boolean };

type Sink<E> = (e: E) => void;
type Channel = { desktops: Set<Sink<DesktopEvent>>; phones: Set<Sink<PhoneEvent>>; recent: number[] };

// On globalThis so dev hot-reloads don't orphan open streams.
const g = globalThis as { __bkScanChannels?: Map<string, Channel> };
const channels = (g.__bkScanChannels ??= new Map<string, Channel>());

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
  return s ?? "dev-only-secret";
};
const sign = (businessId: string, pairId: string) => createHmac("sha256", secret()).update(`scan:${businessId}:${pairId}`).digest("base64url").slice(0, 22);

export const TOKEN_RE = /^[\w-]{22}\.[\w-]{22}$/;

/** A fresh link token for this business. */
export function newPairToken(businessId: string) {
  const pairId = randomBytes(16).toString("base64url");
  return `${pairId}.${sign(businessId, pairId)}`;
}

/** Only the business that issued a token may listen on it as the desktop. */
export function tokenBelongsTo(token: string, businessId: string) {
  if (!TOKEN_RE.test(token)) return false;
  const [pairId, sig] = token.split(".");
  const want = Buffer.from(sign(businessId, pairId));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

function channel(token: string) {
  let c = channels.get(token);
  if (!c) channels.set(token, (c = { desktops: new Set(), phones: new Set(), recent: [] }));
  return c;
}

function release(token: string) {
  const c = channels.get(token);
  if (c && !c.desktops.size && !c.phones.size) channels.delete(token);
}

/** A long-lived SSE response; `attach` registers the sink and returns its cleanup. */
export function eventStream<E>(req: Request, attach: (send: Sink<E>) => () => void) {
  const enc = new TextEncoder();
  let detach = () => {};
  let ping: ReturnType<typeof setInterval>;
  const body = new ReadableStream<Uint8Array>({
    start(ctl) {
      const write = (s: string) => {
        try {
          ctl.enqueue(enc.encode(s));
        } catch {
          /* stream already closed */
        }
      };
      write("retry: 2000\n\n");
      detach = attach((e) => write(`data: ${JSON.stringify(e)}\n\n`));
      // Keeps proxies and phone radios from dropping an idle connection.
      ping = setInterval(() => write(": ping\n\n"), 20_000);
      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        detach();
        try {
          ctl.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      clearInterval(ping);
      detach();
    },
  });
  return new Response(body, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}

export function attachDesktop(token: string, send: Sink<DesktopEvent>) {
  const c = channel(token);
  c.desktops.add(send);
  send({ type: "phone", connected: c.phones.size > 0 });
  c.phones.forEach((p) => p({ type: "desktop", connected: true }));
  return () => {
    c.desktops.delete(send);
    if (!c.desktops.size) c.phones.forEach((p) => p({ type: "desktop", connected: false }));
    release(token);
  };
}

export function attachPhone(token: string, send: Sink<PhoneEvent>) {
  const c = channel(token);
  c.phones.add(send);
  send({ type: "desktop", connected: c.desktops.size > 0 });
  c.desktops.forEach((d) => d({ type: "phone", connected: true }));
  return () => {
    c.phones.delete(send);
    if (!c.phones.size) c.desktops.forEach((d) => d({ type: "phone", connected: false }));
    release(token);
  };
}

/** Phone → desktop. False when no desktop is listening, or the phone is flooding. */
export function sendCode(token: string, id: string, code: string) {
  const c = channels.get(token);
  if (!c?.desktops.size) return false;
  const now = Date.now();
  c.recent = c.recent.filter((t) => now - t < 10_000);
  if (c.recent.length >= 60) return false;
  c.recent.push(now);
  // Two tabs on the order screen would both add the item — only the newest one hears it.
  [...c.desktops].at(-1)!({ type: "code", id, code });
  return true;
}

/** Desktop → phone: what happened to a scanned code. */
export function sendResult(token: string, result: Extract<PhoneEvent, { type: "result" }>) {
  channels.get(token)?.phones.forEach((p) => p(result));
}

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** This machine's Wi-Fi/LAN address — what a phone on the same network can reach. */
function lanAddress() {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === "IPv4" && !n.internal)
    .map((n) => n!.address);
  const rank = (ip: string) => (ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3);
  return ips.filter((ip) => !ip.startsWith("169.254.")).sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/**
 * Where the phone should open the scanner link. `APP_URL` in production (the
 * shop's https domain). In development the desktop is usually on localhost,
 * which on a phone means the phone itself — so swap in this machine's LAN
 * address, keeping the port and scheme.
 */
export function phoneOrigin(req: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const name = host.replace(/:\d+$/, "");
  const port = host.slice(name.length);
  const lan = LOCAL.has(name) ? lanAddress() : null;
  return `${proto}://${lan ?? name}${port}`;
}


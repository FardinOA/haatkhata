import { ingest, normalizeWebhook, verifyMetaSignature } from "@/server/messaging/meta";

/** Meta webhook verification handshake (hub.challenge). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const ok = u.searchParams.get("hub.mode") === "subscribe" && !!process.env.META_VERIFY_TOKEN && u.searchParams.get("hub.verify_token") === process.env.META_VERIFY_TOKEN;
  return ok ? new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new Response("Forbidden", { status: 403 });
}

/** Messenger, Instagram and WhatsApp messages. Signed with X-Hub-Signature-256. */
export async function POST(req: Request) {
  const raw = await req.text();
  const signed = verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"));
  // Unsigned payloads are only accepted in development without an app secret (sandbox).
  if (!signed && (process.env.META_APP_SECRET || process.env.NODE_ENV === "production")) return new Response("Invalid signature", { status: 401 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const events = normalizeWebhook(body);
  let stored = 0;
  for (const e of events) if ((await ingest(e)).stored) stored++;
  // Meta retries on non-2xx, so acknowledge quickly.
  return Response.json({ received: events.length, stored });
}

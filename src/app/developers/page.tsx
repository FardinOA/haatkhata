import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "API reference", description: "BechaKena REST API and webhooks for developers." };

const SECTIONS = [
  ["auth", "Authentication"],
  ["errors", "Errors & limits"],
  ["products", "Products"],
  ["orders", "Orders"],
  ["create-order", "Create an order"],
  ["customers", "Customers"],
  ["webhooks", "Webhooks"],
  ["verify", "Verifying signatures"],
] as const;

function Code({ children, label }: { children: string; label?: string }) {
  return (
    <figure className="mt-3 overflow-hidden rounded-lg border border-line bg-[#fbfbf9]">
      {label && <figcaption className="border-b border-line px-4 py-2 text-xs font-medium text-ink-3">{label}</figcaption>}
      <pre className="scroll-thin overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink">{children}</pre>
    </figure>
  );
}

function Endpoint({ method, path, scope }: { method: "GET" | "POST"; path: string; scope: "read" | "write" }) {
  return (
    <p className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[13px]">
      <span className={method === "GET" ? "rounded-[5px] bg-ok-soft px-1.5 py-0.5 font-semibold text-ok" : "rounded-[5px] bg-cash-soft px-1.5 py-0.5 font-semibold text-cash-ink"}>{method}</span>
      <span className="text-ink">{path}</span>
      <span className="rounded-full bg-sunken px-2 py-0.5 font-sans text-xs text-ink-3">scope: {scope}</span>
    </p>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-b border-line py-10 last:border-b-0">
      <h2 className="font-display text-[22px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      <div className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-ink-2 [&_code]:rounded [&_code]:bg-sunken [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px]">{children}</div>
    </section>
  );
}

export default function DevelopersPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-[10px] bg-brand font-display text-sm font-semibold text-brand-contrast">বে</span>
            <span className="font-display text-[15px] font-semibold text-ink">BechaKena for developers</span>
          </Link>
          <Link href="/settings" className="text-[13px] font-medium text-brand-ink hover:underline">
            Manage keys in Settings
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1180px] gap-10 px-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden pt-10 lg:block">
          <ul className="sticky top-8 space-y-1 text-[13px]">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-md px-2.5 py-1.5 text-ink-2 hover:bg-sunken hover:text-ink">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 pb-20">
          <div className="pb-6 pt-10">
            <h1 className="font-display text-[34px] font-semibold leading-tight tracking-[-0.02em] text-ink">REST API &amp; webhooks</h1>
            <p className="mt-3 max-w-[60ch] text-base text-ink-2">
              Read your catalogue and orders, create orders from your website, and get told the moment an order changes. Base URL <code className="rounded bg-sunken px-1 py-0.5 font-mono text-[14px]">/api/v1</code>. JSON in, JSON out, amounts in taka.
            </p>
          </div>

          <Section id="auth" title="Authentication">
            <p>
              Create a key in <b>Settings → Developers</b>. Send it as a bearer token. Keys are scoped: <code>read</code> for lists and lookups, <code>write</code> to create orders. A key only ever sees its own shop&apos;s data.
            </p>
            <Code label="Request">{`curl https://your-shop.bechakena.app/api/v1/products \\
  -H "Authorization: Bearer bk_live_…"`}</Code>
          </Section>

          <Section id="errors" title="Errors & limits">
            <p>Errors use HTTP status codes and a JSON body. Each key may make 120 requests a minute; above that you get <code>429</code>.</p>
            <Code>{`{ "error": { "type": "forbidden", "message": "This key doesn't have the \\"write\\" scope." } }`}</Code>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li><code>401</code> missing, invalid or revoked key</li>
              <li><code>402</code> the shop reached its plan&apos;s order limit — existing data stays readable</li>
              <li><code>403</code> the key lacks the scope</li>
              <li><code>422</code> the order couldn&apos;t be created (for example, an unknown variant)</li>
            </ul>
          </Section>

          <Section id="products" title="Products">
            <Endpoint method="GET" path="/api/v1/products?limit=50" scope="read" />
            <p className="mt-3">Products with their variants, selling price and live <code>available</code> stock. Buying prices are never exposed.</p>
            <Code>{`{
  "object": "list",
  "data": [{
    "id": "p_0004", "name": "Block-print Kurti", "name_bn": "ব্লক প্রিন্ট কুর্তি", "status": "active",
    "variants": [{ "id": "v_0012", "sku": "KRT-101", "options": { "Size": "M", "Colour": "Indigo" },
                   "price": 890, "mrp": null, "available": 14, "active": true }]
  }]
}`}</Code>
          </Section>

          <Section id="orders" title="Orders">
            <Endpoint method="GET" path="/api/v1/orders?status=confirmed&limit=50&created_before=…" scope="read" />
            <Endpoint method="GET" path="/api/v1/orders/:id" scope="read" />
            <p className="mt-3">
              Newest first. Page with <code>created_before</code> set to the last order&apos;s <code>created_at</code>; <code>has_more</code> tells you when to stop. Status is one of <code>draft</code>, <code>confirmed</code>, <code>packed</code>, <code>shipped</code>, <code>delivered</code>, <code>returned</code>, <code>partially_returned</code>, <code>cancelled</code>.
            </p>
          </Section>

          <Section id="create-order" title="Create an order">
            <Endpoint method="POST" path="/api/v1/orders" scope="write" />
            <p className="mt-3">
              Orders go through the same rules as the app: stock is held on confirm, limits and prices are checked. Prices come from your catalogue. Send an <code>Idempotency-Key</code> header so a retried request never creates a second order.
            </p>
            <Code label="Request">{`curl -X POST https://your-shop.bechakena.app/api/v1/orders \\
  -H "Authorization: Bearer bk_live_…" \\
  -H "Idempotency-Key: web-order-58213" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel": "website",
    "status": "confirmed",
    "customer": { "name": "Nabila Haque", "phone": "01912345678",
                  "address": { "line": "Road 2, House 9", "area": "Banani", "district": "Dhaka" } },
    "items": [{ "variant_id": "v_0012", "qty": 2 }],
    "delivery_charge": 70,
    "advance_paid": { "method": "bkash", "amount": 70, "txn_id": "TX8812" },
    "settlement": "cod"
  }'`}</Code>
            <Code label="Response · 201">{`{ "id": "o_api…", "object": "order", "number": 1331, "invoice_no": "INV-2026-000331",
  "status": "confirmed", "totals": { "subtotal": 1780, "discount": 0, "delivery": 70,
  "total": 1850, "paid": 70, "cod": 1780, "due": 0 }, "idempotent_replay": false }`}</Code>
          </Section>

          <Section id="customers" title="Customers">
            <Endpoint method="GET" path="/api/v1/customers?limit=50&created_before=…" scope="read" />
          </Section>

          <Section id="webhooks" title="Webhooks">
            <p>
              Add an endpoint in <b>Settings → Developers</b> and pick events. We send a <code>POST</code> with a JSON body within seconds. Answer with any <code>2xx</code>; otherwise we retry after 1 minute, 5 minutes, 30 minutes, 2 hours, 6 hours and 24 hours.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li><code>order.created</code> — a confirmed or completed order (not drafts)</li>
              <li><code>order.status_changed</code> — packed, shipped, delivered, returned or cancelled</li>
              <li><code>payment.recorded</code> — a payment or a courier COD payout</li>
            </ul>
            <Code label="Body">{`{ "id": "evt_…", "event": "order.status_changed", "created": "2026-11-02T14:05:11.000Z",
  "data": { "id": "o_…", "number": 1042, "status": "shipped",
            "courier": { "name": "Steadfast", "tracking": "ST3383517" }, … } }`}</Code>
          </Section>

          <Section id="verify" title="Verifying signatures">
            <p>
              Every request carries <code>X-BechaKena-Signature: t=&lt;unix time&gt;,v1=&lt;hex&gt;</code>. Compute HMAC-SHA256 of <code>t + &quot;.&quot; + raw body</code> with your endpoint&apos;s signing secret, compare in constant time, and reject anything older than five minutes.
            </p>
            <Code label="Node.js">{`import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(secret, rawBody, header) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  return v1.length === expected.length && timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}`}</Code>
          </Section>
        </main>
      </div>
    </div>
  );
}

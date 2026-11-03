# BechaKena — web prototype

A working, clickable prototype of BechaKena POS: stock, sales and invoicing for online and social sellers in Bangladesh. It implements the MVP flows from [../pos-srs.md](../pos-srs.md) against on-device demo data, so it can go straight into seller usability tests (business plan §12, step 4).

## Run it

```bash
npm install
cp .env.example .env.local      # then fill in what you need
npm run db:up                    # Postgres 17 in Docker on port 55433
npm run db:migrate
npm run dev                      # http://localhost:3000
```

- **Sign in** with any Bangladeshi mobile number. With `SMS_DRIVER=console` the code is printed in the server log and shown on screen (development only).
- **Explore without an account:** the demo shop runs entirely on the device.
- **Tests:** `npm run test` (unit) · `npm run test:server` (against a throwaway Postgres database) · `npm run test:all`.
- **End-to-end tests:** `npm run test:e2e` drives the real app in Chrome with Playwright: barcodes, labels, USB-scanner and double-scan handling, and the phone scanner, where a generated video of a printed label stands in for the phone's camera and is decoded for real. It signs in as a test shop (`E2E_PHONE`, default `01999000111`, needs `SMS_DRIVER=console`), creates its products once and reuses the session. It starts `npm run dev` itself, or point it at a dev server that's already running: `E2E_BASE_URL=http://localhost:3001 npm run test:e2e`. Locally it uses your installed Chrome; in CI run `npx playwright install chromium` first.
- **Phone camera on a real phone:** phones only allow the camera on https. `npm run dev:https` serves https, and the phone-scanner QR then points at this computer's Wi-Fi address (or set `APP_URL` to a tunnel).
- **Production:** the cheapest setup is one small VPS running [deploy/compose.yml](deploy/compose.yml) (app, Postgres, Caddy for HTTPS, the scheduled jobs and nightly backups to R2): `cp deploy/.env.example deploy/.env`, fill it in, then `docker compose -f deploy/compose.yml --env-file deploy/.env up -d --build`. The image applies migrations on start. Otherwise `npm run build && npm start`, or build the `Dockerfile`. Health check: `/api/health`. Schedule `/api/cron/courier-sync` (every 15–30 min), `/api/cron/daily` (hourly) and `POST /api/billing/cron` (daily) with `Authorization: Bearer $CRON_SECRET`.
- **Super-admin:** the staff console is its own app in [../admin](../admin) (React + Vite, its own domain). Grant access with `npm run admin:grant -- 017XXXXXXXX`, then sign in there.

## What's in it

| Screen | Route | Highlights |
|---|---|---|
| Home | `/dashboard` | Drag-to-arrange widgets in four sizes, a widget library, role layouts (Owner, Packing desk, Sales floor), parcel journey, real-profit receipt, Bangla calendar date |
| New order | `/pos` | Product finder + scan, Messenger quick-paste, phone lookup with return-risk, delivery presets, split payments, COD/due, parked carts, F2/F4/F8/F9 |
| Orders | `/orders` | Journey strip, list and drag-to-advance board, bulk print/ship, detail sheet with timeline, returns that restock |
| Customers | `/customers` | Segments, return-risk ring, dues, profile, WhatsApp/call |
| Products | `/products` | Lookbook grid / table, variant matrix editor, CSV import with validation, share cards |
| Stock | `/inventory` | Stock in with weighted average cost, adjustments, ledger, suppliers |
| Cash & COD | `/money` | Money map, COD by courier, dues with reminders, supplier dues, expenses |
| Reports | `/reports` | Sales, profit waterfall, stock, returns, staff; CSV and print |
| Settings | `/settings` | **Brand studio** (logo → suggested colours, theme presets, background, sidebar, corners, density, typeface), invoices, delivery zones, team & roles, language, plan, backup |
| Invoice / label | `/invoice/[id]` | 58/80 mm POS rolls, A5, A4, Letter, two copies on one A4, Mushak-6.3; labels at 100×75, 4×6 in, 75×50 or 8 per A4 sheet; optional shop copy; each device remembers its own paper; comma-separated ids print in bulk |

Switch staff from the menu at the bottom of the sidebar to see role permissions (for example, Sales can't see cost or profit). Press `⌘K` anywhere to search, and `N` to start a new order.

## How it's built

- **Next.js 16** (App Router, Cache Components) + **Tailwind v4**. See [design-dna.md](design-dna.md) for the visual contract.
- **Local-first state**: one persisted Zustand store (`src/lib/store.ts`) holds everything and is the seam for a real API later. Because screens read device storage, the `(app)` layout waits for hydration (`instant = false`).
- **Domain logic** is pure and tested (`src/lib/domain.ts`, `src/lib/analytics.ts`): the order state machine and its stock effects follow SRS §3.5 exactly (reserve → in transit → delivered / restocked).
- **Theming**: one accent hex becomes a full OKLCH ramp with AA-checked text colours (`src/lib/theme.ts`), applied before first paint by an inline script.
- **Bilingual UI**: strings sit inline as `t("English", "বাংলা")`; numbers go through `useFmt()` for lakh grouping and optional Bangla numerals.
- **Offline**: `public/sw.js` caches the app shell, and data never leaves the device.

```
src/
  app/(app)/…        screens inside the shell
  app/invoice/[id]   print documents (no shell)
  components/ui      buttons, inputs, sheets, dialogs, menus, toasts
  components/…       one folder per feature
  lib/               types, domain rules, store, seed, analytics, theme, formatting
```

## Needs live credentials before launch

Courier (Steadfast, Pathao, RedX, Paperfly, Carrybee), bKash/Nagad/SSLCommerz, SMS gateway, Meta (inbox) and Anthropic (AI order reading) adapters are written against each provider's API and run on sandbox drivers until keys are added in `.env.local` or per shop in Settings. Endpoints marked TODO in `src/server/integrations/**` should be confirmed against each provider's merchant docs.

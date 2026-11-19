# Design DNA — HaatKhata POS

Binding visual contract for the HaatKhata web app. Companion docs: [../pos-srs.md](../pos-srs.md), [../pos-business-plan.md](../pos-business-plan.md).

## Evidence binding

| Decision | Evidence | Source | Mechanism |
|---|---|---|---|
| Light-only, high-clarity surfaces | Primary device is a low-to-mid Android phone, often used in daylight at a shop counter; the client asked to avoid a dark theme | SRS §2.4; client brief (2 Nov 2026) | Glare-safe contrast on cheap LCDs; matches how printed invoices look |
| Accent is the *seller's* brand, not ours | Settings must carry logo and colour accent; invoices go to end customers with the seller's identity | SRS FR-SET-01, FR-INV-09; business plan §7.2 "invoice virality" | Generated OKLCH ramp keeps any picked colour usable and AA-safe |
| Marigold reserved for cash/COD only | COD receivable and dues are the money the seller is chasing | SRS FR-PAY-02, business plan §2 "returns are invisible / no idea of real profit" | One fixed colour = "money not yet in your hand" in every theme |
| Fixed status colours for order lifecycle | Orders move Draft → Confirmed → Packed → Shipped → Delivered/Returned; stock moves with them | SRS §3.5 | Status reads identically regardless of brand theme |
| Anek Bangla display + Geist UI + Noto Sans Bengali body | Full Bangla UI with correct conjuncts; Bangla numerals optional; money columns must align | SRS §2.5, NFR-USE-02 | Anek covers both scripts in one voice; Geist has tabular figures for ledgers |
| Condensed money figures (Anek `wdth` 88) | Dashboard KPIs, totals at 360 px wide | SRS NFR-USE-01, FR-RPT-01 | Large ৳ amounts fit narrow screens without truncation |
| Parcel-journey rail as the signature | The product's core difference: an order has a life after the sale | SRS §1.2; business plan §1 "one stock for the counter and the page" | Makes the differentiator visible on the first screen |
| Thermal-receipt paper treatment for invoice previews | Invoices print on 58/80 mm thermal paper and A4/A5 | SRS FR-INV-02, §5.2 | Preview looks like the artefact the seller will hand over |
| Patterned textile swatches as product art | Demo seller is a clothing/handloom boutique; most sellers have no product photos at first | business plan §2; SRS FR-PRD-01 (images optional) | Every product has a recognisable thumbnail before a photo exists |
| Customisable dashboard with role presets | Owner, Manager, Sales, Packer, Accountant need different things | SRS §2.3, FR-RPT-01 | Each role lands on the widgets it acts on |
| 44 px touch targets, row density setting | Usable at 360 px, touch ≥ 44 px; desktop counter use too | SRS NFR-USE-01 | Comfortable for phone, compact for desk users |

## Category default analysis

**Category:** SMB POS / inventory / order-management SaaS.

| Common strategy in this category | Used here? | If used, evidence row |
|---|---|---|
| Dark navy sidebar + blue primary | No | — |
| Grid of identical KPI cards with sparkline + % delta | Partly — KPIs live in one strip, not a card grid; deltas only where comparable | "Condensed money figures" |
| Purple/indigo gradient hero accents | No | — |
| Data tables as the default view for everything | Tables for orders/products (dense, scannable); board + journey views for lifecycle | "Parcel-journey rail" |
| Generic stock photos / blank image placeholders | No — patterned swatches | "Patterned textile swatches" |

## Territories considered

1. **Counter Ledger (selected).** Light stone canvas, white working surfaces, seller-branded accent, marigold for cash, Bangla-first type, receipt-paper artefacts. Calm, dense where needed, tactile in printed-object moments.
2. **Night Bazaar.** Deep indigo surfaces, neon channel colours, glowing charts. Rejected: client explicitly ruled out dark; fails glare-legibility on budget phones; invoices would preview against an unrepresentative background.
3. **Nakshi Craft.** Heavy textile motifs, warm clay palette, illustrated borders throughout. Rejected: ornament competes with dense operational data; slows scanning of orders; the warm-clay + cream look is a common generated default. Kept only as a *material echo* in product swatches and theme names.

## Design thesis

A working counter, not a showroom: quiet stone and white surfaces that carry the seller's own colour, where the only loud things are money still owed (marigold), parcels in motion (the journey rail), and the printed artefacts the seller hands to customers.

## Desired perception

"This is *my* shop's system": it wears my logo and colour, speaks Bangla properly, and tells me in one glance what to pack, what to chase and what I actually earned.

## Audience

Facebook/Instagram/WhatsApp sellers in Bangladesh (1–80 orders/day), their moderators and packers; mostly on Android phones, some at a laptop on the counter.

## Emotional register

- Friendly over formal, because a new seller must print a first invoice in under 5 minutes without help (SRS NFR-USE-03), so copy is plain Bangla/English verbs, not accounting jargon.
- Quiet over loud, because the screen is used for hours at a counter or in chat sessions (SRS FR-POS-09 parked carts), so only owed money and parcels in motion get emphasis.
- Accessible over luxe, because the pricing tier is ৳0–৳1,999/month against Hishebi's ৳99 (business plan §6), so it must feel like a dependable tool, not a premium indulgence.

## Color philosophy

- Dominant field: cool stone canvas `#F3F4F0` with white working surfaces; alternatives (mist, sand, white, brand-tint) are user choices.
- Tonal range: light; ink `#16181A` for text.
- Accent strategy: a single brand accent, user-chosen, generated into a 50–950 OKLCH ramp; text uses an auto-picked AA-safe step.
- Focal colour: marigold `#F0A92B` only for cash/COD/dues.
- Status colours fixed per lifecycle stage.
- No atmospheric gradients or glows. Tints are flat.

## Typography philosophy

Anek Bangla (variable width) for display and figures — condensed for money, normal for headings. Geist for Latin UI with tabular numbers in ledgers. Noto Sans Bengali as Bangla body fallback. Hierarchy comes from weight and ink tone first, size second. Sentence case everywhere; no all-caps eyebrows.

## Composition philosophy

Left-aligned, working-tool composition. Desktop: slim sidebar + content on a 12-column grid. Dashboard widgets take one of four spans (4/6/8/12) so hierarchy is expressed in size. Mobile: bottom tab bar with a raised "New order" action.

## Spatial philosophy

Comfortable density by default (44 px rows), compact optional (36 px). Whitespace separates groups; borders separate rows. Empty areas always offer the next action.

## Shape language

One base radius (user-tunable: 6/12/18 px) with derived steps — small for controls, base for panels, large for sheets. Pills only for status and badges.

## Surface / material language

Flat paper. White surfaces with a hairline border and a very soft two-layer shadow; sunken grey for nested groups instead of nested cards. The one tactile material is thermal receipt paper (torn edge) for invoice previews.

## Image direction

Seller-uploaded product photos when present; otherwise generated textile-pattern swatches in the product's hue. No stock photography, no 3D illustrations.

## Interaction philosophy

Precise and quick: optimistic updates, instant feedback, keyboard shortcuts on desktop (F2/F4/F8/F9, ⌘K). Springs only on direct manipulation (drag, toggles).

## Motion philosophy

Motion explains change: sheets slide from where they belong, status moves animate along the journey, widgets reflow when dragged. The one ambient motion is the dashed "flow" on the journey rail. Reduced motion respected.

## Signature moments

1. **Parcel journey rail** — orders and ৳ flowing through Confirmed → Packed → Shipped → Delivered/Returned, clickable into the board.
2. **Brand studio** — upload a logo, get colour suggestions pulled from it, and watch the app and the invoice re-theme live.
3. **Receipt-paper invoice** — the share/print preview looks like the real thermal slip or A5 memo.

## Anti-patterns

- Dark mode or dark sidebars.
- Rows of identical KPI cards each with its own sparkline.
- ALL-CAPS tracked eyebrow labels; numbered 01/02/03 markers on non-sequences.
- Decorative gradients, glassmorphism, glow.
- Placeholder grey image boxes.

## Responsive philosophy

Same materials and type voice at every width. What changes: sidebar → bottom bar, tables → stacked rows, dashboard spans collapse to full width, POS cart becomes a bottom sheet.

---

## Amendment log

| Date | What changed | Why | Approved by |
|---|---|---|---|
| 2026-11-02 | Initial | Prototype build | — |

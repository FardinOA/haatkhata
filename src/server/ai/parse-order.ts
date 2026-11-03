import "server-only";
/**
 * AI order parsing (SRS FR-POS-10, v2): turns a pasted Messenger/WhatsApp chat
 * in Bangla, Banglish or English into customer details and cart items matched
 * against the business's own catalogue. Falls back to the rule-based parser
 * when no API key is configured, credits are used up, or the call fails.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { parseMessage } from "@/components/pos/parse-message";
import { DISTRICTS } from "@/lib/geo";
import { normalizePhone } from "@/lib/domain";
import { schema, type Tx } from "../db";
import { aiUsage } from "../db/schema-platform";

export const AI_MODEL = "claude-opus-5-5";
export const AI_MONTHLY_CREDITS = Number(process.env.AI_MONTHLY_CREDITS ?? 500);

export type CatalogEntry = { productId: string; variantId: string; sku: string; name: string; nameBn?: string; options: string; price: number; available: number };

export type ParsedOrder = {
  name?: string;
  phone?: string;
  address?: string;
  area?: string;
  district?: string;
  items: { productId?: string; variantId?: string; text: string; qty: number }[];
  confidence: number;
  source: "ai" | "rules";
  notes?: string;
};

const AiOrder = z.object({
  name: z.string().nullable().describe("Customer's name as written, in the script used. null if absent."),
  phone: z.string().nullable().describe("Bangladeshi mobile number, digits only, 11 digits starting 01. null if absent."),
  address: z.string().nullable().describe("House/road/flat/landmark line, without area and district."),
  area: z.string().nullable().describe("Area or thana, e.g. Mirpur 10, Agrabad."),
  district: z.string().nullable().describe("One of Bangladesh's 64 districts, English spelling from the list."),
  items: z
    .array(
      z.object({
        variantId: z.string().nullable().describe("variantId from the catalogue that best matches, or null if nothing matches."),
        text: z.string().describe("What the customer asked for, in their words."),
        qty: z.number().int().describe("Quantity requested; 1 if not stated."),
      }),
    )
    .describe("Each distinct product the customer wants."),
  confidence: z.number().describe("0 to 1: how sure you are the details and item matches are right."),
  notes: z.string().nullable().describe("Anything the seller should know (size doubts, delivery time requests), short."),
});

const SYSTEM = `You read customer messages sent to small online shops in Bangladesh (Facebook, Instagram, WhatsApp) and extract the order.

Messages mix Bangla script, Banglish (Bangla in Latin letters) and English, often with Bangla digits (০-৯), spelling variations and greetings. Extract:
- the customer's name, phone and delivery address (house/road line, area or thana, district);
- every product they want, matched to the shop catalogue below by meaning — colour words, sizes (S/M/L/XL, 38/40, "boro"/"choto") and Bangla names count. "2ta", "duita", "২টা" mean quantity 2.

Only use variantIds that appear in the catalogue. If a request is ambiguous between variants (e.g. size not given), pick none (null) and say why in notes. Never invent a phone number or address. Districts must use the English names: ${DISTRICTS.map(([e]) => e).join(", ")}.`;

/** Catalogue text for the prompt. Deterministic ordering so the cached prefix stays stable. */
export function catalogText(entries: CatalogEntry[]) {
  return [
    "Shop catalogue (variantId | SKU | product | options | price ৳ | available):",
    ...entries
      .slice()
      .sort((a, b) => a.variantId.localeCompare(b.variantId))
      .slice(0, 800)
      .map((e) => `${e.variantId} | ${e.sku} | ${e.name}${e.nameBn ? ` (${e.nameBn})` : ""} | ${e.options || "-"} | ${e.price} | ${e.available}`),
  ].join("\n");
}

export async function loadCatalog(tx: Tx): Promise<CatalogEntry[]> {
  const rows = await tx
    .select({ productId: schema.products.id, variantId: schema.variants.id, sku: schema.variants.sku, name: schema.products.name, nameBn: schema.products.nameBn, options: schema.variants.options, price: schema.variants.price, onHand: schema.variants.onHand, reserved: schema.variants.reserved, status: schema.products.status, active: schema.variants.active })
    .from(schema.variants)
    .innerJoin(schema.products, sql`${schema.products.id} = ${schema.variants.productId} and ${schema.products.businessId} = ${schema.variants.businessId}`);
  return rows
    .filter((r) => r.status === "active" && r.active)
    .map((r) => ({ productId: r.productId, variantId: r.variantId, sku: r.sku, name: r.name, nameBn: r.nameBn ?? undefined, options: Object.values(r.options).join(" / "), price: r.price, available: r.onHand - r.reserved }));
}

/** Rule-based fallback, with simple SKU / product-name matching for items. */
export function parseWithRules(text: string, catalog: CatalogEntry[]): ParsedOrder {
  const p = parseMessage(text);
  const items: ParsedOrder["items"] = [];
  const hay = text.toLowerCase();
  for (const e of catalog) {
    if (hay.includes(e.sku.toLowerCase())) items.push({ productId: e.productId, variantId: e.variantId, text: e.sku, qty: 1 });
  }
  const filled = [p.found.name, p.found.phone, p.found.address].filter(Boolean).length;
  return {
    name: p.name,
    phone: p.phone,
    address: p.address?.line,
    area: p.address?.area,
    district: p.address?.district,
    items,
    confidence: filled / 3,
    source: "rules",
    notes: p.leftover,
  };
}

export async function monthlyUsage(tx: Tx, businessId: string, month = currentMonth()) {
  const [row] = await tx.select().from(aiUsage).where(sql`${aiUsage.businessId} = ${businessId} and ${aiUsage.month} = ${month}`);
  return { month, used: row?.requests ?? 0, limit: AI_MONTHLY_CREDITS };
}

export function currentMonth(d = new Date()) {
  const dhaka = new Date(d.getTime() + 6 * 3_600_000);
  return dhaka.toISOString().slice(0, 7);
}

async function recordUsage(tx: Tx, businessId: string, usage: { input: number; output: number }) {
  await tx
    .insert(aiUsage)
    .values({ businessId, month: currentMonth(), requests: 1, inputTokens: usage.input, outputTokens: usage.output })
    .onConflictDoUpdate({
      target: [aiUsage.businessId, aiUsage.month],
      set: { requests: sql`${aiUsage.requests} + 1`, inputTokens: sql`${aiUsage.inputTokens} + ${usage.input}`, outputTokens: sql`${aiUsage.outputTokens} + ${usage.output}` },
    });
}

let client: Anthropic | null = null;
/** Overridable in tests. */
export function setAnthropicClient(c: Anthropic | null) {
  client = c;
}
function getClient() {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client = new Anthropic();
  return client;
}

export async function parseOrder(tx: Tx, businessId: string, text: string): Promise<ParsedOrder & { usage: { used: number; limit: number } }> {
  const catalog = await loadCatalog(tx);
  const usage = await monthlyUsage(tx, businessId);
  const anthropic = getClient();
  if (!anthropic || usage.used >= usage.limit) return { ...parseWithRules(text, catalog), usage };

  try {
    const response = await anthropic.beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 8000,
      // Server-side refusal fallback: if the model declines, the API retries on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(AiOrder) },
      system: [
        { type: "text", text: SYSTEM },
        // The catalogue is stable between requests for a shop: cache it.
        { type: "text", text: catalogText(catalog), cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: `Customer message:\n\n${text.slice(0, 6000)}` }],
    });
    await recordUsage(tx, businessId, { input: response.usage.input_tokens, output: response.usage.output_tokens });
    const out = response.stop_reason === "refusal" ? null : response.parsed_output;
    if (!out) return { ...parseWithRules(text, catalog), usage: { ...usage, used: usage.used + 1 } };
    const byId = new Map(catalog.map((e) => [e.variantId, e]));
    const district = out.district ? DISTRICTS.find(([e]) => e.toLowerCase() === out.district!.toLowerCase())?.[0] : undefined;
    return {
      name: out.name ?? undefined,
      phone: (out.phone && normalizePhone(out.phone)) || undefined,
      address: out.address ?? undefined,
      area: out.area ?? undefined,
      district,
      items: out.items
        .filter((i) => i.qty > 0)
        .map((i) => {
          const hit = i.variantId ? byId.get(i.variantId) : undefined;
          return { productId: hit?.productId, variantId: hit?.variantId, text: i.text, qty: Math.min(99, i.qty) };
        }),
      confidence: Math.max(0, Math.min(1, out.confidence)),
      source: "ai",
      notes: out.notes ?? undefined,
      usage: { ...usage, used: usage.used + 1 },
    };
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.warn("AI parse failed, using rules:", e.status, e.message);
    else console.warn("AI parse failed, using rules:", (e as Error).message);
    return { ...parseWithRules(text, catalog), usage };
  }
}

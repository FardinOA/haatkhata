import "server-only";
/**
 * Mini catalogue storefront (v3): a public, shareable product page per
 * business, and order requests that land as DRAFT orders in the seller's app.
 *
 * As with public invoices, the owner connection only resolves slug → business;
 * all catalogue data is read through withTenant() under row-level security.
 * Prices always come from the database — never from the visitor's cart.
 */
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { available, normalizePhone } from "@/lib/domain";
import { DISTRICTS } from "@/lib/geo";
import type { Variant } from "@/lib/types";
import { applyCommand } from "../apply";
import { db, schema, withTenant } from "../db";
import { storefronts } from "../db/schema-channels";
import { HttpError } from "../http";
import { rateLimit } from "./rate-limit";

const { products, variants, businesses, categories } = schema;

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED = new Set(["admin", "api", "app", "login", "welcome", "dashboard", "settings", "bechakena", "shop", "store", "help", "support", "www"]);

export function validateSlug(slug: string) {
  if (!SLUG_RE.test(slug)) return "Use 3–40 lowercase letters, numbers or dashes.";
  if (RESERVED.has(slug)) return "That address is reserved. Try another.";
  return null;
}

export const settingsSchema = z.object({
  slug: z.string().trim().toLowerCase(),
  enabled: z.boolean(),
  showStock: z.boolean(),
  banner: z.string().trim().max(160),
  deliveryInside: z.number().min(0).max(5000),
  deliveryOutside: z.number().min(0).max(5000),
  whatsapp: z.string().trim().max(20).nullable(),
  messenger: z.string().trim().max(80).nullable(),
});
export type StorefrontSettings = z.infer<typeof settingsSchema>;

function slugFrom(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  return base.length >= 3 ? base : `shop-${Math.random().toString(36).slice(2, 7)}`;
}

/** Seller's settings, with a suggested slug if none saved yet. */
export async function getSettings(businessId: string): Promise<StorefrontSettings & { saved: boolean }> {
  return withTenant(businessId, async (tx) => {
    const [row] = await tx.select().from(storefronts).where(eq(storefronts.businessId, businessId));
    if (row) return { saved: true, slug: row.slug, enabled: row.enabled, showStock: row.showStock, banner: row.banner, deliveryInside: row.deliveryInside, deliveryOutside: row.deliveryOutside, whatsapp: row.whatsapp, messenger: row.messenger };
    const [b] = await tx.select({ name: businesses.name, pos: businesses.pos }).from(businesses).where(eq(businesses.id, businessId));
    const presets = ((b?.pos ?? {}) as { deliveryPresets?: { amount: number }[] }).deliveryPresets ?? [];
    return { saved: false, slug: slugFrom(b?.name ?? "shop"), enabled: false, showStock: false, banner: "", deliveryInside: presets[0]?.amount ?? 70, deliveryOutside: presets.at(-1)?.amount ?? 130, whatsapp: null, messenger: null };
  });
}

export async function saveSettings(businessId: string, input: StorefrontSettings) {
  const problem = validateSlug(input.slug);
  if (problem) throw new HttpError(400, problem, "slug");
  const whatsapp = input.whatsapp ? normalizePhone(input.whatsapp) : null;
  if (input.whatsapp && !whatsapp) throw new HttpError(400, "WhatsApp needs a Bangladeshi mobile number", "whatsapp");
  // Slug uniqueness spans all businesses, so check it outside the tenant (only the id is read).
  const [taken] = await db.select({ businessId: storefronts.businessId }).from(storefronts).where(eq(storefronts.slug, input.slug));
  if (taken && taken.businessId !== businessId) throw new HttpError(409, "Another shop already uses that address", "slug");
  const row = { ...input, whatsapp, messenger: input.messenger?.replace(/^https?:\/\/(www\.)?(m\.me|facebook\.com)\//, "") || null, updatedAt: new Date() };
  await withTenant(businessId, (tx) => tx.insert(storefronts).values({ businessId, ...row }).onConflictDoUpdate({ target: storefronts.businessId, set: row }));
}

async function resolveSlug(slug: string) {
  if (!SLUG_RE.test(slug)) return null;
  const [hit] = await db.select({ businessId: storefronts.businessId }).from(storefronts).where(and(eq(storefronts.slug, slug), eq(storefronts.enabled, true)));
  return hit?.businessId ?? null;
}

export type PublicCatalogue = NonNullable<Awaited<ReturnType<typeof getCatalogue>>>;

export async function getCatalogue(slug: string) {
  const businessId = await resolveSlug(slug);
  if (!businessId) return null;
  return withTenant(businessId, async (tx) => {
    const [[sf], [b], ps, cats] = await Promise.all([
      tx.select().from(storefronts).where(eq(storefronts.businessId, businessId)),
      tx.select().from(businesses).where(eq(businesses.id, businessId)),
      tx.select().from(products).where(eq(products.status, "active")),
      tx.select().from(categories),
    ]);
    const vs = ps.length ? await tx.select().from(variants).where(and(inArray(variants.productId, ps.map((p) => p.id)), eq(variants.active, true))) : [];
    const allowNegative = !!((b.pos ?? {}) as { allowNegativeStock?: boolean }).allowNegativeStock;
    const theme = (b.theme ?? {}) as { accent?: string };
    const items = ps
      .map((p) => {
        const pv = vs.filter((v) => v.productId === p.id).sort((a, c) => a.position - c.position);
        return {
          id: p.id,
          name: p.name,
          nameBn: p.nameBn,
          categoryId: p.categoryId,
          description: p.description,
          images: p.images.filter((src) => !src.startsWith("data:")).slice(0, 4),
          art: p.art,
          optionTypes: p.optionTypes,
          bestseller: p.tags.includes("bestseller"),
          variants: pv.map((v) => {
            const left = available(v as unknown as Variant);
            return { id: v.id, options: v.options, price: v.price, mrp: v.mrp, inStock: allowNegative || left > 0, left: sf.showStock ? Math.max(0, left) : null };
          }),
        };
      })
      .filter((p) => p.variants.length);
    return {
      slug: sf.slug,
      banner: sf.banner,
      showStock: sf.showStock,
      delivery: { inside: sf.deliveryInside, outside: sf.deliveryOutside },
      whatsapp: sf.whatsapp,
      messenger: sf.messenger,
      business: { name: b.name, nameBn: b.nameBn, tagline: b.tagline, logo: b.logo, logoShape: b.logoShape, phone: b.phone, address: b.address, accent: theme.accent ?? "#0E6B53" },
      categories: cats.filter((c) => items.some((i) => i.categoryId === c.id)).map((c) => ({ id: c.id, name: c.name, nameBn: c.nameBn })),
      products: items,
    };
  });
}

export const orderRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(10).max(20),
  address: z.object({ line: z.string().trim().min(3).max(200), area: z.string().trim().max(80).default(""), district: z.string().trim().max(40) }),
  note: z.string().trim().max(300).optional(),
  lines: z.array(z.object({ variantId: z.string().min(1).max(80), qty: z.number().int().min(1).max(20) })).min(1).max(20),
  /** Honeypot: real people never see or fill this field. */
  company: z.string().max(200).optional(),
});

export async function placeOrderRequest(slug: string, raw: unknown, ip: string) {
  const input = orderRequestSchema.safeParse(raw);
  if (!input.success) throw new HttpError(400, "Please check your name, phone and address", "invalid");
  // Honeypot filled: answer like a success so bots learn nothing, but store nothing.
  if (input.data.company) return { orderNo: null, total: 0 };
  const phone = normalizePhone(input.data.phone);
  if (!phone) throw new HttpError(400, "Enter a Bangladeshi mobile number like 017XXXXXXXX", "phone");
  if (!DISTRICTS.some(([en]) => en === input.data.address.district)) throw new HttpError(400, "Choose your district", "district");

  const businessId = await resolveSlug(slug);
  if (!businessId) throw new HttpError(404, "This catalogue isn't available");

  await rateLimit(`sf:ip:${ip}`, 6, 10 * 60_000, "You've sent several orders just now. Please wait a few minutes.");
  await rateLimit(`sf:phone:${phone}`, 3, 60 * 60_000, "This number already sent a few orders in the last hour. The shop will contact you.");
  await rateLimit(`sf:shop:${businessId}`, 120, 60 * 60_000);

  // Merge duplicate lines, then price everything from the database.
  const qty = new Map<string, number>();
  for (const l of input.data.lines) qty.set(l.variantId, Math.min(20, (qty.get(l.variantId) ?? 0) + l.qty));
  const [sf, rows] = await withTenant(businessId, async (tx) => {
    const [s] = await tx.select().from(storefronts).where(eq(storefronts.businessId, businessId));
    const vs = await tx
      .select({ id: variants.id, productId: variants.productId, price: variants.price, active: variants.active, productStatus: products.status })
      .from(variants)
      .innerJoin(products, and(eq(products.id, variants.productId), eq(products.businessId, variants.businessId)))
      .where(inArray(variants.id, [...qty.keys()]));
    return [s, vs] as const;
  });
  const usable = rows.filter((r) => r.active && r.productStatus === "active");
  if (usable.length !== qty.size) throw new HttpError(409, "Some items are no longer available. Refresh the page and try again.", "unavailable");

  const inside = input.data.address.district === "Dhaka";
  const system = { businessId, userId: "system_storefront", userName: "Online catalogue", role: "manager" as const };
  const at = new Date().toISOString();
  const cmdId = `sf${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const outcome = await applyCommand(system, {
    id: cmdId,
    type: "order.create",
    at,
    payload: {
      mode: "draft",
      input: {
        channel: "website",
        customer: { name: input.data.name, phone, address: input.data.address },
        lines: usable.map((r) => ({ key: r.id, productId: r.productId, variantId: r.id, qty: qty.get(r.id)!, price: r.price, discount: 0 })),
        discount: { type: "flat", value: 0 },
        deliveryCharge: inside ? sf.deliveryInside : sf.deliveryOutside,
        otherCharges: 0,
        payments: [],
        settlement: "cod",
        notesInternal: `Order request from the online catalogue${input.data.note ? ` — “${input.data.note}”` : ""}`,
      },
    },
  });
  if (outcome.status !== "applied") throw new HttpError(409, outcome.error ?? "The order couldn't be sent. Try again.", outcome.code);
  const order = outcome.result as { id: string; no: number; lines: { qty: number; price: number }[]; deliveryCharge: number };
  const total = order.lines.reduce((s, l) => s + l.qty * l.price, 0) + order.deliveryCharge;
  await applyCommand(system, {
    id: `${cmdId}n`,
    type: "notice.push",
    at,
    payload: { kind: "new_order", title: `New order request from your catalogue — #${order.no}`, body: `${input.data.name} · ৳${total.toLocaleString("en-IN")} · confirm it from Orders`, href: `/orders?id=${order.id}` },
  });
  return { orderNo: order.no, total };
}

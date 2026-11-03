import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test as setup, type Page } from "@playwright/test";
import { PHONE, PRODUCTS, STATE, synced } from "./fixtures";

type Me = { businessId: string | null; businesses: { id: string; name: string; plan: string }[] };

/** Signs in (only when the saved session is gone or its shop's trial ran out) and stocks the test shop. */
setup.use({ storageState: existsSync(STATE) ? STATE : undefined });

setup("signed-in test shop with products", async ({ page }) => {
  await page.goto("/dashboard");
  const me = await page.request.get("/api/auth/me").then((r) => (r.ok() ? (r.json() as Promise<Me>) : null));
  const usable = me?.businesses.find((b) => b.id === me.businessId && b.plan !== "expired");
  const local = await page.evaluate(() => JSON.parse(localStorage.getItem("bechakena-pos") ?? "{}").state?.sync?.mode);
  if (!usable || local !== "account") await signIn(page);

  // English UI, so tests can use the English labels.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("bechakena-pos") ?? "{}");
    raw.state.lang = "en";
    localStorage.setItem("bechakena-pos", JSON.stringify(raw));
  });

  for (const p of PRODUCTS) await ensureProduct(page, p);
  await synced(page);
  mkdirSync(dirname(STATE), { recursive: true });
  await page.context().storageState({ path: STATE });
});

async function code(page: Page) {
  const r = await page.request.post("/api/auth/otp", { data: { phone: PHONE } });
  const body = await r.json();
  expect(r.ok(), body.error).toBe(true);
  expect(body.devCode, "The dev server must run with SMS_DRIVER=console").toBeTruthy();
  return body.devCode as string;
}

async function signIn(page: Page) {
  // 1. Make sure the owner has a shop that isn't locked (trials end after 7 days).
  const v = await page.request.post("/api/auth/verify", { data: { phone: PHONE, code: await code(page) } });
  const { businesses } = (await v.json()) as Me;
  let shop = businesses.find((b) => b.plan !== "expired")?.name;
  if (!shop) {
    shop = `E2E shop ${new Date().toISOString().slice(0, 10)}`;
    const r = await page.request.post("/api/businesses", { data: { name: shop, ownerName: "E2E", type: "shop", channels: [], sample: false } });
    expect(r.ok()).toBe(true);
  }
  // 2. Sign in through the real page, which also switches this browser into the account.
  await page.goto("/login");
  const otp = page.waitForResponse((r) => r.url().endsWith("/api/auth/otp"));
  await page.getByPlaceholder("017XXXXXXXX").fill(PHONE);
  await page.locator("button[type=submit]").click();
  const { devCode } = await (await otp).json();
  await page.locator("input[autocomplete=one-time-code]").fill(devCode);
  // One shop goes straight in; several ask which one first.
  const chooser = page.getByRole("button", { name: shop });
  await expect(async () => {
    if (/\/dashboard/.test(page.url())) return;
    if (await chooser.isVisible()) await chooser.click();
    throw new Error("still signing in");
  }).toPass({ timeout: 30_000 });
}

async function ensureProduct(page: Page, p: (typeof PRODUCTS)[number]) {
  const names = () => page.evaluate(() => (JSON.parse(localStorage.getItem("bechakena-pos") ?? "{}").state?.products ?? []).map((x: { name: string }) => x.name) as string[]);
  if ((await names()).includes(p.name)) return;
  await page.goto("/products/new");
  await page.getByLabel("Name in English").fill(p.name);
  await page.getByLabel("Selling price").fill(String(p.price));
  await page.getByLabel("Barcode").fill(p.barcode);
  await page.getByLabel("Opening stock").fill(String(p.stock));
  await page.getByRole("button", { name: "Add product" }).click();
  await page.waitForURL(/\/products\/p_/); // opens the saved product
}

import { writeFileSync } from "node:fs";
import { chromium, expect, type Page } from "@playwright/test";
import { barcodeFor, eanCheckDigit } from "../src/lib/barcode";

/** Signed-in shop session shared by every test (written by auth.setup.ts). */
export const STATE = "e2e/.auth/shop.json";

/** The test shop's owner. Any valid Bangladeshi mobile number works with SMS_DRIVER=console. */
export const PHONE = process.env.E2E_PHONE ?? "01999000111";

const ean = (body: string) => body + eanCheckDigit(body);

/** Products the setup makes sure exist, with plenty of stock (carts are never checked out). */
export const KURTI = { name: "E2E Kurti", price: 1450, barcode: ean("299000000011"), stock: 500 };
export const HIJAB = { name: "E2E Hijab", price: 650, barcode: ean("299000000028"), stock: 500 };
export const PRODUCTS = [KURTI, HIJAB];

/** The quantity box of a product's line in the order screen's cart. */
export const cartQty = (page: Page, name: string) => page.locator("li").filter({ has: page.getByLabel("Quantity", { exact: true }) }).filter({ hasText: name }).getByLabel("Quantity", { exact: true });

/** Waits until every local change has reached the server. */
export async function synced(page: Page) {
  await expect
    .poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem("bechakena-pos") ?? "{}").state?.outbox ?? []).length), { timeout: 30_000 })
    .toBe(0);
}

/**
 * A Y4M clip of one barcode, for Chrome's fake camera: the phone scanner sees
 * it exactly as it would see a printed label, and decodes it for real.
 */
export function barcodeVideo(path: string, code: string) {
  const W = 640;
  const H = 480;
  const scale = 4;
  const quiet = 12;
  const { widths } = barcodeFor(code);
  const width = (widths.reduce((a, b) => a + b, 0) + quiet * 2) * scale;
  const y = Buffer.alloc(W * H, 235); // white, in video range
  let x = Math.floor((W - width) / 2) + quiet * scale;
  widths.forEach((m, i) => {
    if (i % 2 === 0) for (let px = x; px < x + m * scale; px++) for (let row = 150; row < 330; row++) y[row * W + px] = 16;
    x += m * scale;
  });
  const chroma = Buffer.alloc((W / 2) * (H / 2), 128);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), y, chroma, chroma]);
  writeFileSync(path, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), ...Array.from({ length: 10 }, () => frame)]));
  return path;
}

/** A second browser whose camera films `video` — the phone in these tests. */
export function launchPhoneBrowser(video: string) {
  return chromium.launch({
    channel: process.env.CI ? undefined : "chrome",
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${video}`],
  });
}

/** Phone-sized, touch-first: the app treats it as a phone (camera, not QR pairing). */
export const PHONE_DEVICE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["camera"] };

import { expect, test } from "@playwright/test";
import { isValidEan13 } from "../src/lib/barcode";
import { HIJAB, KURTI } from "./fixtures";

test.describe("barcodes on products", () => {
  test("refuses a barcode another product already uses", async ({ page }) => {
    await page.goto("/products/new");
    await page.getByLabel("Name in English").fill("E2E Clash");
    await page.getByLabel("Selling price").fill("100");
    await page.getByLabel("Barcode").fill(KURTI.barcode);
    await page.getByRole("button", { name: "Add product" }).click();
    await expect(page.getByText(`Already on ${KURTI.name}`)).toBeVisible();
    await expect(page).toHaveURL(/\/products\/new$/);
  });

  test("Fill barcodes gives a variant a fresh, valid EAN-13", async ({ page }) => {
    await page.goto("/products/new");
    await page.getByLabel("Name in English").fill("E2E Unsaved");
    await page.getByRole("button", { name: "Fill barcodes" }).click();
    const code = await page.getByLabel("Barcode").inputValue();
    expect(code).toMatch(/^2\d{12}$/);
    expect(isValidEan13(code)).toBe(true);
    expect(code).not.toBe(KURTI.barcode);
  });

  test("scanning on the products page opens that product", async ({ page }) => {
    await page.goto("/products");
    const search = page.getByRole("textbox", { name: "Search products" });
    await search.fill(HIJAB.barcode);
    await search.press("Enter");
    await expect(page).toHaveURL(/\/products\/p_/);
    await expect(page.getByRole("heading", { name: HIJAB.name })).toBeVisible();
  });

  test("labels print the product's real barcode", async ({ page }) => {
    await page.goto("/products");
    await page.getByRole("button", { name: "Print labels" }).click();
    await expect(page).toHaveURL(/\/labels/);
    const variantId = await page.evaluate((name) => {
      const products = JSON.parse(localStorage.getItem("bechakena-pos") ?? "{}").state.products as { name: string; variants: { id: string }[] }[];
      return products.find((p) => p.name === name)!.variants[0].id;
    }, KURTI.name);
    await page.goto(`/labels?v=${variantId}:3`);
    await expect(page.getByRole("img", { name: `Barcode ${KURTI.barcode}` })).toHaveCount(3);
  });
});

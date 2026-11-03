import { expect, test } from "@playwright/test";
import { cartQty, KURTI } from "./fixtures";

/** A USB (keyboard-wedge) scanner types the code into the search box and presses Enter. */
test.describe("scanning at the order screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pos");
  });

  const scan = async (page: import("@playwright/test").Page, code: string) => {
    const search = page.getByRole("textbox", { name: "Search products" });
    await search.fill(code);
    await search.press("Enter");
  };

  test("adds a scanned product to the cart", async ({ page }) => {
    await scan(page, KURTI.barcode);
    await expect(cartQty(page, KURTI.name)).toHaveValue("1");
  });

  test("a repeat scan asks how many the cart should hold", async ({ page }) => {
    const prompt = page.getByRole("dialog").filter({ hasText: `${KURTI.name} scanned again` });
    const qty = prompt.getByLabel("Quantity in the cart");

    await scan(page, KURTI.barcode);
    await expect(cartQty(page, KURTI.name)).toHaveValue("1");

    // An accidental double scan: keep what's there.
    await scan(page, KURTI.barcode);
    await expect(qty).toHaveValue("2");
    await prompt.getByRole("button", { name: "Keep 1" }).click();
    await expect(prompt).toBeHidden();
    await expect(cartQty(page, KURTI.name)).toHaveValue("1");

    // A stack of the same item: type how many.
    await scan(page, KURTI.barcode);
    await qty.fill("5");
    await prompt.getByRole("button", { name: "Set quantity" }).click();
    await expect(cartQty(page, KURTI.name)).toHaveValue("5");

    // Enter accepts the suggestion (one more).
    await scan(page, KURTI.barcode);
    await expect(qty).toHaveValue("6");
    await qty.press("Enter");
    await expect(cartQty(page, KURTI.name)).toHaveValue("6");

    // Never more than the shelf holds.
    await scan(page, KURTI.barcode);
    await qty.fill("99999");
    await prompt.getByRole("button", { name: "Set quantity" }).click();
    await expect(cartQty(page, KURTI.name)).toHaveValue(String(KURTI.stock));
  });

  test("the quantity buttons step within stock", async ({ page }) => {
    const prompt = page.getByRole("dialog").filter({ hasText: `${KURTI.name} scanned again` });
    await scan(page, KURTI.barcode);
    await scan(page, KURTI.barcode);
    await prompt.getByRole("button", { name: "One more" }).click();
    await expect(prompt.getByLabel("Quantity in the cart")).toHaveValue("3");
    await prompt.getByRole("button", { name: "One less" }).click();
    await prompt.getByRole("button", { name: "Set quantity" }).click();
    await expect(cartQty(page, KURTI.name)).toHaveValue("2");
  });

  test("an unknown code adds nothing", async ({ page }) => {
    await scan(page, "9999999999994");
    await expect(page.getByLabel("Quantity")).toHaveCount(0);
  });
});

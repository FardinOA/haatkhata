import { expect, test, type Browser, type Page } from "@playwright/test";
import { barcodeVideo, cartQty, KURTI, launchPhoneBrowser, PHONE_DEVICE, STATE } from "./fixtures";

/** Opens the "Scan with your phone" panel on the computer and returns the phone link's path and token. */
async function pairLink(desktop: Page) {
  await desktop.getByRole("button", { name: "Scan", exact: true }).click();
  const field = desktop.getByLabel("Phone scanner link");
  await expect(field).toHaveValue(/\/scan\//);
  const url = new URL(await field.inputValue());
  // The link may carry this Mac's Wi-Fi address; the test phone reaches the same server at baseURL.
  return { path: url.pathname + url.search, token: url.pathname.split("/").pop()! };
}

/** Pushes a code from "the phone" straight through the relay, waiting until the computer is listening. */
async function sendFromPhone(page: Page, token: string, code: string, id: string) {
  await expect
    .poll(async () => (await (await page.request.post(`/api/scan/${token}/phone`, { data: { id, code } })).json()).delivered, { timeout: 20_000 })
    .toBe(true);
}

test.describe("phone as the scanner", () => {
  let phoneBrowser: Browser;
  test.beforeAll(async ({}, info) => {
    phoneBrowser = await launchPhoneBrowser(barcodeVideo(info.outputPath("kurti.y4m"), KURTI.barcode));
  });
  test.afterAll(async () => phoneBrowser?.close());

  test("the phone's camera scans into the computer's cart; a repeat asks for the quantity on the computer", async ({ page: desktop }) => {
    await desktop.goto("/pos");
    const { path, token } = await pairLink(desktop);

    const phone = await (await phoneBrowser.newContext(PHONE_DEVICE)).newPage();
    await phone.goto(path);
    await expect(phone.getByText("Counter connected")).toBeVisible();
    await expect(desktop.getByText("Phone connected — start scanning")).toBeVisible();

    // The real camera path: fake video of a printed label → decoder → relay → cart.
    await phone.getByRole("button", { name: "Start scanning" }).click();
    await expect(phone.getByText(KURTI.name)).toBeVisible({ timeout: 30_000 });
    await expect(phone.getByText(/1 in cart/)).toBeVisible();
    await desktop.getByRole("button", { name: "Done" }).click();
    await expect(cartQty(desktop, KURTI.name)).toHaveValue("1");

    // Listen like the phone does, then scan the same label again moments later.
    await phone.evaluate((tk) => {
      const w = window as unknown as { results: string[] };
      w.results = [];
      new EventSource(`/api/scan/${tk}/phone`).onmessage = (m) => {
        const e = JSON.parse(m.data);
        if (e.type === "result") w.results.push(e.title);
      };
    }, token);
    await sendFromPhone(phone, token, KURTI.barcode, "again-1");
    const prompt = desktop.getByRole("dialog").filter({ hasText: `${KURTI.name} scanned again` });
    await expect(prompt).toBeVisible();
    await expect.poll(() => phone.evaluate(() => (window as unknown as { results: string[] }).results)).toContain("Scanned again — set the quantity on the computer");
    await expect(cartQty(desktop, KURTI.name)).toHaveValue("1");
    await prompt.getByLabel("Quantity in the cart").fill("3");
    await prompt.getByRole("button", { name: "Set quantity" }).click();
    await expect(cartQty(desktop, KURTI.name)).toHaveValue("3");
  });

  test("away from the order screen, a phone scan types into the box with the cursor", async ({ page: desktop }) => {
    await desktop.goto("/pos");
    const { token } = await pairLink(desktop);
    await desktop.getByRole("button", { name: "Done" }).click();

    // Like a USB scanner: click a field anywhere, scan, and the code lands there.
    await desktop.goto("/products/new");
    const barcode = desktop.getByLabel("Barcode");
    await barcode.click();
    await sendFromPhone(desktop, token, "8901234567897", "typed-1");
    await expect(barcode).toHaveValue("8901234567897");
  });

  test("a phone selling on its own scans into its own cart", async () => {
    const phone = await (await phoneBrowser.newContext({ ...PHONE_DEVICE, storageState: STATE })).newPage();
    await phone.goto("/pos");
    await phone.getByRole("button", { name: "Scan", exact: true }).click();
    const sheet = phone.getByRole("dialog", { name: "Scan with camera" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(KURTI.name)).toBeVisible({ timeout: 30_000 });
    await expect(sheet.getByText(/1 in cart/)).toBeVisible();
  });
});

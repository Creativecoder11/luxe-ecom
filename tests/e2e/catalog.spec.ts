import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./helpers";

// 1×1 transparent PNG.
const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function chooseCategory(page: Page, name: string) {
  const option = page.locator("#category option").filter({ hasText: new RegExp(`^\\s*${name}$`) });
  await page.locator("#category").selectOption(await option.getAttribute("value"));
}

test.describe("storefront catalog (seeded synthetic data)", () => {
  test("home shows category tiles and new arrivals from the database", async ({ page }) => {
    await page.goto("/");
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: /Beauty/ }).first()).toBeVisible();
    await expect(main.getByRole("link", { name: "Wireless Earbuds Pro" }).first()).toBeVisible();
    await expect(page.getByText("Linen Cushion Cover")).toHaveCount(0); // draft is never shown
  });

  test("category facets filter by variant option", async ({ page }) => {
    await page.goto("/categories/fashion");
    const count = page.locator('p[aria-live="polite"]').first();
    await expect(count).toContainText("2 products");
    await page.goto("/categories/fashion?attr_size=s");
    await expect(count).toContainText("1 product ");
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "Classic Cotton Kurti" })).toBeVisible();
    await expect(main.getByRole("link", { name: "Everyday Crew T-Shirt" })).toHaveCount(0);
  });

  test("search matches titles and searchable attributes", async ({ page }) => {
    await page.goto("/search?q=hyaluronic");
    await expect(page.getByRole("main").getByRole("link", { name: "Hydrating Face Serum 30 ml" })).toBeVisible();
    await page.goto("/search?q=VL-EB200");
    await expect(page.getByRole("main").getByRole("link", { name: "Wireless Earbuds Pro" })).toBeVisible();
  });

  test("product page variant picker switches price and SKU", async ({ page }) => {
    await page.goto("/products/classic-cotton-kurti");
    await expect(page.getByRole("heading", { level: 1, name: "Classic Cotton Kurti" })).toBeVisible();
    await expect(page.getByText("SKU KRT-CLASSIC-S-NAVY")).toBeVisible();
    await page.getByRole("button", { name: "L", exact: true }).click();
    await page.getByRole("button", { name: "Olive" }).click();
    await expect(page.getByText("SKU KRT-CLASSIC-L-OLIVE")).toBeVisible();
    await expect(page.getByRole("button", { name: "Out of stock" })).toBeDisabled(); // L / Olive has no stock in the sample data
    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    expect(JSON.parse(jsonLd!)).toMatchObject({ "@type": "Product", name: "Classic Cotton Kurti", offers: { priceCurrency: "BDT" } });
  });

  // Storefront slugs are looked up while streaming, so the status is 200 with a noindex not-found page (D-020).
  test("unknown products, categories and brands show a noindex not-found page", async ({ page }) => {
    for (const path of ["/products/does-not-exist", "/categories/does-not-exist", "/brands/does-not-exist"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Page not found" }), path).toBeVisible();
      await expect(page.locator('meta[name="robots"][content*="noindex"]').first(), path).toBeAttached();
    }
  });

  test("sitemap lists published products only", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("/products/classic-cotton-kurti");
    expect(xml).not.toContain("linen-cushion-cover");
  });
});

test.describe("admin catalog", () => {
  test.use({ storageState: OWNER_STATE });

  test("create a gadget, see validation, publish it and find it in the store", async ({ page }) => {
    const title = `Test Speaker ${Date.now()}`;
    await page.goto("/admin/catalog/products/new");
    await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
    await chooseCategory(page, "Audio");
    await page.getByLabel("price for Default").fill("2500");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Model is required")).toBeVisible();

    await page.getByRole("textbox", { name: "Model" }).fill("TS-1");
    await page.getByRole("textbox", { name: "Warranty (months)" }).fill("12");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft created")).toBeVisible();

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Published.")).toBeVisible();
    const slug = (await page.locator("text=/products/").first().textContent())!.trim().replace("/products/", "");

    await page.goto(`/products/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("৳2,500.00").first()).toBeVisible();
  });

  test("apparel variants are generated from selected sizes", async ({ page }) => {
    await page.goto("/admin/catalog/products/new");
    await page.getByRole("textbox", { name: "Title", exact: true }).fill(`Test Polo ${Date.now()}`);
    await chooseCategory(page, "Men's clothing");
    await page.getByRole("textbox", { name: "Material" }).fill("Pique cotton");
    // Scoped to the page body: the sidebar logo is the store initial ("L" for Luxe).
    await page.getByRole("main").getByText("M", { exact: true }).click();
    await page.getByRole("main").getByText("L", { exact: true }).click();
    await expect(page.getByLabel("price for M")).toBeVisible();
    await expect(page.getByLabel("price for L")).toBeVisible();
    await page.getByRole("textbox", { name: "Set price for all variants (৳)" }).fill("950");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft created")).toBeVisible();
    await expect(page.getByLabel("price for M")).toHaveValue("950");
    await expect(page.getByLabel("price for L")).toHaveValue("950");
  });

  test("upload a product image and serve it with safe headers", async ({ page, request }) => {
    await page.goto("/admin/catalog/products?q=MUG");
    await page.getByRole("link", { name: "Stoneware Mug Set of 4" }).click();
    await expect(page.locator('img[src^="/media/products/"]').first()).toBeVisible(); // seeded sample photo (.jpg)
    await page.locator("#media-upload").setInputFiles({ name: "mug.png", mimeType: "image/png", buffer: PNG_1X1 });
    // Stored keys take their extension from the detected content, so the upload is the .png thumbnail.
    const thumb = page.locator('img[src^="/media/products/"][src$=".png"]').first();
    const src = await thumb.getAttribute("src");
    const response = await request.get(src!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["content-security-policy"]).toContain("sandbox");
  });

  test("rejects non-image uploads by content", async ({ page }) => {
    await page.goto("/admin/catalog/products?q=MUG");
    await page.getByRole("link", { name: "Stoneware Mug Set of 4" }).click();
    await page.locator("#media-upload").setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)>") });
    await expect(page.getByText("is not a JPEG, PNG or WebP image")).toBeVisible();
  });

  test("media uploads reject cross-origin requests", async ({ page }) => {
    const response = await page.request.post("/admin/catalog/products/whatever/media", {
      headers: { origin: "https://evil.example" },
      multipart: { files: { name: "x.png", mimeType: "image/png", buffer: PNG_1X1 } },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(403);
  });

  test("exports the catalog as CSV", async ({ page }) => {
    await page.goto("/admin/catalog/products/import");
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download CSV" }).click();
    const file = await download;
    const text = await (await file.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString("utf8"));
    expect(text).toContain("product_slug,title,category_slug");
    expect(text).toContain("KRT-CLASSIC-M-NAVY");
  });
});


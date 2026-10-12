import { expect, test } from "@playwright/test";

test("homepage renders every section from content and real catalog data", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cart" }).first()).toBeVisible();
  // Seeded (sample) homepage content.
  await expect(page.getByText("Sample notice: free delivery outside Dhaka", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Everyday Essentials for Modern Living" })).toBeVisible();
  // Category strip and product cards come from the catalog.
  await expect(page.getByRole("navigation", { name: "Shop by category" }).getByRole("link", { name: "Skincare" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Hydrating Face Serum 30 ml" }).first()).toBeAttached();
  // The countdown is tied to the real SEASON15 coupon end date.
  const offer = page.getByRole("region", { name: "Current offer" });
  await expect(offer).toContainText("SEASON15");
  await expect(offer.getByText("Days")).toBeVisible();
  // Store figures are computed: never the reference design's invented "2K+ happy customers".
  await expect(page.getByText("Products available", { exact: false })).toBeVisible();
  await expect(page.getByText("Happy customers", { exact: false })).toHaveCount(0);
});

test("shipping and returns page shows configured delivery zones", async ({ page }) => {
  await page.goto("/shipping-returns");
  await expect(page.getByRole("heading", { name: "Shipping & returns", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inside Dhaka (sample)" })).toBeVisible();
  await expect(page.getByText("Free on orders of ৳5,000.00 or more", { exact: false })).toBeVisible();
});

test("newsletter sign-up is stored without promising an email", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await footer.getByRole("textbox", { name: "Email address" }).fill(`news-${Date.now()}@example.test`);
  await footer.getByRole("button", { name: "Subscribe" }).click();
  await expect(footer.getByRole("status")).toContainText("you are on the list");
});

test("search submits as a plain GET form and echoes the query", async ({ page, isMobile }) => {
  await page.goto(isMobile ? "/search" : "/");
  if (!isMobile) {
    await page.getByLabel("Search", { exact: true }).click();
    await page.getByRole("searchbox", { name: "Search products" }).first().fill("serum");
    await page.keyboard.press("Enter");
  } else {
    await page.goto("/search?q=serum");
  }
  await expect(page).toHaveURL(/\/search\?q=serum/);
  await expect(page.getByText("Results for")).toContainText("serum");
  await expect(page.getByRole("main").getByRole("link", { name: "Hydrating Face Serum 30 ml" })).toBeVisible();
});

test("mobile menu opens and closes", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Close menu" }).click();
  await expect(menu).toBeHidden();
});

test("security headers are set", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("health endpoint reports database status", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: "ok", database: "ok" });
});

test("unknown pages return 404", async ({ page }) => {
  const response = await page.goto("/definitely-not-a-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

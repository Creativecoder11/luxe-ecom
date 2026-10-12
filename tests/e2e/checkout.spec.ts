import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE, uniqueEmail } from "./helpers";

/** A valid, unique-enough Bangladeshi mobile number per test run. */
function phone() {
  return `017${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
}

async function fillCheckout(page: Page, district: string) {
  await page.getByRole("textbox", { name: "Full name", exact: true }).fill("Test Buyer");
  await page.getByRole("textbox", { name: "Mobile number" }).fill(phone());
  await page.getByRole("combobox", { name: "District" }).selectOption(district);
  await page.getByRole("textbox", { name: "Upazila / thana" }).fill("Test Upazila");
  await page.getByRole("textbox", { name: "House, road and landmark" }).fill("House 1, Road 2");
}

test("guest buys with a coupon and Cash on Delivery; staff see the order", async ({ page, browser }) => {
  await page.goto("/products/wireless-earbuds-pro");
  await expect(page.getByText(/^(In stock|Only \d+ left)$/)).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText("Added to your cart.")).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByRole("main").getByRole("link", { name: "Wireless Earbuds Pro" })).toBeVisible();
  await page.getByRole("textbox", { name: "Coupon code" }).fill("welcome10");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Discount")).toBeVisible();
  await page.getByRole("link", { name: "Checkout" }).click();

  await expect(page).toHaveURL(/\/checkout$/);
  await fillCheckout(page, "rajshahi");
  await expect(page.getByText("Rest of Bangladesh (sample)")).toBeVisible();
  await expect(page.getByText("Estimated delivery: 2–4 days")).toBeVisible();
  // 3,499 − 10% (capped at ৳500 → ৳349.90) + ৳120 delivery
  await expect(page.getByText("৳3,269.10")).toBeVisible();
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(page).toHaveURL(/\/checkout\/success\//);
  await expect(page.getByRole("heading", { name: "Thank you, your order is placed" })).toBeVisible();
  const number = (await page.locator("text=/ORD-\\d{6}-\\d{4}/").first().textContent())!.match(/ORD-\d{6}-\d{4}/)![0];

  const admin = await (await browser.newContext({ storageState: OWNER_STATE })).newPage();
  await admin.goto(`/admin/orders?q=${number}`);
  await expect(admin.getByRole("link", { name: number })).toBeVisible();
  await admin.getByRole("link", { name: number }).click();
  await expect(admin).toHaveURL(/\/admin\/orders\/[^/?]+$/);
  // The list page stays mounted (hidden) after navigating, and its filters contain the same labels.
  await expect(admin.getByText("Awaiting confirmation").filter({ visible: true }).first()).toBeVisible();
  await expect(admin.getByText("Cash on Delivery · not yet paid").filter({ visible: true })).toBeVisible();
  await admin.context().close();
});

test("out-of-stock variants cannot be added", async ({ page }) => {
  await page.goto("/products/classic-cotton-kurti");
  await page.getByRole("button", { name: "L", exact: true }).click();
  await page.getByRole("button", { name: "Olive" }).click();
  await expect(page.getByText("Out of stock").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Out of stock" })).toBeDisabled();
});

test("empty cart cannot reach checkout", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByText("Your cart is empty")).toBeVisible();
});

test("a signed-in customer's order appears in My orders", async ({ page }) => {
  await page.goto("/register?next=/products/stoneware-mug-set-of-4");
  await page.getByRole("textbox", { name: "Full name", exact: true }).fill("Order Tester");
  await page.getByRole("textbox", { name: "Mobile number", exact: true }).fill(phone());
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(uniqueEmail("buyer"));
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("buyer-password-1");
  await page.getByRole("textbox", { name: "Confirm password", exact: true }).fill("buyer-password-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/products\/stoneware-mug-set-of-4$/);

  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText("Added to your cart.")).toBeVisible();
  await page.goto("/checkout");
  await expect(page.getByRole("textbox", { name: "Full name", exact: true })).toHaveValue("Order Tester");
  await page.getByRole("combobox", { name: "District" }).selectOption("dhaka");
  await page.getByRole("textbox", { name: "Upazila / thana" }).fill("Dhanmondi");
  await page.getByRole("textbox", { name: "House, road and landmark" }).fill("Road 27, House 5");
  await expect(page.getByText("Inside Dhaka (sample)")).toBeVisible();
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/checkout\/success\//);

  await page.goto("/account/orders");
  await expect(page.getByText(/ORD-\d{6}-\d{4}/)).toBeVisible();
  await page.getByRole("link", { name: /ORD-/ }).first().click();
  await expect(page.getByText("Stoneware Mug Set of 4")).toBeVisible();
  await expect(page.getByText("Awaiting confirmation").first()).toBeVisible();
});

test.describe("admin commerce settings", () => {
  test.use({ storageState: OWNER_STATE });

  test("VAT, COD, delivery zones, inventory and coupons pages work", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(page.getByRole("combobox", { name: "Catalog prices" })).toBeVisible();
    await expect(page.getByText("Cash on Delivery", { exact: true }).first()).toBeVisible();
    await page.getByRole("link", { name: "Delivery zones and fees" }).click();
    await expect(page.getByRole("link", { name: "Inside Dhaka (sample)" })).toBeVisible();
    await page.goto("/admin/inventory?filter=out");
    await expect(page.getByText("KRT-CLASSIC-L-OLIVE")).toBeVisible();
    await page.goto("/admin/marketing/coupons");
    await expect(page.getByRole("link", { name: "WELCOME10" })).toBeVisible();
  });
});

test("add to cart opens the cart drawer with the product image, subtotal and free-delivery progress", async ({ page }) => {
  await page.goto("/products/hydrating-face-serum-30-ml");
  await page.getByRole("button", { name: "Add to cart" }).click();
  const drawer = page.getByRole("dialog", { name: "Shopping cart" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Added to your cart.")).toBeVisible();
  const items = drawer.getByRole("list", { name: "Cart items" });
  await expect(items.getByRole("link", { name: "Hydrating Face Serum 30 ml" })).toBeVisible();
  await expect(items.locator('img[src*="%2Fmedia%2Fproducts%2F"]')).toBeVisible(); // sample photo, via next/image
  await expect(drawer).toContainText("Subtotal:");
  await expect(drawer).toContainText("৳1,250.00");
  // Seeded "Rest of Bangladesh (sample)" zone: free delivery from ৳5,000 → ৳3,750 to go.
  await expect(drawer.getByText("৳3,750.00", { exact: true })).toBeVisible();
  await expect(drawer.getByRole("progressbar", { name: "Progress to free delivery" })).toHaveAttribute("aria-valuenow", "25");

  await drawer.getByRole("button", { name: "Close" }).click();
  await expect(drawer).toBeHidden();

  // The header cart icon reopens the drawer; removing the line empties it.
  await page.getByRole("banner").getByRole("link", { name: "Cart" }).click();
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "Remove Hydrating Face Serum 30 ml" }).click();
  await expect(drawer.getByText("Your cart is empty.")).toBeVisible();
});

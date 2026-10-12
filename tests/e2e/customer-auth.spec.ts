import { expect, test } from "@playwright/test";
import { formAlert, uniqueEmail } from "./helpers";

test("account pages redirect anonymous visitors to sign-in with a return path", async ({ page }) => {
  await page.goto("/account/profile");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Fprofile$/);
});

test("customer registers, edits profile, signs out and signs back in", async ({ page }) => {
  const email = uniqueEmail("shopper");
  await page.goto("/register");
  await page.getByRole("textbox", { name: "Full name", exact: true }).fill("Ayesha Rahman");
  await page.getByRole("textbox", { name: "Mobile number", exact: true }).fill("01812345678");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("shopper-password-1");
  await page.getByRole("textbox", { name: "Confirm password", exact: true }).fill("shopper-password-1");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText("Welcome, Ayesha Rahman")).toBeVisible();
  await expect(page.getByText("01812••••78")).toBeVisible();

  await page.goto("/account/profile");
  await page.getByRole("textbox", { name: "Full name", exact: true }).fill("Ayesha R.");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("wrong-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(formAlert(page)).toContainText("Incorrect email or password");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("shopper-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText("Welcome, Ayesha R.")).toBeVisible();
});

test("registration validates Bangladesh mobile numbers and matching passwords", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("textbox", { name: "Full name", exact: true }).fill("Test User");
  await page.getByRole("textbox", { name: "Mobile number", exact: true }).fill("12345");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(uniqueEmail("bad"));
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("shopper-password-1");
  await page.getByRole("textbox", { name: "Confirm password", exact: true }).fill("different-password-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Passwords do not match")).toBeVisible();
});

test("staff credentials cannot be used on the customer sign-in", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(process.env.SEED_OWNER_EMAIL ?? "owner@example.test");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(process.env.SEED_OWNER_PASSWORD ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(formAlert(page)).toContainText("Incorrect email or password");
});

test("forgot-password is honest about email not being configured", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(page.getByText("Email is not configured")).toBeVisible();
});

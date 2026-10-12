import { expect, type Page } from "@playwright/test";

export const OWNER_STATE = "playwright/.auth/owner.json";

export const OWNER = {
  email: process.env.SEED_OWNER_EMAIL ?? "owner@example.test",
  password: process.env.SEED_OWNER_PASSWORD ?? "",
};

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

export async function staffLogin(page: Page, email = OWNER.email, password = OWNER.password) {
  await page.goto("/admin/login");
  await page.getByRole("textbox", { name: "Work email" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Form-level alerts live in <main>; Next.js also renders a route announcer with role="alert". */
export function formAlert(page: Page) {
  return page.locator("main").getByRole("alert");
}

export { expect };

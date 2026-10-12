import { expect, test as setup } from "@playwright/test";
import { OWNER, OWNER_STATE } from "./helpers";

// Loads each route once so the first tests do not all hit a cold server at the same moment
// (the equivalent of a readiness/warm-up probe before taking production traffic).
const WARM_ROUTES = ["/", "/shop", "/search?q=x", "/cart", "/login", "/register", "/forgot-password", "/admin/login", "/styleguide"];

setup("warm up and sign in as the seeded owner", async ({ page, request }) => {
  for (const route of WARM_ROUTES) expect((await request.get(route)).status(), route).toBeLessThan(500);

  await page.goto("/admin/login");
  await page.getByRole("textbox", { name: "Work email" }).fill(OWNER.email);
  await page.getByRole("textbox", { name: "Password" }).fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  for (const route of ["/admin/staff", "/admin/staff/roles", "/admin/audit-logs", "/admin/orders"]) {
    await page.goto(route);
  }
  await page.context().storageState({ path: OWNER_STATE });
});

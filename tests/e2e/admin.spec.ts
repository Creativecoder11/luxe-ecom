import { expect, test } from "@playwright/test";
import { formAlert, OWNER_STATE, staffLogin, uniqueEmail } from "./helpers";

test("unauthenticated admin requests redirect to staff sign-in", async ({ page }) => {
  await page.goto("/admin/staff");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("heading", { name: "Staff sign-in" })).toBeVisible();
});

test("unknown and unreleased admin URLs return a real 404, signed in or not", async ({ request }) => {
  for (const path of ["/admin/pos", "/admin/hr", "/admin/not-a-module", "/account/not-a-section"]) {
    expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(404);
  }
});

test("wrong password shows a generic error", async ({ page }) => {
  await staffLogin(page, "owner@example.test", "definitely-wrong-password");
  await expect(formAlert(page)).toContainText("Incorrect email or password");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test.describe("signed in as owner", () => {
  test.use({ storageState: OWNER_STATE });

test("dashboard figures come from records; untracked metrics say so", async ({ page }) => {
  await page.goto("/admin?kpi=all");
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeAttached();
  const sales = page.getByRole("region", { name: "Sales", exact: true });
  await expect(sales.getByText("Gross sales")).toBeVisible();
  await expect(sales).toContainText("৳");
  await expect(page.getByText("Not tracked yet: needs storefront visit analytics.")).toBeVisible();
  await expect(page.getByText("Needs expense tracking (Finance).")).toBeVisible();
  // Catalog cards are counted from the catalog (other tests add records, so only the shape is checked).
  await expect(page.getByRole("region", { name: "Total categories" })).toContainText(/\d{2,}/);
  await expect(page.getByRole("region", { name: "Out of stock" })).toContainText("Low stock");
  // Every chart offers a table view.
  await expect(page.getByText("View as table").first()).toBeVisible();
  // Range menus are plain links.
  await page.getByRole("region", { name: "Order status" }).locator("summary").click();
  await page.getByRole("link", { name: "All time" }).click();
  await expect(page).toHaveURL(/status=all/);
});

test("homepage settings save a section and the storefront shows it", async ({ page }) => {
  await page.goto("/admin/content");
  await expect(page.getByRole("heading", { name: "Homepage settings", level: 1 })).toBeVisible();
  const statement = page.locator("#section-statement");
  const text = `Statement ${Date.now()}`;
  await statement.getByRole("textbox", { name: "Statement" }).fill(text);
  await statement.getByRole("button", { name: "Save statement & figures" }).click();
  await expect(statement.getByText("Saved. The storefront shows the change now.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(text)).toBeVisible();

  // Unsafe links are rejected with a field error and the typed values stay in the form.
  await page.goto("/admin/content");
  const heroes = page.locator("#section-heroes");
  await heroes.getByRole("textbox", { name: "Title" }).first().fill("Bad link");
  await heroes.getByRole("textbox", { name: "Link" }).first().fill("javascript:alert(1)");
  await heroes.getByRole("button", { name: "Save hero banners" }).click();
  await expect(heroes.getByText("Use a path such as /shop or a full https:// address.")).toBeVisible();
  await expect(heroes.getByRole("textbox", { name: "Title" }).first()).toHaveValue("Bad link");

  // Banner images upload through the route handler and preview from /media/content/….
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await heroes.locator('input[type="file"]').first().setInputFiles({ name: "hero.png", mimeType: "image/png", buffer: png });
  await expect(heroes.locator('img[src^="/media/content/"]').first()).toBeVisible();
});

test("planned modules are labelled; Release 2/3 modules are not links", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop sidebar");
  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "Admin" });
  await nav.getByRole("button", { name: "Sales" }).click();
  await nav.getByRole("link", { name: "Returns" }).click();
  await expect(page).toHaveURL(/\/admin\/returns$/);
  await expect(page.getByRole("note")).toContainText("Nothing here is functional yet");
  await expect(nav.getByRole("link", { name: "POS" })).toHaveCount(0);
});

test("sidebar collapse persists across reloads", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop sidebar");
  await page.goto("/admin");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-sidebar", "collapsed");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-sidebar", "collapsed");
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-sidebar", "collapsed");
});

test("mobile admin navigation drawer", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.goto("/admin");
  await page.getByRole("button", { name: "Open navigation" }).click();
  const drawer = page.getByRole("dialog", { name: "Admin navigation" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "System" }).click();
  await drawer.getByRole("link", { name: "Staff & roles" }).click();
  await expect(page).toHaveURL(/\/admin\/staff$/);
  await expect(drawer).toBeHidden();
});

test("owner creates a staff member who must change the temporary password and is limited by role", async ({ page, browser }) => {
  await page.goto("/admin");
  await page.goto("/admin/staff");
  const email = uniqueEmail("agent");
  await page.getByRole("textbox", { name: "Full name" }).fill("Order Agent");
  await page.getByRole("textbox", { name: "Work email" }).fill(email);
  await page.getByRole("combobox", { name: "Role", exact: true }).selectOption({ label: "Order agent" });
  await page.getByRole("button", { name: "Create staff account" }).click();
  const tempAlert = page.getByRole("status").filter({ hasText: "Temporary password" });
  await expect(tempAlert).toBeVisible();
  const temporaryPassword = (await tempAlert.locator("code").textContent())?.trim() ?? "";
  expect(temporaryPassword.length).toBeGreaterThanOrEqual(20);
  await expect(page.getByRole("cell", { name: email })).toBeVisible();

  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const agent = await context.newPage();
  await staffLogin(agent, email, temporaryPassword);
  await expect(agent).toHaveURL(/\/admin\/change-password$/);
  await agent.goto("/admin");
  await expect(agent).toHaveURL(/\/admin\/change-password$/);
  await agent.getByRole("textbox", { name: "Current password" }).fill(temporaryPassword);
  await agent.getByRole("textbox", { name: "New password", exact: true }).fill("agent-new-password-1");
  await agent.getByRole("textbox", { name: "Confirm new password" }).fill("agent-new-password-1");
  await agent.getByRole("button", { name: "Update password" }).click();
  await expect(agent).toHaveURL(/\/admin$/);

  await agent.goto("/admin/staff");
  await expect(agent.getByText("You don't have access to this page")).toBeVisible();
  await agent.goto("/admin/audit-logs");
  await expect(agent.getByText("You don't have access to this page")).toBeVisible();
  await context.close();

  await page.goto("/admin/audit-logs?action=staff.");
  await expect(page.getByText("staff.created").first()).toBeVisible();
});
});

// Uses its own sign-in: signing out revokes the session server-side, so the shared owner session must not be used.
test("signing out ends the staff session", async ({ page }) => {
  await staffLogin(page);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByLabel(/Account menu for/).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

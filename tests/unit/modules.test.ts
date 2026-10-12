import { describe, expect, it } from "vitest";
import { isPermission } from "@/modules/identity/permissions";
import { accountSections, adminHref, adminModules, isKnownShellPath, isNavigable } from "@/config/modules";

describe("module registry", () => {
  it("has unique keys and paths", () => {
    const keys = adminModules.map((m) => m.key);
    const paths = adminModules.map((m) => m.path);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(accountSections.map((s) => s.href)).size).toBe(accountSections.length);
  });

  it("never exposes unbuilt Release 2/3 modules as navigable (PRD §18)", () => {
    for (const m of adminModules.filter((mod) => mod.release > 1)) {
      if (m.status === "planned") expect(isNavigable(m), m.key).toBe(false);
    }
  });

  it("only claims modules that are genuinely implemented", () => {
    // Update this list deliberately when a module is implemented and covered by tests.
    const claimed = adminModules.filter((m) => m.status === "implemented" || m.status === "tested");
    expect(claimed.map((m) => m.key).sort()).toEqual(["attributes", "audit-logs", "brands", "categories", "coupons", "inventory", "products", "purchasing", "staff"]);
  });

  it("guards every module with a real permission", () => {
    for (const m of adminModules) expect(isPermission(m.permission), m.key).toBe(true);
  });

  it("builds admin hrefs", () => {
    expect(adminHref({ path: "" })).toBe("/admin");
    expect(adminHref({ path: "catalog/products" })).toBe("/admin/catalog/products");
  });
});

describe("isKnownShellPath", () => {
  it.each(["/admin", "/admin/", "/admin/orders", "/admin/login", "/admin/staff/roles/abc", "/admin/catalog/products", "/admin/catalog/products/import", "/admin/catalog/products/abc123", "/account", "/account/orders", "/account/orders/ORD-261012-0001", "/shop"])(
    "allows %s",
    (path) => expect(isKnownShellPath(path)).toBe(true),
  );

  it.each(["/admin/pos", "/admin/hr", "/admin/nope", "/admin/returns/123", "/admin/catalog", "/admin/catalog/brandsx", "/account/nope", "/account/returns/x"])(
    "rejects %s",
    (path) => expect(isKnownShellPath(path)).toBe(false),
  );
});

import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it.each(["/account", "/account/orders?x=1", "/shop"])("allows %s", (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/admin", "", null, 42])(
    "rejects %s",
    (value) => {
      expect(safeRedirectPath(value)).toBe("/account");
    },
  );
});

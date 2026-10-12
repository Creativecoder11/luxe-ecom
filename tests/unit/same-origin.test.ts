import { describe, expect, it } from "vitest";
import { isSameOrigin } from "@/lib/security/same-origin";

const req = (origin: string | null, host = "shop.example") =>
  new Request("https://shop.example/admin/x", { method: "POST", headers: { ...(origin ? { origin } : {}), host } });

describe("isSameOrigin", () => {
  it("accepts the app origin", () => {
    expect(isSameOrigin(req("https://shop.example"), "https://shop.example")).toBe(true);
  });
  it("rejects missing, foreign and look-alike origins", () => {
    expect(isSameOrigin(req(null), "https://shop.example")).toBe(false);
    expect(isSameOrigin(req("https://evil.example"), "https://shop.example")).toBe(false);
    expect(isSameOrigin(req("https://shop.example.evil.com"), "https://shop.example")).toBe(false);
    expect(isSameOrigin(req("null"), "https://shop.example")).toBe(false);
  });
});

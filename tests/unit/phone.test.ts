import { describe, expect, it } from "vitest";
import { maskPhone, normalizeBdMobile, toLatinDigits } from "@/lib/phone";

describe("normalizeBdMobile", () => {
  it.each([
    ["01712345678", "+8801712345678"],
    ["+8801712345678", "+8801712345678"],
    ["8801712345678", "+8801712345678"],
    ["008801712345678", "+8801712345678"],
    ["017-1234 5678", "+8801712345678"],
    ["(017) 1234-5678", "+8801712345678"],
    ["০১৭১২৩৪৫৬৭৮", "+8801712345678"],
    ["01312345678", "+8801312345678"],
  ])("normalizes %s", (input, e164) => {
    const result = normalizeBdMobile(input);
    expect(result).toEqual({ ok: true, e164, national: `0${e164.slice(4)}` });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["01212345678", "invalid_bd_mobile"], // 012 is not a mobile prefix
    ["0171234567", "invalid_bd_mobile"], // too short
    ["017123456789", "invalid_bd_mobile"], // too long
    ["+447911123456", "invalid_bd_mobile"],
    ["0171abc5678", "invalid_characters"],
  ])("rejects %s", (input, reason) => {
    expect(normalizeBdMobile(input)).toEqual({ ok: false, reason });
  });

  it("converts Bangla digits", () => {
    expect(toLatinDigits("০১২৩৪৫৬৭৮৯")).toBe("0123456789");
  });

  it("masks phone numbers for staff without PII permission", () => {
    expect(maskPhone("+8801712345678")).toBe("01712••••78");
    expect(maskPhone("01712345678")).toBe("01712••••78");
  });
});

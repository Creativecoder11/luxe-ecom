import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsv } from "@/lib/csv";

describe("CSV export safety", () => {
  it.each(["=SUM(A1:A9)", "+8801712345678", "-2+3", "@cmd", "\t=1", "\r=1"])(
    "neutralises formula trigger in %j",
    (value) => {
      expect(escapeCsvCell(value).replace(/^"/, "").startsWith("'")).toBe(true);
    },
  );

  it("does not alter numbers, including negatives", () => {
    expect(escapeCsvCell(-250)).toBe("-250");
    expect(escapeCsvCell(1250.5)).toBe("1250.5");
    expect(escapeCsvCell(Number.NaN)).toBe("");
  });

  it("quotes separators, quotes and newlines", () => {
    expect(escapeCsvCell('Dhaka, "Gulshan"')).toBe('"Dhaka, ""Gulshan"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("renders nulls, booleans and dates", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell(true)).toBe("true");
    expect(escapeCsvCell(new Date("2026-10-11T00:00:00Z"))).toBe("2026-10-11T00:00:00.000Z");
  });

  it("builds a UTF-8 BOM CSV with CRLF line endings", () => {
    const csv = toCsv(
      [{ name: "=HYPERLINK()", city: "ঢাকা" }],
      [
        { header: "Name", value: (r) => r.name },
        { header: "City", value: (r) => r.city },
      ],
    );
    expect(csv).toBe("﻿Name,City\r\n'=HYPERLINK(),ঢাকা\r\n");
  });
});

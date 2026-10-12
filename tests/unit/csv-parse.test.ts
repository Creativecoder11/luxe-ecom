import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";
import { CsvParseError, parseCsv, parseCsvRecords } from "@/lib/csv-parse";

describe("CSV parsing", () => {
  it("handles quotes, escaped quotes, embedded newlines, CRLF and BOM", () => {
    const input = '﻿a,b,c\r\n"x, y","He said ""hi""","line1\nline2"\r\nplain,,last\n';
    expect(parseCsvRecords(input)).toEqual([
      ["a", "b", "c"],
      ["x, y", 'He said "hi"', "line1\nline2"],
      ["plain", "", "last"],
    ]);
  });

  it("maps rows to headers and restores formula-guarded cells", () => {
    const { headers, rows } = parseCsv("title,note\nLipstick,'=SUM(A1)\n");
    expect(headers).toEqual(["title", "note"]);
    expect(rows).toEqual([{ title: "Lipstick", note: "=SUM(A1)" }]);
  });

  it("round-trips our own export format", () => {
    const data = [{ t: 'Kurti, "classic"', n: "+8801712345678", b: "ঢাকা" }];
    const csv = toCsv(data, [
      { header: "t", value: (r) => r.t },
      { header: "n", value: (r) => r.n },
      { header: "b", value: (r) => r.b },
    ]);
    expect(parseCsv(csv).rows).toEqual(data);
  });

  it("rejects malformed files with clear messages", () => {
    expect(() => parseCsv("")).toThrow(CsvParseError);
    expect(() => parseCsv('a,b\n"unclosed,1\n')).toThrow(/not closed/);
    expect(() => parseCsv("a,b\n1,2,3\n")).toThrow(/Row 2 has 3 columns/);
    expect(() => parseCsv("a,a\n1,2\n")).toThrow(/unique/);
    expect(() => parseCsv("a\n1\n2\n3\n", { maxRows: 2 })).toThrow(/limit is 2/);
  });
});

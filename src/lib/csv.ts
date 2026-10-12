/**
 * CSV generation with spreadsheet formula-injection protection (SRS §10).
 * Any text cell beginning with = + - @ tab or carriage return is prefixed with an apostrophe
 * so spreadsheet applications treat it as text instead of executing it.
 */

export type CsvValue = string | number | boolean | Date | null | undefined;

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text: string;
  if (value instanceof Date) text = value.toISOString();
  else if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    text = String(value);
  } else if (typeof value === "boolean") text = value ? "true" : "false";
  else {
    text = value;
    if (FORMULA_TRIGGER.test(text)) text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface CsvColumn<Row> {
  header: string;
  value: (row: Row) => CsvValue;
}

export function toCsv<Row>(rows: readonly Row[], columns: readonly CsvColumn<Row>[]): string {
  const lines = [columns.map((c) => escapeCsvCell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => escapeCsvCell(c.value(row))).join(","));
  // CRLF per RFC 4180; BOM so Excel opens UTF-8 (Bangla text) correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}

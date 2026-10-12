/**
 * RFC 4180 CSV parsing: quoted fields, escaped quotes (""), embedded newlines, CRLF/LF, UTF-8 BOM.
 * Cells written by our formula-injection guard ("'=…") are restored on read.
 */
export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export class CsvParseError extends Error {}

const GUARDED = /^'[=+\-@\t\r]/;

export function parseCsvRecords(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      if (field.length > 0) throw new CsvParseError(`Unexpected quote in an unquoted field (record ${records.length + 1}).`);
      inQuotes = true;
    } else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      if (ch === "\r" && text[i + 1] === "\n") i++;
    } else {
      field += ch;
    }
    i++;
  }
  if (inQuotes) throw new CsvParseError("A quoted field is not closed.");
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records.filter((r) => !(r.length === 1 && r[0] === ""));
}

export function parseCsv(input: string, options: { maxRows?: number } = {}): ParsedCsv {
  const records = parseCsvRecords(input);
  const [headerRow, ...body] = records;
  if (!headerRow) throw new CsvParseError("The file is empty.");
  const headers = headerRow.map((h) => h.trim());
  if (new Set(headers).size !== headers.length) throw new CsvParseError("Column names must be unique.");
  if (options.maxRows !== undefined && body.length > options.maxRows) {
    throw new CsvParseError(`The file has ${body.length} rows; the limit is ${options.maxRows}.`);
  }
  const rows = body.map((cells, index) => {
    if (cells.length !== headers.length) {
      throw new CsvParseError(`Row ${index + 2} has ${cells.length} columns; the header has ${headers.length}.`);
    }
    return Object.fromEntries(headers.map((h, j) => [h, GUARDED.test(cells[j]!) ? cells[j]!.slice(1) : cells[j]!]));
  });
  return { headers, rows };
}

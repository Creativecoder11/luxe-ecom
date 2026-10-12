/**
 * Bangladesh mobile number handling. Customers are deduplicated by the normalized E.164 form,
 * so every phone number entering the system must pass through `normalizeBdMobile`.
 */

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Valid BD mobile operator prefixes after the leading 1: 013–019. */
const BD_MOBILE = /^1[3-9]\d{8}$/;

export type PhoneParseResult =
  | { ok: true; e164: string; national: string }
  | { ok: false; reason: "empty" | "invalid_characters" | "invalid_bd_mobile" };

export function toLatinDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));
}

export function normalizeBdMobile(input: string): PhoneParseResult {
  const latin = toLatinDigits(input).trim();
  if (latin === "") return { ok: false, reason: "empty" };
  if (!/^\+?[\d\s\-().]+$/.test(latin)) return { ok: false, reason: "invalid_characters" };

  let digits = latin.replace(/\D/g, "");
  if (digits.startsWith("00880")) digits = digits.slice(5);
  else if (digits.startsWith("880")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  if (!BD_MOBILE.test(digits)) return { ok: false, reason: "invalid_bd_mobile" };
  return { ok: true, e164: `+880${digits}`, national: `0${digits}` };
}

/** Masks a phone number for staff without PII permission: +8801712345678 → 01712••••78 */
export function maskPhone(e164OrNational: string): string {
  const parsed = normalizeBdMobile(e164OrNational);
  const national = parsed.ok ? parsed.national : e164OrNational.replace(/\D/g, "");
  if (national.length < 6) return "•".repeat(national.length);
  return `${national.slice(0, 5)}${"•".repeat(national.length - 7)}${national.slice(-2)}`;
}

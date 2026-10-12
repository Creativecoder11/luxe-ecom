/**
 * URL slugs: lowercase ASCII letters, digits and single hyphens. Text without any ASCII
 * letters or digits (e.g. Bangla-only names) yields "" so callers can require a manual slug.
 */
export function slugify(input: string, maxLength = 80): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(value: string): boolean {
  return value.length >= 2 && value.length <= 80 && SLUG_PATTERN.test(value);
}

/** Valid URL slug: lowercase alphanumeric segments separated by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/** Generate a slug from a display name (lowercase, hyphenated). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/**
 * Resolve slug from optional explicit value or name.
 * Returns null if empty/invalid after normalization.
 */
export function resolveSlug(name: string, slug?: string | null): string | null {
  const raw = slug != null && String(slug).trim() !== "" ? String(slug).trim() : slugify(name);
  if (!raw || !isValidSlug(raw)) return null;
  return raw;
}

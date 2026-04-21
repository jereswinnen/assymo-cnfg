const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Normalise a free-form string into a slug-candidate: lowercase, trim,
 *  replace non-[a-z0-9] runs with a single hyphen, collapse repeats,
 *  trim leading/trailing hyphens. Callers should then validate with
 *  `isValidSlug` before persisting. */
export function normalizeSlug(input: string): string {
  const lower = input.toLowerCase().trim();
  // Replace whitespace runs with a hyphen.
  const hyphenated = lower.replace(/\s+/g, '-');
  // Strip all characters outside [a-z0-9-].
  const stripped = hyphenated.replace(/[^a-z0-9-]/g, '');
  // Collapse repeated hyphens.
  const collapsed = stripped.replace(/-+/g, '-');
  // Trim leading/trailing hyphens.
  return collapsed.replace(/^-+|-+$/g, '');
}

/** True when the string matches the persisted-slug grammar (lowercase
 *  alphanumeric, single hyphens as separators, 1–48 chars). */
export function isValidSlug(slug: string): boolean {
  if (slug.length < 1 || slug.length > 48) return false;
  return SLUG_RE.test(slug);
}

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * HTML-escape a string for safe interpolation into innerHTML or
 * an attribute that will be set via innerHTML. Sufficient for both
 * element-text and attribute contexts thanks to the quote escapes.
 */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ENTITIES[c]!);
}

/**
 * Reject icon URL values that could break out of `url("...")` when
 * assigned to `style.backgroundImage`. The CSSOM normally validates
 * the value, but a defensive pre-filter on URL inputs makes the
 * threat model crystal clear: only plain http(s) URLs without
 * quote, paren, or semicolon characters are allowed.
 *
 * Returns true if safe, false if it should be replaced with the
 * placeholder fallback.
 */
export function isSafeIconUrl(url: string): boolean {
  if (!url) return true;
  if (!/^https?:\/\//i.test(url)) return false;
  if (/["'();\s]/.test(url)) return false;
  return true;
}

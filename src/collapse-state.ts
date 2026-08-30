import { categoryCollapsedByDefault } from "./category-order";

export const COLLAPSE_KEY = "obr-inv:collapsed";

export interface CollapseState {
  /** Effective collapse state: the stored override if the user has ever
   *  toggled this category, otherwise the tier default. */
  isCollapsed(cat: string): boolean;
  /** Record a user toggle and persist it. */
  set(cat: string, collapsed: boolean): void;
}

/**
 * Per-browser collapse state for the inventory's category groups.
 *
 * Only categories the user has explicitly toggled are stored, as a
 * `{ category: collapsed }` map. Storing the collapsed set verbatim would
 * make it authoritative, so a category the user has never seen — a new
 * custom category, or one added to CATEGORY_TIERS in a later release —
 * would render expanded instead of picking up its default. Overrides
 * sidestep that: untouched categories keep following the tier table.
 *
 * Client-side only. This never reaches room metadata, which is capped at
 * STORAGE_CAP_BYTES and reserved for inventory state.
 */
export function loadCollapseState(): CollapseState {
  const overrides = readOverrides();

  return {
    isCollapsed(cat) {
      return overrides.get(cat) ?? categoryCollapsedByDefault(cat);
    },
    set(cat, collapsed) {
      overrides.set(cat, collapsed);
      writeOverrides(overrides);
    },
  };
}

function readOverrides(): Map<string, boolean> {
  const out = new Map<string, boolean>();
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(COLLAPSE_KEY);
  } catch (e) {
    console.warn("[obr-inv] localStorage read failed for collapse state", e);
    return out;
  }
  if (!raw) return out;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn("[obr-inv] malformed collapse state, using defaults", e);
    return out;
  }
  // Arrays are objects too, and an array is the shape an older/naive
  // implementation would have written — reject it rather than read
  // index keys out of it.
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return out;
  }
  for (const [cat, collapsed] of Object.entries(parsed)) {
    if (typeof collapsed === "boolean") out.set(cat, collapsed);
  }
  return out;
}

function writeOverrides(overrides: Map<string, boolean>): void {
  try {
    localStorage.setItem(
      COLLAPSE_KEY, JSON.stringify(Object.fromEntries(overrides)),
    );
  } catch (e) {
    console.warn("[obr-inv] localStorage write failed for collapse state", e);
  }
}

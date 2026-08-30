import { CATEGORY_TIERS } from "./constants";

/** Rank of every category named in CATEGORY_TIERS, flattened so that
 *  tier order and within-tier order collapse into one comparable index. */
const RANKS = new Map<string, number>(
  CATEGORY_TIERS.flatMap((tier) => tier.categories).map((cat, i) => [cat, i]),
);

const COLLAPSED = new Map<string, boolean>(
  CATEGORY_TIERS.flatMap((tier) =>
    tier.categories.map((cat) => [cat, tier.collapsed] as const),
  ),
);

/** Sort key for a category group. Unlisted categories all share the same
 *  trailing rank, so callers break the tie alphabetically. */
export function categoryRank(cat: string): number {
  return RANKS.get(cat) ?? RANKS.size;
}

/** Whether a category's group starts collapsed, absent a stored user
 *  override. Unlisted categories collapse. */
export function categoryCollapsedByDefault(cat: string): boolean {
  return COLLAPSED.get(cat) ?? true;
}

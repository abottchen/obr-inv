import type { PlayerInventoryRecord } from "./types";

const norm = (s: string): string => s.trim().toLowerCase();

function hasContent(rec: PlayerInventoryRecord): boolean {
  const items = rec.items.some(([, n]) => n > 0);
  const c = rec.currency;
  return items || c.pp > 0 || c.gp > 0 || c.sp > 0 || c.cp > 0;
}

export interface HealPlan {
  targetId: string;
  sourceIds: string[];
}

/**
 * Given the target display name, the connected player's live id, and all
 * inventory records, decide which stale records to consolidate onto the live
 * id. Pure — no OBR. Returns null when there is nothing worth doing.
 */
export function planHeal(
  name: string,
  liveId: string,
  records: Record<string, PlayerInventoryRecord>,
): HealPlan | null {
  const target = norm(name);
  const candidates = Object.keys(records).filter(
    (id) => norm(records[id].name) === target,
  );
  const sourceIds = candidates.filter((id) => id !== liveId);
  if (sourceIds.length === 0) return null;
  const liveHasRecord = candidates.includes(liveId);
  // No live record and every stray is empty → nothing worth re-keying;
  // avoid churning a write every session for an empty inventory.
  if (!liveHasRecord && sourceIds.every((id) => !hasContent(records[id]))) {
    return null;
  }
  return { targetId: liveId, sourceIds };
}

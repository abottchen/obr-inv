import { STASH_ID_PREFIX } from "./constants";
import type { PlayerInventoryRecord } from "./types";

export interface StashEntry {
  id: string;
  record: PlayerInventoryRecord;
}

export function isStashId(id: string): boolean {
  return id.startsWith(STASH_ID_PREFIX);
}

function isWellFormed(record: unknown): record is PlayerInventoryRecord {
  const r = record as Partial<PlayerInventoryRecord> | null;
  return (
    typeof r?.name === "string" &&
    Array.isArray(r.items) &&
    typeof r.currency === "object" &&
    r.currency !== null
  );
}

export function selectStashes(
  records: Record<string, PlayerInventoryRecord>,
): StashEntry[] {
  return Object.entries(records)
    .filter(([id, record]) => isStashId(id) && isWellFormed(record))
    .map(([id, record]) => ({ id, record }))
    .sort((a, b) => a.record.name.localeCompare(b.record.name));
}

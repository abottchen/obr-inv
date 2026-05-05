import { atomicMultiUpdate, type AtomicUpdateOptions } from "./atomic";
import { addItem, pruneZeros } from "./inventory";
import { recordKey } from "./metadata";
import type { PlayerInventoryRecord, WriterStamp } from "./types";

export function mergeRecords(
  target: PlayerInventoryRecord,
  source: PlayerInventoryRecord,
): PlayerInventoryRecord {
  let merged = { ...target };
  for (const [itemId, qty] of source.items) {
    if (qty > 0) merged = addItem(merged, itemId, qty);
  }
  merged = {
    ...merged,
    currency: {
      pp: merged.currency.pp + source.currency.pp,
      gp: merged.currency.gp + source.currency.gp,
      sp: merged.currency.sp + source.currency.sp,
      cp: merged.currency.cp + source.currency.cp,
    },
  };
  return pruneZeros(merged);
}

export async function executeMerge(
  targetId: string,
  sourceId: string,
  opts: AtomicUpdateOptions,
): Promise<void> {
  let sourceSnapshot: PlayerInventoryRecord | null = null;

  await atomicMultiUpdate([
    {
      key: recordKey(sourceId),
      mutate: (current) => {
        sourceSnapshot = current as PlayerInventoryRecord | null;
        return null;
      },
    },
    {
      key: recordKey(targetId),
      mutate: (current) => {
        if (!current) throw new Error(`Target ${targetId} has no record`);
        if (!sourceSnapshot) throw new Error(`Source ${sourceId} has no record`);
        return mergeRecords(
          current as PlayerInventoryRecord,
          sourceSnapshot,
        ) as unknown as WriterStamp;
      },
    },
  ], opts);
}

export function findOrphans(
  selfId: string,
  selfName: string,
  records: Record<string, PlayerInventoryRecord>,
): Array<{ id: string; record: PlayerInventoryRecord }> {
  const out: Array<{ id: string; record: PlayerInventoryRecord }> = [];
  for (const [pid, rec] of Object.entries(records)) {
    if (pid === selfId) continue;
    if (rec.name !== selfName) continue;
    const hasItems = rec.items.some(([, count]) => count > 0);
    const hasCurrency = rec.currency.pp > 0 || rec.currency.gp > 0
      || rec.currency.sp > 0 || rec.currency.cp > 0;
    if (hasItems || hasCurrency) out.push({ id: pid, record: rec });
  }
  return out;
}

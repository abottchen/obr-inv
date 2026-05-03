import OBR from "@owlbear-rodeo/sdk";
import {
  CUSTOMS_KEY, METADATA_KEY_PREFIX, STORAGE_CAP_BYTES,
} from "./constants";
import type { CustomItemsEnvelope, CustomItemsRecord, PlayerInventoryRecord } from "./types";
import { OverCapError } from "./types";
import { pruneZeros } from "./inventory";

export function recordKey(playerId: string): string {
  return `${METADATA_KEY_PREFIX}${playerId}`;
}

export function isRecordKey(key: string): boolean {
  // CUSTOMS_KEY shares the v1 prefix but is not a player inventory.
  return key.startsWith(METADATA_KEY_PREFIX) && key !== CUSTOMS_KEY;
}

export function playerIdFromKey(key: string): string {
  return key.slice(METADATA_KEY_PREFIX.length);
}

export async function listInventoryRecords(): Promise<Record<string, PlayerInventoryRecord>> {
  const md = await OBR.room.getMetadata();
  const out: Record<string, PlayerInventoryRecord> = {};
  for (const [k, v] of Object.entries(md)) {
    if (!isRecordKey(k) || v == null) continue;
    const rec = v as PlayerInventoryRecord;
    out[playerIdFromKey(k)] = rec.w === undefined ? { ...rec, w: "" } : rec;
  }
  return out;
}

export async function getRecord(playerId: string): Promise<PlayerInventoryRecord | null> {
  const md = await OBR.room.getMetadata();
  const v = md[recordKey(playerId)];
  if (v == null) return null;
  const rec = v as PlayerInventoryRecord;
  return rec.w === undefined ? { ...rec, w: "" } : rec;
}

/**
 * Total byte size of all room metadata owned by this extension —
 * inventories AND the customs key. Named for the broader scope.
 * Used by the GM-side storage meter and the cap guard.
 */
export async function roomDataByteSize(): Promise<number> {
  const md = await OBR.room.getMetadata();
  const owned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(md)) {
    if (k === CUSTOMS_KEY || isRecordKey(k)) owned[k] = v;
  }
  return new TextEncoder().encode(JSON.stringify(owned)).byteLength;
}

const queues = new Map<string, Promise<unknown>>();

function enqueue<T>(key: string, op: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.then(op, op);
  queues.set(key, next.catch(() => {}));
  return next;
}

export function writeRecord(
  playerId: string, record: PlayerInventoryRecord,
): Promise<void> {
  return enqueue(recordKey(playerId), async () => {
    const pruned = pruneZeros(record);
    const md = await OBR.room.getMetadata();
    const projected: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(md)) {
      if (k.startsWith(METADATA_KEY_PREFIX)) projected[k] = v;
    }
    projected[recordKey(playerId)] = pruned;
    const projectedBytes = new TextEncoder()
      .encode(JSON.stringify(projected)).byteLength;
    if (projectedBytes > STORAGE_CAP_BYTES) {
      const currentBytes = await roomDataByteSize();
      throw new OverCapError(
        currentBytes,
        STORAGE_CAP_BYTES,
        `write record ${playerId}`,
      );
    }
    await OBR.room.setMetadata({ [recordKey(playerId)]: pruned });
  });
}

export async function deleteRecord(playerId: string): Promise<void> {
  return enqueue(recordKey(playerId), async () => {
    await OBR.room.setMetadata({ [recordKey(playerId)]: undefined });
  });
}

export async function getCustoms(): Promise<CustomItemsRecord> {
  const md = await OBR.room.getMetadata();
  const v = md[CUSTOMS_KEY];
  if (Array.isArray(v)) return v as CustomItemsRecord;
  if (v && typeof v === "object" && Array.isArray((v as { items?: unknown }).items)) {
    return ((v as CustomItemsEnvelope).items) as CustomItemsRecord;
  }
  return [];
}

export function writeCustoms(items: CustomItemsRecord): Promise<void> {
  return enqueue(CUSTOMS_KEY, async () => {
    const md = await OBR.room.getMetadata();
    const projected: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(md)) {
      if (k.startsWith(METADATA_KEY_PREFIX)) projected[k] = v;
    }
    projected[CUSTOMS_KEY] = items;
    const projectedBytes = new TextEncoder()
      .encode(JSON.stringify(projected)).byteLength;
    if (projectedBytes > STORAGE_CAP_BYTES) {
      const currentBytes = await roomDataByteSize();
      throw new OverCapError(
        currentBytes,
        STORAGE_CAP_BYTES,
        `write customs (${items.length} items)`,
      );
    }
    await OBR.room.setMetadata({ [CUSTOMS_KEY]: items });
  });
}

export function onCustomsChange(
  cb: (customs: CustomItemsRecord) => void,
): () => void {
  return OBR.room.onMetadataChange((md) => {
    const v = md[CUSTOMS_KEY];
    cb(Array.isArray(v) ? (v as CustomItemsRecord) : []);
  });
}

export async function ensureRecord(
  playerId: string, name: string, color: string,
): Promise<PlayerInventoryRecord> {
  const existing = await getRecord(playerId);
  if (!existing) {
    const fresh: PlayerInventoryRecord = {
      name, color, items: [],
      currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    };
    await writeRecord(playerId, fresh);
    return fresh;
  }
  if (existing.name !== name || existing.color !== color) {
    const updated: PlayerInventoryRecord = { ...existing, name, color };
    await writeRecord(playerId, updated);
    return updated;
  }
  return existing;
}

export function onRoomMetadataChange(
  cb: (records: Record<string, PlayerInventoryRecord>) => void,
): () => void {
  return OBR.room.onMetadataChange((md) => {
    const out: Record<string, PlayerInventoryRecord> = {};
    for (const [k, v] of Object.entries(md)) {
      if (!isRecordKey(k) || v == null) continue;
      out[playerIdFromKey(k)] = v as PlayerInventoryRecord;
    }
    cb(out);
  });
}

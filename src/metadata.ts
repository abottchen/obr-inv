import OBR from "@owlbear-rodeo/sdk";
import {
  CUSTOMS_KEY, METADATA_KEY_PREFIX,
} from "./constants";
import type { CustomItemsEnvelope, CustomItemsRecord, PlayerInventoryRecord } from "./types";
import { pruneZeros } from "./inventory";
import { atomicUpdate, type AtomicUpdateOptions, type Mutator } from "./atomic";

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

export function writeRecord(
  playerId: string,
  mutate: Mutator<PlayerInventoryRecord>,
  opts: AtomicUpdateOptions,
): Promise<PlayerInventoryRecord | null> {
  return atomicUpdate(recordKey(playerId), (current) => {
    const next = mutate(current);
    return next === null ? null : pruneZeros(next);
  }, opts);
}

export function deleteRecord(playerId: string): Promise<PlayerInventoryRecord | null> {
  return atomicUpdate<PlayerInventoryRecord>(
    recordKey(playerId),
    () => null,
    { description: `delete ${playerId} record` },
  );
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

export function writeCustoms(
  mutate: Mutator<CustomItemsEnvelope>,
  opts: AtomicUpdateOptions,
): Promise<CustomItemsEnvelope | null> {
  return atomicUpdate(CUSTOMS_KEY, mutate, opts);
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
  const result = await atomicUpdate<PlayerInventoryRecord>(
    recordKey(playerId),
    (current) => {
      if (!current) {
        return {
          w: "",
          name, color, items: [],
          currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
        };
      }
      if (current.name !== name || current.color !== color) {
        return { ...current, name, color };
      }
      return current;
    },
    { description: `ensure ${playerId} record` },
  );
  return result!;
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

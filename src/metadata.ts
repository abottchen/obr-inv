import OBR from "@owlbear-rodeo/sdk";
import {
  METADATA_KEY_PREFIX, STORAGE_CAP_BYTES,
} from "./constants";
import type { PlayerInventoryRecord } from "./types";
import { OverCapError } from "./types";
import { pruneZeros } from "./inventory";

export function recordKey(playerId: string): string {
  return `${METADATA_KEY_PREFIX}${playerId}`;
}

export function isRecordKey(key: string): boolean {
  return key.startsWith(METADATA_KEY_PREFIX);
}

export function playerIdFromKey(key: string): string {
  return key.slice(METADATA_KEY_PREFIX.length);
}

export async function listInventoryRecords(): Promise<Record<string, PlayerInventoryRecord>> {
  const md = await OBR.room.getMetadata();
  const out: Record<string, PlayerInventoryRecord> = {};
  for (const [k, v] of Object.entries(md)) {
    if (!isRecordKey(k)) continue;
    out[playerIdFromKey(k)] = v as PlayerInventoryRecord;
  }
  return out;
}

export async function getRecord(playerId: string): Promise<PlayerInventoryRecord | null> {
  const md = await OBR.room.getMetadata();
  const v = md[recordKey(playerId)];
  return (v as PlayerInventoryRecord | undefined) ?? null;
}

export async function inventoryByteSize(): Promise<number> {
  const all = await listInventoryRecords();
  return new TextEncoder().encode(JSON.stringify(all)).byteLength;
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
      const currentBytes = await inventoryByteSize();
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
      if (isRecordKey(k)) out[playerIdFromKey(k)] = v as PlayerInventoryRecord;
    }
    cb(out);
  });
}

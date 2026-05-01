import type {
  CatalogItem, InventoryEntry, PlayerInventoryRecord,
} from "./types";

export function emptyRecord(name: string, color: string): PlayerInventoryRecord {
  return { name, color, items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 } };
}

function withItems(r: PlayerInventoryRecord, items: InventoryEntry[]): PlayerInventoryRecord {
  return { ...r, items };
}

function findIndex(items: InventoryEntry[], id: string): number {
  return items.findIndex(([eid]) => eid === id);
}

export function addItem(
  r: PlayerInventoryRecord, id: string, qty: number,
): PlayerInventoryRecord {
  if (qty <= 0) throw new Error(`addItem: qty must be > 0 (got ${qty})`);
  const items = r.items.map((e) => [...e] as InventoryEntry);
  const i = findIndex(items, id);
  if (i >= 0) items[i][1] += qty;
  else items.push([id, qty]);
  return withItems(r, items);
}

export function incrementItem(r: PlayerInventoryRecord, id: string): PlayerInventoryRecord {
  return addItem(r, id, 1);
}

export function decrementItem(r: PlayerInventoryRecord, id: string): PlayerInventoryRecord {
  const items = r.items.map((e) => [...e] as InventoryEntry);
  const i = findIndex(items, id);
  if (i < 0) return r;
  items[i][1] = Math.max(0, items[i][1] - 1);
  return withItems(r, items);
}

export function removeItem(r: PlayerInventoryRecord, id: string): PlayerInventoryRecord {
  return withItems(r, r.items.filter(([eid]) => eid !== id));
}

export function pruneZeros(r: PlayerInventoryRecord): PlayerInventoryRecord {
  return withItems(r, r.items.filter(([, count]) => count > 0));
}

export function totalWeight(
  items: InventoryEntry[], catalog: CatalogItem[],
): number {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  let total = 0;
  for (const [id, count] of items) {
    const ci = byId.get(id);
    if (!ci || typeof ci.weight !== "number") continue;
    total += ci.weight * count;
  }
  return total;
}

export function applyTransfer(
  sender: PlayerInventoryRecord,
  recipient: PlayerInventoryRecord,
  id: string,
  qty: number,
): [PlayerInventoryRecord, PlayerInventoryRecord] {
  if (qty <= 0) throw new Error(`applyTransfer: qty must be > 0 (got ${qty})`);
  const senderItems = sender.items.map((e) => [...e] as InventoryEntry);
  const i = findIndex(senderItems, id);
  if (i < 0) throw new Error(`applyTransfer: sender has no item ${id}`);
  if (senderItems[i][1] < qty) {
    throw new Error(`applyTransfer: qty ${qty} exceeds sender count ${senderItems[i][1]}`);
  }
  senderItems[i][1] -= qty;
  const newSender = withItems(sender, senderItems);

  const newRecipient = addItem(recipient, id, qty);
  return [newSender, newRecipient];
}

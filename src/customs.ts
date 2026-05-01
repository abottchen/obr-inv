import type {
  CatalogItem, CustomItem, CustomItemsRecord, PlayerInventoryRecord,
} from "./types";

/**
 * 6-character ID, same alphabet as the catalog repo's nano-IDs.
 * 0-9, A-Z, a-z → 62^6 ≈ 5.7×10^10 possibilities. Collisions in
 * practice are vanishingly rare; the caller still loops on collision.
 */
const ID_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function nanoId6(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * ID_ALPHABET.length);
    out += ID_ALPHABET[idx];
  }
  return out;
}

/**
 * Generate an ID that's not in the supplied set. Loops on collision.
 * In practice this is a one-iteration loop.
 */
export function generateUnusedItemId(existing: Set<string>): string {
  while (true) {
    const id = nanoId6();
    if (!existing.has(id)) return id;
  }
}

export function addCustom(
  customs: CustomItemsRecord, item: CustomItem,
): CustomItemsRecord {
  if (customs.some((c) => c.id === item.id)) {
    throw new Error(`addCustom: id already present (${item.id})`);
  }
  return [...customs, item];
}

export function updateCustom(
  customs: CustomItemsRecord, item: CustomItem,
): CustomItemsRecord {
  const i = customs.findIndex((c) => c.id === item.id);
  if (i < 0) throw new Error(`updateCustom: id not found (${item.id})`);
  const next = customs.slice();
  next[i] = item;
  return next;
}

export function removeCustom(
  customs: CustomItemsRecord, id: string,
): CustomItemsRecord {
  return customs.filter((c) => c.id !== id);
}

/**
 * Find every inventory that references the given item id, with the
 * count present in that inventory. Used to surface a delete warning.
 */
export interface CustomReference {
  playerId: string;
  playerName: string;
  count: number;
}

export function findReferences(
  itemId: string, records: Record<string, PlayerInventoryRecord>,
): CustomReference[] {
  const out: CustomReference[] = [];
  for (const [playerId, rec] of Object.entries(records)) {
    const entry = rec.items.find(([eid]) => eid === itemId);
    if (entry && entry[1] > 0) {
      out.push({ playerId, playerName: rec.name, count: entry[1] });
    }
  }
  return out;
}

/**
 * Distinct categories drawn from the resolved (catalog ∪ customs) set.
 * Used to seed the create-item dialog's category combobox.
 */
export function distinctCategories(items: CatalogItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    if (seen.has(it.category)) continue;
    seen.add(it.category);
    out.push(it.category);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

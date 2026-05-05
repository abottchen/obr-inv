import type { CatalogItem, InventoryEntry } from "./types";

export interface ItemsDataState {
  items: InventoryEntry[];
  catalog: CatalogItem[];
  search: string;
  ghosts: Set<string>;
  phantomRemoves: Set<string>;
}

export interface GroupedEntry {
  entry: InventoryEntry;
  item: CatalogItem | null;
}

export type GroupedByCategory = Array<[category: string, entries: GroupedEntry[]]>;

export function groupByCategory(state: ItemsDataState): GroupedByCategory {
  const entries = resolveEntries(state);
  const byCat = new Map<string, GroupedEntry[]>();
  for (const ge of entries) {
    const cat = ge.item?.category ?? "Unknown";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(ge);
  }
  return [...byCat.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function flatSorted(state: ItemsDataState): GroupedEntry[] {
  return resolveEntries(state).sort((a, b) => {
    const an = a.item?.name ?? a.entry[0];
    const bn = b.item?.name ?? b.entry[0];
    return an.localeCompare(bn);
  });
}

function resolveEntries(state: ItemsDataState): GroupedEntry[] {
  const byId = new Map(state.catalog.map((c) => [c.id, c]));
  const search = state.search.trim().toLowerCase();

  const working: InventoryEntry[] = [...state.items];
  const realIds = new Set(state.items.map((e) => e[0]));
  for (const id of state.phantomRemoves) {
    if (!realIds.has(id)) working.push([id, 0]);
  }

  const result: GroupedEntry[] = [];
  for (const entry of working) {
    const item = byId.get(entry[0]) ?? null;
    const isPhantom = state.phantomRemoves.has(entry[0]);
    if (entry[1] === 0 && !state.ghosts.has(entry[0]) && !isPhantom) continue;
    if (search && !nameMatches(entry, item, search)) continue;
    result.push({ entry, item });
  }
  return result;
}

function nameMatches(
  entry: InventoryEntry, item: CatalogItem | null, search: string,
): boolean {
  const name = item?.name ?? entry[0];
  return name.toLowerCase().includes(search);
}

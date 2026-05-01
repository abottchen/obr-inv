import { RARITIES } from "./constants";
import type { CatalogItem, CustomItem, Rarity } from "./types";

const REQUIRED: ReadonlyArray<keyof CatalogItem> = [
  "id", "name", "category", "icon", "description",
];

let cache: { url: string; items: CatalogItem[] } | null = null;

export function __resetCatalogCache() { cache = null; }

export function parseCatalog(raw: unknown): CatalogItem[] {
  if (!Array.isArray(raw)) {
    console.warn("[catalog] root is not an array; returning empty");
    return [];
  }
  const seen = new Set<string>();
  const out: CatalogItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") {
      console.warn("[catalog] dropped non-object entry");
      continue;
    }
    const obj = r as Record<string, unknown>;
    let ok = true;
    for (const key of REQUIRED) {
      if (typeof obj[key] !== "string" || (obj[key] as string).length === 0) {
        console.warn(`[catalog] dropped item missing field: ${key}`, obj);
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (seen.has(obj.id as string)) {
      console.warn(`[catalog] duplicate id ignored: ${obj.id}`);
      continue;
    }
    seen.add(obj.id as string);

    const rarity = typeof obj.rarity === "string"
      && (RARITIES as ReadonlyArray<string>).includes(obj.rarity)
        ? (obj.rarity as Rarity) : undefined;
    const weight = typeof obj.weight === "number" && Number.isFinite(obj.weight)
      ? obj.weight : undefined;

    const item: CatalogItem = {
      ...obj,
      id: obj.id as string,
      name: obj.name as string,
      category: obj.category as string,
      icon: obj.icon as string,
      description: obj.description as string,
      rarity,
      weight,
    };
    out.push(item);
  }
  return out;
}

/**
 * Merge the published catalog with locally-defined custom items.
 * Catalog wins on id collision (a hint that the GM has promoted the
 * custom into the catalog repo; the §6.1 reconciliation pass sweeps
 * the stale metadata entry on next GM boot). Returns a new array;
 * the input arrays are not mutated.
 */
export function resolvedCatalog(
  remote: CatalogItem[], customs: CustomItem[],
): CatalogItem[] {
  const map = new Map<string, CatalogItem>();
  for (const item of remote) map.set(item.id, item);
  for (const item of customs) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return Array.from(map.values());
}

export async function fetchCatalog(url: string): Promise<CatalogItem[]> {
  if (cache?.url === url) return cache.items;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const items = parseCatalog(json);
      cache = { url, items };
      return items;
    } catch (err) {
      lastErr = err;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastErr;
}

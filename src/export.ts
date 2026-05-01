import { resolvedCatalog } from "./catalog";
import { getCustoms, listInventoryRecords } from "./metadata";
import type { CatalogItem, CustomItem } from "./types";

export interface ExportEntryHydrated {
  id: string;
  count: number;
  name: string;
  category: string;
  icon: string;
  description: string;
  rarity?: string | null;
  weight?: number | null;
}
export interface ExportEntryUnresolved {
  id: string;
  count: number;
  _unresolved: true;
}
export type ExportEntry = ExportEntryHydrated | ExportEntryUnresolved;

export interface ExportInventory {
  name: string;
  color: string;
  items: ExportEntry[];
  currency: { pp: number; gp: number; sp: number; cp: number };
}

export interface ExportFile {
  exportedAt: string;
  catalogUrl: string;
  catalogVersion: string;
  customItems: CustomItem[];
  inventories: Record<string, ExportInventory>;
}

async function sha1(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildExport(
  catalog: CatalogItem[], catalogUrl: string,
): Promise<ExportFile> {
  const [records, customs] = await Promise.all([
    listInventoryRecords(),
    getCustoms(),
  ]);
  // Hydrate against the merged catalog so a custom item's row in a
  // player's inventory still resolves to a full record at export time.
  const merged = resolvedCatalog(catalog, customs);
  const byId = new Map(merged.map((c) => [c.id, c]));
  const inventories: Record<string, ExportInventory> = {};
  for (const [pid, rec] of Object.entries(records)) {
    const items: ExportEntry[] = rec.items.map(([id, count]) => {
      const ci = byId.get(id);
      if (!ci) return { id, count, _unresolved: true as const };
      return {
        id, count,
        name: ci.name, category: ci.category,
        icon: ci.icon, description: ci.description,
        rarity: ci.rarity ?? null, weight: ci.weight ?? null,
      };
    });
    inventories[pid] = {
      name: rec.name, color: rec.color, items, currency: rec.currency,
    };
  }
  return {
    exportedAt: new Date().toISOString(),
    catalogUrl,
    catalogVersion: await sha1(JSON.stringify(catalog)),
    customItems: customs,
    inventories,
  };
}

export function downloadExport(exp: ExportFile): void {
  const blob = new Blob([JSON.stringify(exp, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `obr-inv-backup-${exp.exportedAt.replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

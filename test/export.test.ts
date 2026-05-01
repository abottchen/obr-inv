import { describe, it, expect, beforeEach } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import { writeRecord } from "../src/metadata";
import { buildExport } from "../src/export";
import type { CatalogItem } from "../src/types";

const cat: CatalogItem[] = [
  { id: "a1", name: "Item A", category: "C", icon: "u", description: "d",
    rarity: "uncommon", weight: 0.5 },
];

describe("buildExport", () => {
  beforeEach(() => __testHooks.reset());

  it("hydrates known IDs and marks unknown ones as _unresolved", async () => {
    await writeRecord("p1", {
      name: "Alice", color: "#fff",
      items: [["a1", 3], ["zz", 7]],
      currency: { pp: 0, gp: 5, sp: 0, cp: 0 },
    });
    const exp = await buildExport(cat, "https://example.test/items.json");
    expect(exp.exportedAt).toMatch(/T.*Z/);
    expect(exp.catalogUrl).toBe("https://example.test/items.json");
    expect(exp.catalogVersion).toMatch(/^[0-9a-f]{40}$/);
    expect(exp.inventories.p1.items).toEqual([
      { id: "a1", count: 3, name: "Item A", category: "C", icon: "u",
        description: "d", rarity: "uncommon", weight: 0.5 },
      { id: "zz", count: 7, _unresolved: true },
    ]);
    expect(exp.inventories.p1.currency).toEqual({ pp: 0, gp: 5, sp: 0, cp: 0 });
    expect(exp.inventories.p1.name).toBe("Alice");
  });
});

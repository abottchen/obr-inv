import { describe, it, expect, beforeEach } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import { writeCustoms, writeRecord } from "../src/metadata";
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
    expect(exp.customItems).toEqual([]);
    expect(exp.inventories.p1.items).toEqual([
      { id: "a1", count: 3, name: "Item A", category: "C", icon: "u",
        description: "d", rarity: "uncommon", weight: 0.5 },
      { id: "zz", count: 7, _unresolved: true },
    ]);
    expect(exp.inventories.p1.currency).toEqual({ pp: 0, gp: 5, sp: 0, cp: 0 });
    expect(exp.inventories.p1.name).toBe("Alice");
  });

  it("includes customItems and hydrates inventory entries against the merged catalog", async () => {
    await writeCustoms([
      { id: "qZx91A", name: "Flower", category: "Misc", icon: "",
        description: "A small bloom", rarity: null, weight: null },
    ]);
    await writeRecord("p1", {
      name: "Alice", color: "#fff",
      items: [["a1", 1], ["qZx91A", 2]],
      currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    });

    const exp = await buildExport(cat, "https://example.test/items.json");
    expect(exp.customItems).toHaveLength(1);
    expect(exp.customItems[0].id).toBe("qZx91A");

    // Custom item resolves to a hydrated row, not _unresolved.
    expect(exp.inventories.p1.items).toEqual([
      { id: "a1", count: 1, name: "Item A", category: "C", icon: "u",
        description: "d", rarity: "uncommon", weight: 0.5 },
      { id: "qZx91A", count: 2, name: "Flower", category: "Misc",
        icon: "", description: "A small bloom",
        rarity: null, weight: null },
    ]);
  });

  it("catalog wins on id collision (custom shadowed in hydration)", async () => {
    await writeCustoms([
      { id: "a1", name: "Stale name", category: "Misc",
        icon: "", description: "stale" },
    ]);
    await writeRecord("p1", {
      name: "Alice", color: "#fff",
      items: [["a1", 1]],
      currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    });
    const exp = await buildExport(cat, "https://example.test/items.json");
    const row = exp.inventories.p1.items[0];
    expect(row).toMatchObject({ id: "a1", name: "Item A", category: "C" });
  });
});

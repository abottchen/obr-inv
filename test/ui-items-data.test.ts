import { describe, it, expect } from "vitest";
import { groupByCategory, type ItemsDataState } from "../src/ui-items-data";
import type { CatalogItem } from "../src/types";

const catalog: CatalogItem[] = [
  { id: "h1", name: "Healing Potion",    category: "Consumables", icon: "u", description: "", rarity: "uncommon" },
  { id: "h2", name: "Antitoxin",         category: "Consumables", icon: "u", description: "" },
  { id: "a1", name: "+1 Arrows",         category: "Weapons",     icon: "u", description: "", rarity: "rare" },
  { id: "a2", name: "Dagger",            category: "Weapons",     icon: "u", description: "" },
  { id: "g1", name: "Bedroll",           category: "Adventuring", icon: "u", description: "" },
];

function baseState(overrides: Partial<ItemsDataState> = {}): ItemsDataState {
  return {
    items: [],
    catalog,
    search: "",
    ghosts: new Set<string>(),
    phantomRemoves: new Set<string>(),
    ...overrides,
  };
}

describe("groupByCategory", () => {
  it("groups items by their catalog category", () => {
    const groups = groupByCategory(baseState({
      items: [["h1", 2], ["a1", 5]],
    }));
    const cats = groups.map(([cat]) => cat);
    expect(cats).toEqual(["Consumables", "Weapons"]);
    expect(groups[0][1].map((g) => g.entry[0])).toEqual(["h1"]);
    expect(groups[1][1].map((g) => g.entry[0])).toEqual(["a1"]);
  });

  it("sorts categories alphabetically", () => {
    const groups = groupByCategory(baseState({
      items: [["a1", 1], ["g1", 1], ["h1", 1]],
    }));
    expect(groups.map(([c]) => c)).toEqual(["Adventuring", "Consumables", "Weapons"]);
  });

  it("preserves input order within a category", () => {
    const groups = groupByCategory(baseState({
      items: [["h2", 1], ["h1", 1]],
    }));
    expect(groups[0][1].map((g) => g.entry[0])).toEqual(["h2", "h1"]);
  });

  it("filters by case-insensitive substring on item name", () => {
    const groups = groupByCategory(baseState({
      items: [["h1", 1], ["h2", 1], ["a1", 1]],
      search: "POT",
    }));
    expect(groups.length).toBe(1);
    expect(groups[0][0]).toBe("Consumables");
    expect(groups[0][1].map((g) => g.entry[0])).toEqual(["h1"]);
  });

  it("treats whitespace-only search as no filter", () => {
    const groups = groupByCategory(baseState({
      items: [["h1", 1], ["a1", 1]],
      search: "   ",
    }));
    expect(groups.length).toBe(2);
  });

  it("excludes items with count 0 unless they are ghosts or phantom removes", () => {
    const groups = groupByCategory(baseState({
      items: [["h1", 0], ["h2", 0], ["a1", 1]],
      ghosts: new Set(["h1"]),
    }));
    const ids = groups.flatMap(([, gs]) => gs.map((g) => g.entry[0]));
    expect(ids).toContain("h1");
    expect(ids).not.toContain("h2");
    expect(ids).toContain("a1");
  });

  it("synthesizes [id, 0] entries for phantom-remove ids not present in items", () => {
    const groups = groupByCategory(baseState({
      items: [["a1", 1]],
      phantomRemoves: new Set(["h1"]),
    }));
    const consumables = groups.find(([c]) => c === "Consumables");
    expect(consumables).toBeDefined();
    const entry = consumables![1].find((g) => g.entry[0] === "h1");
    expect(entry).toBeDefined();
    expect(entry!.entry[1]).toBe(0);
  });

  it("does not double-add a phantom-remove id that is still present in items", () => {
    const groups = groupByCategory(baseState({
      items: [["h1", 0]],
      phantomRemoves: new Set(["h1"]),
    }));
    const consumables = groups.find(([c]) => c === "Consumables");
    const matches = consumables![1].filter((g) => g.entry[0] === "h1");
    expect(matches.length).toBe(1);
  });

  it("buckets missing-from-catalog items under 'Unknown' with a null item", () => {
    const groups = groupByCategory(baseState({
      items: [["mystery-id", 1]],
    }));
    expect(groups.map(([c]) => c)).toEqual(["Unknown"]);
    expect(groups[0][1][0].item).toBeNull();
    expect(groups[0][1][0].entry[0]).toBe("mystery-id");
  });

  it("returns an empty array when nothing matches", () => {
    const groups = groupByCategory(baseState({
      items: [["h1", 1]],
      search: "xyzzy",
    }));
    expect(groups).toEqual([]);
  });
});

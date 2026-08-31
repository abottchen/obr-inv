import { describe, it, expect } from "vitest";
import { groupByCategory, flatSorted, type ItemsDataState } from "../src/ui-items-data";
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

  it("sorts unranked categories alphabetically", () => {
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

// Fixture using the catalog's real category names, so the tier table in
// constants.ts actually applies. The fixture above deliberately uses
// invented names ("Consumables", "Weapons") that fall in the unranked tail.
const tierCatalog: CatalogItem[] = [
  { id: "t-ammo",   name: "Arrows",             category: "Ammunition",        icon: "u", description: "" },
  { id: "t-potion", name: "Potion of Healing",  category: "Consumable",        icon: "u", description: "" },
  { id: "t-scroll", name: "Scroll of Fireball", category: "Adventuring Gear - Spell Scrolls", icon: "u", description: "" },
  { id: "t-wond",   name: "Bag of Holding",     category: "Wondrous Item",     icon: "u", description: "" },
  { id: "t-other",  name: "Odd Trinket",        category: "Other",             icon: "u", description: "" },
  { id: "t-weapon", name: "Longsword",          category: "Weapon",            icon: "u", description: "" },
  { id: "t-armor",  name: "Chain Mail",         category: "Armor",             icon: "u", description: "" },
  { id: "t-tool",   name: "Thieves' Tools",     category: "Tool",              icon: "u", description: "" },
  { id: "t-cloak",  name: "Cloak",              category: "Clothing",          icon: "u", description: "" },
  { id: "t-mule",   name: "Mule",               category: "Animal",            icon: "u", description: "" },
  { id: "t-focus",  name: "Holy Symbol",        category: "Spellcasting Focus", icon: "u", description: "" },
  { id: "t-arrow2", name: "+1 Arrows",          category: "Ammunition",        icon: "u", description: "" },
];

const allTierItems: ItemsDataState["items"] =
  tierCatalog.map((c) => [c.id, 1] as [string, number]);

describe("groupByCategory tier ordering", () => {
  it("orders category groups by tier, not alphabetically", () => {
    const groups = groupByCategory(baseState({
      catalog: tierCatalog, items: allTierItems,
    }));
    expect(groups.map(([c]) => c)).toEqual([
      "Ammunition",
      "Consumable",
      "Adventuring Gear - Spell Scrolls",
      "Wondrous Item",
      "Other",
      "Weapon",
      "Armor",
      "Animal",
      "Clothing",
      "Spellcasting Focus",
      "Tool",
    ]);
  });

  it("sorts the unranked tail alphabetically behind the ranked categories", () => {
    const groups = groupByCategory(baseState({
      catalog: tierCatalog,
      items: [["t-tool", 1], ["t-mule", 1], ["t-weapon", 1], ["t-ammo", 1]],
    }));
    expect(groups.map(([c]) => c)).toEqual(["Ammunition", "Weapon", "Animal", "Tool"]);
  });

  it("places the Unknown bucket in the quick-access tier, above Weapon", () => {
    const groups = groupByCategory(baseState({
      catalog: tierCatalog,
      items: [["t-weapon", 1], ["mystery-id", 1], ["t-tool", 1]],
    }));
    expect(groups.map(([c]) => c)).toEqual(["Unknown", "Weapon", "Tool"]);
  });
});

describe("flatSorted tier ordering", () => {
  it("orders entries by category tier, then by item name within a category", () => {
    const ordered = flatSorted(baseState({
      catalog: tierCatalog, items: allTierItems,
    }));
    expect(ordered.map((g) => g.entry[0])).toEqual([
      "t-arrow2", "t-ammo",          // Ammunition: "+1 Arrows" before "Arrows"
      "t-potion",                    // Consumable
      "t-scroll",                    // Spell Scrolls
      "t-wond",                      // Wondrous Item
      "t-other",                     // Other
      "t-weapon",                    // Weapon
      "t-armor",                     // Armor
      "t-mule",                      // Animal   ─┐
      "t-cloak",                     // Clothing  │ unranked tail,
      "t-focus",                     // Focus     │ alphabetical by category
      "t-tool",                      // Tool     ─┘
    ]);
  });

  it("keeps missing-from-catalog entries in the quick-access tier", () => {
    const ordered = flatSorted(baseState({
      catalog: tierCatalog,
      items: [["t-tool", 1], ["mystery-id", 1], ["t-weapon", 1]],
    }));
    expect(ordered.map((g) => g.entry[0])).toEqual(["mystery-id", "t-weapon", "t-tool"]);
  });
});

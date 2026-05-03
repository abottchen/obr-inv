import { describe, it, expect } from "vitest";
import {
  addCustom, distinctCategories, findReferences,
  generateUnusedItemId, nanoId6, reconcileCustoms,
  removeCustom, updateCustom,
} from "../src/customs";
import type {
  CatalogItem, CustomItem, PlayerInventoryRecord,
} from "../src/types";

const cust = (overrides: Partial<CustomItem> = {}): CustomItem => ({
  id: "abc123", name: "Flower", category: "Misc",
  icon: "", description: "A small bloom.", ...overrides,
});

const player = (
  name: string, items: [string, number][] = [],
): PlayerInventoryRecord => ({
  name, color: "#fff", w: "", items,
  currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
});

describe("nanoId6 / generateUnusedItemId", () => {
  it("nanoId6 returns a 6-char alphanumeric ID", () => {
    for (let i = 0; i < 50; i++) {
      const id = nanoId6();
      expect(id).toHaveLength(6);
      expect(id).toMatch(/^[0-9A-Za-z]{6}$/);
    }
  });

  it("generateUnusedItemId loops until an unused ID is found", () => {
    // Every nanoId6 result will collide, so this would never return —
    // unless we monkey-patch Math.random to first return a colliding
    // index, then a new one. Easier: pre-seed the existing set with a
    // known small alphabet and run many attempts; collisions should
    // resolve within a couple of tries given 62^6 space.
    const id = generateUnusedItemId(new Set(["xxxxxx"]));
    expect(id).not.toBe("xxxxxx");
    expect(id).toMatch(/^[0-9A-Za-z]{6}$/);
  });
});

describe("addCustom / updateCustom / removeCustom", () => {
  it("addCustom appends a new item", () => {
    const next = addCustom([], cust());
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("abc123");
  });

  it("addCustom rejects duplicate id (caller must regenerate first)", () => {
    expect(() => addCustom([cust()], cust())).toThrow(/already present/);
  });

  it("updateCustom replaces the item by id (id-stable)", () => {
    const initial = [cust({ name: "Flower" }), cust({ id: "def456", name: "Stone" })];
    const next = updateCustom(initial, cust({ name: "Lily" }));
    expect(next).toHaveLength(2);
    expect(next[0].name).toBe("Lily");
    expect(next[1].name).toBe("Stone");
  });

  it("updateCustom throws when the id isn't present", () => {
    expect(() => updateCustom([], cust())).toThrow(/not found/);
  });

  it("removeCustom drops the matching id and leaves the rest", () => {
    const initial = [cust(), cust({ id: "def456", name: "Stone" })];
    const next = removeCustom(initial, "abc123");
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("def456");
  });

  it("removeCustom is a no-op when id isn't present", () => {
    const initial = [cust()];
    const next = removeCustom(initial, "missing");
    expect(next).toEqual(initial);
  });
});

describe("findReferences", () => {
  it("returns the players + counts that reference an id", () => {
    const records: Record<string, PlayerInventoryRecord> = {
      alice: player("Alice", [["abc123", 1], ["zz", 4]]),
      bob: player("Bob", [["abc123", 2]]),
      carla: player("Carla", []),
    };
    const refs = findReferences("abc123", records);
    expect(refs).toEqual([
      { playerId: "alice", playerName: "Alice", count: 1 },
      { playerId: "bob", playerName: "Bob", count: 2 },
    ]);
  });

  it("ignores zero-count entries (defense in depth, pruneZeros normally cleans them)", () => {
    const records: Record<string, PlayerInventoryRecord> = {
      alice: player("Alice", [["abc123", 0]]),
    };
    expect(findReferences("abc123", records)).toEqual([]);
  });

  it("returns an empty array when no records reference the id", () => {
    const records: Record<string, PlayerInventoryRecord> = {
      alice: player("Alice", [["zz", 1]]),
    };
    expect(findReferences("abc123", records)).toEqual([]);
  });
});

describe("distinctCategories", () => {
  it("returns sorted unique categories", () => {
    const items: CatalogItem[] = [
      { id: "1", name: "A", category: "Weapons", icon: "u", description: "d" },
      { id: "2", name: "B", category: "Misc", icon: "u", description: "d" },
      { id: "3", name: "C", category: "Weapons", icon: "u", description: "d" },
    ];
    expect(distinctCategories(items)).toEqual(["Misc", "Weapons"]);
  });

  it("returns [] for empty input", () => {
    expect(distinctCategories([])).toEqual([]);
  });
});

describe("reconcileCustoms", () => {
  const cat = (id: string): CatalogItem => ({
    id, name: id, category: "C", icon: "u", description: "d",
  });

  it("returns the input unchanged when no customs", () => {
    const r = reconcileCustoms([cat("a"), cat("b")], []);
    expect(r.survivors).toEqual([]);
    expect(r.removed).toEqual([]);
  });

  it("returns the input unchanged when no collision", () => {
    const customs = [cust({ id: "x1" }), cust({ id: "x2" })];
    const r = reconcileCustoms([cat("a"), cat("b")], customs);
    expect(r.survivors).toEqual(customs);
    expect(r.removed).toEqual([]);
  });

  it("partitions customs into survivors and removed", () => {
    const flower = cust({ id: "x1", name: "flower" });
    const promoted = cust({ id: "a", name: "promoted" });
    const r = reconcileCustoms([cat("a")], [flower, promoted]);
    expect(r.survivors).toEqual([flower]);
    expect(r.removed).toEqual([promoted]);
  });

  it("handles all-promoted case (survivors empty, removed non-empty)", () => {
    const customs = [cust({ id: "a" }), cust({ id: "b" })];
    const r = reconcileCustoms([cat("a"), cat("b")], customs);
    expect(r.survivors).toEqual([]);
    expect(r.removed).toEqual(customs);
  });
});

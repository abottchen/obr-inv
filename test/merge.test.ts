import { describe, it, expect, beforeEach } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import { __atomicTestHooks } from "../src/atomic";
import { writeRecord, getRecord } from "../src/metadata";
import { mergeRecords, executeMerge, findOrphans } from "../src/merge";
import type { PlayerInventoryRecord } from "../src/types";

const seedRecord = async (
  pid: string, name: string,
  items: [string, number][] = [],
  currency = { pp: 0, gp: 0, sp: 0, cp: 0 },
) => {
  await writeRecord(pid,
    () => ({ w: "", name, color: "#fff", items, currency }),
    { description: `seed ${pid}` },
  );
};

const rec = (
  name: string, items: [string, number][] = [],
  currency = { pp: 0, gp: 0, sp: 0, cp: 0 },
): PlayerInventoryRecord => ({ w: "", name, color: "#fff", items, currency });

describe("mergeRecords (pure)", () => {
  it("combines items from source into target", () => {
    const target = rec("A", [["sword", 2], ["shield", 1]]);
    const source = rec("A", [["sword", 3], ["potion", 5]]);
    const result = mergeRecords(target, source);
    expect(result.items).toEqual([["sword", 5], ["shield", 1], ["potion", 5]]);
  });

  it("sums currency", () => {
    const target = rec("A", [], { pp: 1, gp: 10, sp: 0, cp: 5 });
    const source = rec("A", [], { pp: 2, gp: 20, sp: 3, cp: 0 });
    const result = mergeRecords(target, source);
    expect(result.currency).toEqual({ pp: 3, gp: 30, sp: 3, cp: 5 });
  });

  it("skips zero-count source items", () => {
    const target = rec("A", [["sword", 1]]);
    const source = rec("A", [["dagger", 0], ["bow", 2]]);
    const result = mergeRecords(target, source);
    expect(result.items).toEqual([["sword", 1], ["bow", 2]]);
  });

  it("preserves target name and color", () => {
    const target: PlayerInventoryRecord = { w: "", name: "Target", color: "#f00", items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 } };
    const source: PlayerInventoryRecord = { w: "", name: "Source", color: "#0f0", items: [["a", 1]], currency: { pp: 0, gp: 0, sp: 0, cp: 0 } };
    const result = mergeRecords(target, source);
    expect(result.name).toBe("Target");
    expect(result.color).toBe("#f00");
  });
});

describe("executeMerge (atomic)", () => {
  beforeEach(() => { __testHooks.reset(); __atomicTestHooks.reset(); });

  it("merges source into target and deletes source", async () => {
    await seedRecord("old-id", "Scorpio", [["sword", 3]], { pp: 0, gp: 50, sp: 0, cp: 0 });
    await seedRecord("new-id", "Scorpio", [["potion", 1]]);

    await executeMerge("new-id", "old-id", { description: "merge test" });

    const target = await getRecord("new-id");
    const source = await getRecord("old-id");
    expect(source).toBeNull();
    expect(target?.items).toEqual([["potion", 1], ["sword", 3]]);
    expect(target?.currency.gp).toBe(50);
  });

  it("handles overlapping items correctly", async () => {
    await seedRecord("old-id", "Player", [["sword", 2], ["shield", 1]]);
    await seedRecord("new-id", "Player", [["sword", 3]]);

    await executeMerge("new-id", "old-id", { description: "merge test" });

    const target = await getRecord("new-id");
    expect(target?.items).toEqual([["sword", 5], ["shield", 1]]);
  });

  it("rejects when target has no record", async () => {
    await seedRecord("old-id", "Player", [["a", 1]]);
    await expect(
      executeMerge("ghost", "old-id", { description: "merge test" }),
    ).rejects.toThrow(/Target ghost has no record/);
  });

  it("rejects when source has no record", async () => {
    await seedRecord("new-id", "Player");
    await expect(
      executeMerge("new-id", "ghost", { description: "merge test" }),
    ).rejects.toThrow(/Source ghost has no record/);
  });
});

describe("findOrphans", () => {
  it("returns records with same name and different id", () => {
    const records: Record<string, PlayerInventoryRecord> = {
      "new-id": rec("Scorpio", [["a", 1]]),
      "old-id": rec("Scorpio", [["b", 3]], { pp: 0, gp: 10, sp: 0, cp: 0 }),
      "other": rec("Valeria", [["c", 2]]),
    };
    const orphans = findOrphans("new-id", "Scorpio", records);
    expect(orphans).toHaveLength(1);
    expect(orphans[0].id).toBe("old-id");
  });

  it("excludes empty orphans", () => {
    const records: Record<string, PlayerInventoryRecord> = {
      "new-id": rec("Scorpio", [["a", 1]]),
      "old-id": rec("Scorpio"),
    };
    const orphans = findOrphans("new-id", "Scorpio", records);
    expect(orphans).toHaveLength(0);
  });

  it("detects orphans with only currency", () => {
    const records: Record<string, PlayerInventoryRecord> = {
      "new-id": rec("Scorpio"),
      "old-id": rec("Scorpio", [], { pp: 0, gp: 100, sp: 0, cp: 0 }),
    };
    const orphans = findOrphans("new-id", "Scorpio", records);
    expect(orphans).toHaveLength(1);
  });

  it("returns multiple orphans when present", () => {
    const records: Record<string, PlayerInventoryRecord> = {
      "new": rec("A"),
      "old1": rec("A", [["x", 1]]),
      "old2": rec("A", [["y", 2]]),
    };
    const orphans = findOrphans("new", "A", records);
    expect(orphans).toHaveLength(2);
  });
});

import { describe, it, expect } from "vitest";
import {
  emptyRecord, addItem, incrementItem, decrementItem, removeItem,
  pruneZeros, totalWeight, applyTransfer,
} from "../src/inventory";
import type { CatalogItem, PlayerInventoryRecord } from "../src/types";

const cat = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id: "a1", name: "Item", category: "C", icon: "u", description: "d", ...overrides,
});

const rec = (items: [string, number][] = []): PlayerInventoryRecord => ({
  name: "Alice", color: "#fff", items,
  currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
});

describe("inventory", () => {
  it("emptyRecord seeds correctly", () => {
    const r = emptyRecord("Alice", "#fff");
    expect(r.items).toEqual([]);
    expect(r.currency).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });
  });

  it("addItem creates a new entry when absent", () => {
    const r = addItem(rec(), "a1", 3);
    expect(r.items).toEqual([["a1", 3]]);
  });

  it("addItem merges with existing entry", () => {
    const r = addItem(rec([["a1", 2]]), "a1", 5);
    expect(r.items).toEqual([["a1", 7]]);
  });

  it("addItem rejects qty <= 0", () => {
    expect(() => addItem(rec(), "a1", 0)).toThrow();
    expect(() => addItem(rec(), "a1", -1)).toThrow();
  });

  it("incrementItem adds 1", () => {
    expect(incrementItem(rec([["a1", 2]]), "a1").items).toEqual([["a1", 3]]);
  });

  it("decrementItem reduces by 1; allows reaching 0", () => {
    const r = decrementItem(rec([["a1", 1]]), "a1");
    expect(r.items).toEqual([["a1", 0]]);
  });

  it("decrementItem clamps at 0", () => {
    const r = decrementItem(rec([["a1", 0]]), "a1");
    expect(r.items).toEqual([["a1", 0]]);
  });

  it("removeItem drops the entry", () => {
    expect(removeItem(rec([["a1", 5], ["b2", 1]]), "a1").items).toEqual([["b2", 1]]);
  });

  it("pruneZeros strips zero-count entries", () => {
    expect(pruneZeros(rec([["a1", 0], ["b2", 3]])).items).toEqual([["b2", 3]]);
  });

  it("totalWeight sums weight × count, ignoring null/missing", () => {
    const items: [string, number][] = [["a1", 2], ["b2", 4]];
    const catalog: CatalogItem[] = [
      cat({ id: "a1", weight: 1.5 }),
      cat({ id: "b2", weight: null as any }),
    ];
    expect(totalWeight(items, catalog)).toBe(3);
  });

  it("totalWeight ignores ids missing from catalog", () => {
    const items = [["unknown", 5] as [string, number]];
    expect(totalWeight(items, [])).toBe(0);
  });

  it("applyTransfer moves qty from sender to recipient", () => {
    const sender = rec([["a1", 5]]);
    const recipient = rec();
    const [s2, r2] = applyTransfer(sender, recipient, "a1", 3);
    expect(s2.items).toEqual([["a1", 2]]);
    expect(r2.items).toEqual([["a1", 3]]);
  });

  it("applyTransfer merges into recipient's existing entry", () => {
    const sender = rec([["a1", 5]]);
    const recipient = rec([["a1", 2]]);
    const [s2, r2] = applyTransfer(sender, recipient, "a1", 3);
    expect(s2.items).toEqual([["a1", 2]]);
    expect(r2.items).toEqual([["a1", 5]]);
  });

  it("applyTransfer rejects qty > sender count", () => {
    expect(() => applyTransfer(rec([["a1", 2]]), rec(), "a1", 3)).toThrow();
  });

  it("applyTransfer rejects qty <= 0", () => {
    expect(() => applyTransfer(rec([["a1", 2]]), rec(), "a1", 0)).toThrow();
  });

  it("applyTransfer rejects when sender doesn't have the item", () => {
    expect(() => applyTransfer(rec(), rec(), "a1", 1)).toThrow();
  });
});

import { describe, it, expect } from "vitest";
import { categoryRank, categoryCollapsedByDefault } from "../src/category-order";

describe("categoryRank", () => {
  it("ranks the quick-access tier ahead of weapons and armor", () => {
    expect(categoryRank("Ammunition")).toBeLessThan(categoryRank("Weapon"));
    expect(categoryRank("Consumable")).toBeLessThan(categoryRank("Weapon"));
    expect(categoryRank("Wondrous Item")).toBeLessThan(categoryRank("Armor"));
  });

  it("ranks weapons and armor ahead of unlisted categories", () => {
    expect(categoryRank("Weapon")).toBeLessThan(categoryRank("Tool"));
    expect(categoryRank("Armor")).toBeLessThan(categoryRank("Clothing"));
  });

  it("orders the quick-access tier as listed, not alphabetically", () => {
    expect(categoryRank("Ammunition")).toBeLessThan(categoryRank("Consumable"));
    expect(categoryRank("Consumable"))
      .toBeLessThan(categoryRank("Adventuring Gear - Spell Scrolls"));
    expect(categoryRank("Adventuring Gear - Spell Scrolls"))
      .toBeLessThan(categoryRank("Wondrous Item"));
    expect(categoryRank("Wondrous Item")).toBeLessThan(categoryRank("Other"));
  });

  it("puts the Unknown bucket in the quick-access tier", () => {
    expect(categoryRank("Unknown")).toBeLessThan(categoryRank("Weapon"));
  });

  it("gives every unlisted category the same rank, so ties break alphabetically", () => {
    expect(categoryRank("Tool")).toBe(categoryRank("Animal"));
    expect(categoryRank("Homebrew Relics")).toBe(categoryRank("Tool"));
  });
});

describe("categoryCollapsedByDefault", () => {
  it("leaves the quick-access tier expanded", () => {
    for (const cat of ["Ammunition", "Consumable",
                       "Adventuring Gear - Spell Scrolls", "Wondrous Item",
                       "Other", "Unknown"]) {
      expect(categoryCollapsedByDefault(cat)).toBe(false);
    }
  });

  it("collapses weapons and armor", () => {
    expect(categoryCollapsedByDefault("Weapon")).toBe(true);
    expect(categoryCollapsedByDefault("Armor")).toBe(true);
  });

  it("collapses unlisted categories, including GM-invented ones", () => {
    expect(categoryCollapsedByDefault("Tool")).toBe(true);
    expect(categoryCollapsedByDefault("Spellcasting Focus")).toBe(true);
    expect(categoryCollapsedByDefault("Homebrew Relics")).toBe(true);
  });
});

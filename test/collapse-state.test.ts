import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadCollapseState, COLLAPSE_KEY } from "../src/collapse-state";

describe("loadCollapseState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back to the tier default when nothing is stored", () => {
    const state = loadCollapseState();
    expect(state.isCollapsed("Consumable")).toBe(false);
    expect(state.isCollapsed("Weapon")).toBe(true);
    expect(state.isCollapsed("Tool")).toBe(true);
  });

  it("honors a stored override that contradicts the tier default", () => {
    localStorage.setItem(COLLAPSE_KEY,
      JSON.stringify({ Weapon: false, Consumable: true }));
    const state = loadCollapseState();
    expect(state.isCollapsed("Weapon")).toBe(false);
    expect(state.isCollapsed("Consumable")).toBe(true);
  });

  it("applies tier defaults to categories absent from the stored map", () => {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify({ Weapon: false }));
    const state = loadCollapseState();
    // Never toggled, so it still follows the table rather than the blob.
    expect(state.isCollapsed("Armor")).toBe(true);
    expect(state.isCollapsed("Ammunition")).toBe(false);
    expect(state.isCollapsed("Homebrew Relics")).toBe(true);
  });

  it("persists an override to localStorage", () => {
    const state = loadCollapseState();
    state.set("Weapon", false);
    expect(JSON.parse(localStorage.getItem(COLLAPSE_KEY)!)).toEqual({ Weapon: false });
    expect(loadCollapseState().isCollapsed("Weapon")).toBe(false);
  });

  it("merges successive overrides rather than replacing them", () => {
    const state = loadCollapseState();
    state.set("Weapon", false);
    state.set("Consumable", true);
    expect(JSON.parse(localStorage.getItem(COLLAPSE_KEY)!))
      .toEqual({ Weapon: false, Consumable: true });
  });

  it("falls back to defaults when the stored value is malformed JSON", () => {
    localStorage.setItem(COLLAPSE_KEY, "not json {{{");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = loadCollapseState();
    expect(state.isCollapsed("Weapon")).toBe(true);
    expect(state.isCollapsed("Consumable")).toBe(false);
    warn.mockRestore();
  });

  it("ignores stored entries that are not booleans", () => {
    localStorage.setItem(COLLAPSE_KEY,
      JSON.stringify({ Weapon: "yes", Consumable: null, Armor: false }));
    const state = loadCollapseState();
    expect(state.isCollapsed("Weapon")).toBe(true);      // default, not "yes"
    expect(state.isCollapsed("Consumable")).toBe(false); // default, not null
    expect(state.isCollapsed("Armor")).toBe(false);      // the one valid override
  });

  it("falls back to defaults when the stored value is a JSON array", () => {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(["Weapon", "Armor"]));
    const state = loadCollapseState();
    expect(state.isCollapsed("Weapon")).toBe(true);
    expect(state.isCollapsed("Consumable")).toBe(false);
  });

  it("does not throw when localStorage access throws", () => {
    const getSpy = vi.spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => { throw new Error("blocked"); });
    const setSpy = vi.spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => { throw new Error("blocked"); });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    let state!: ReturnType<typeof loadCollapseState>;
    expect(() => { state = loadCollapseState(); }).not.toThrow();
    expect(() => state.set("Weapon", false)).not.toThrow();
    // The in-memory override still applies for this session.
    expect(state.isCollapsed("Weapon")).toBe(false);
    expect(state.isCollapsed("Armor")).toBe(true);

    getSpy.mockRestore();
    setSpy.mockRestore();
    warn.mockRestore();
  });
});

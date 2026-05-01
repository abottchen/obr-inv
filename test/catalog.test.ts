import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseCatalog, fetchCatalog, __resetCatalogCache } from "../src/catalog";

describe("parseCatalog", () => {
  it("accepts a fully-specified item", () => {
    const items = parseCatalog([
      { id: "h7p2Xy", name: "Healing Potion", category: "Consumables",
        icon: "u", description: "d", rarity: "uncommon", weight: 0.5 },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].rarity).toBe("uncommon");
  });

  it("tolerates null/missing rarity and weight", () => {
    const items = parseCatalog([
      { id: "a1", name: "X", category: "C", icon: "u", description: "d" },
      { id: "a2", name: "Y", category: "C", icon: "u", description: "d", rarity: null, weight: null },
    ]);
    expect(items).toHaveLength(2);
  });

  it("drops items missing required fields with a warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const items = parseCatalog([
      { id: "ok", name: "n", category: "c", icon: "u", description: "d" },
      { id: "bad", name: "n" },
    ]);
    expect(items).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("preserves unknown extra fields", () => {
    const items = parseCatalog([
      { id: "ok", name: "n", category: "c", icon: "u", description: "d", futureField: 42 },
    ]);
    expect(items[0].futureField).toBe(42);
  });

  it("deduplicates by id (first wins)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const items = parseCatalog([
      { id: "dup", name: "first", category: "c", icon: "u", description: "d" },
      { id: "dup", name: "second", category: "c", icon: "u", description: "d" },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("first");
    warn.mockRestore();
  });

  it("treats unknown rarity strings as undefined (renders as common at UI layer)", () => {
    const items = parseCatalog([
      { id: "ok", name: "n", category: "c", icon: "u", description: "d", rarity: "mythic" },
    ]);
    expect(items[0].rarity).toBeUndefined();
  });
});

describe("fetchCatalog", () => {
  const url = "https://example.test/items.json";

  beforeEach(() => {
    __resetCatalogCache();
    (globalThis as any).fetch = vi.fn();
  });

  it("retries once after a failed fetch", async () => {
    const f = (globalThis as any).fetch as ReturnType<typeof vi.fn>;
    f.mockRejectedValueOnce(new Error("net"))
     .mockResolvedValueOnce(new Response(JSON.stringify([
       { id: "a1", name: "N", category: "C", icon: "u", description: "d" },
     ]), { status: 200 }));
    const items = await fetchCatalog(url);
    expect(items).toHaveLength(1);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("throws after second failure", async () => {
    const f = (globalThis as any).fetch as ReturnType<typeof vi.fn>;
    f.mockRejectedValue(new Error("net"));
    await expect(fetchCatalog(url)).rejects.toThrow();
  });
});

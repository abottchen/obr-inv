import { describe, it, expect, beforeEach } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import { openAddDialog, closeAddDialog } from "../src/ui-add-dialog";
import type { CatalogItem } from "../src/types";

const catalog: CatalogItem[] = [
  { id: "h1", name: "Healing Potion", category: "Consumables",
    icon: "u", description: "d", rarity: "uncommon" },
  { id: "h2", name: "Greater Healing", category: "Consumables",
    icon: "u", description: "d", rarity: "rare" },
  { id: "a1", name: "+1 Arrows", category: "Weapons",
    icon: "u", description: "Sharp.", rarity: "rare" },
  { id: "x1", name: "Shield", category: "Armor",
    icon: "u", description: "Block.", rarity: "common" },
];

function groupCollapsedAttr(category: string): string | null {
  const g = document.querySelector(
    `.cat-group[data-category="${category}"]`,
  );
  return g?.getAttribute("data-collapsed") ?? null;
}

describe("ui-add-dialog default-collapsed behavior", () => {
  beforeEach(() => {
    __testHooks.reset();
    document.body.innerHTML = "";
    closeAddDialog();
  });

  it("opens with every category collapsed", () => {
    openAddDialog({ catalog, onAdd: async () => {} });

    expect(groupCollapsedAttr("Consumables")).toBe("true");
    expect(groupCollapsedAttr("Weapons")).toBe("true");
    expect(groupCollapsedAttr("Armor")).toBe("true");
  });

  it("auto-expands categories with matches when searching", () => {
    openAddDialog({ catalog, onAdd: async () => {} });

    const search = document.querySelector(
      ".dialog-overlay .shell-search",
    ) as HTMLInputElement;
    search.value = "potion";
    search.dispatchEvent(new Event("input"));

    // Consumables matches "potion" — must be expanded so the row is visible.
    expect(groupCollapsedAttr("Consumables")).toBe("false");
    // Other categories don't render at all when search excludes them.
    expect(groupCollapsedAttr("Weapons")).toBeNull();
  });

  it("restores user collapse state after clearing the search", () => {
    openAddDialog({ catalog, onAdd: async () => {} });

    // Open a category by clicking its header.
    const header = document.querySelector(
      '.cat-header[data-category="Consumables"]',
    ) as HTMLElement;
    header.click();
    // The click handler mutates state but doesn't rerender, so the data
    // attribute reflects the new state immediately.
    expect(groupCollapsedAttr("Consumables")).toBe("false");

    // Type something then clear it — Consumables should remain expanded.
    const search = document.querySelector(
      ".dialog-overlay .shell-search",
    ) as HTMLInputElement;
    search.value = "shield";
    search.dispatchEvent(new Event("input"));
    search.value = "";
    search.dispatchEvent(new Event("input"));

    expect(groupCollapsedAttr("Consumables")).toBe("false");
    expect(groupCollapsedAttr("Weapons")).toBe("true");
  });
});

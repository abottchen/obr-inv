import { describe, it, expect, beforeEach } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import { mountShell, type ShellHandlers } from "../src/ui-shell";
import { COLLAPSE_KEY } from "../src/collapse-state";
import type { CatalogItem, PlayerInventoryRecord } from "../src/types";

const catalog: CatalogItem[] = [
  { id: "potion", name: "Potion of Healing", category: "Consumable",
    icon: "https://example.com/p.png", description: "" },
  { id: "sword", name: "Longsword", category: "Weapon",
    icon: "https://example.com/s.png", description: "" },
  { id: "tools", name: "Thieves' Tools", category: "Tool",
    icon: "https://example.com/t.png", description: "" },
];

function rec(): PlayerInventoryRecord {
  return {
    name: "Alice", color: "#fff", w: "",
    items: [["potion", 2], ["sword", 1], ["tools", 1]],
    currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
  };
}

function noopHandlers(): ShellHandlers {
  return {
    onIncrement: async () => {},
    onDecrement: async () => {},
    onRemove: async () => {},
    onCurrencyChange: async () => {},
    onAddClick: () => {},
    onDescription: () => {},
  };
}

function mount(): HTMLElement {
  const root = document.createElement("div");
  document.body.appendChild(root);
  mountShell(root, rec(), catalog, noopHandlers());
  return root;
}

function collapsedAttr(root: HTMLElement, cat: string): string | null {
  return root.querySelector(`.cat-group[data-category="${cat}"]`)
    ?.getAttribute("data-collapsed") ?? null;
}

function headerFor(root: HTMLElement, cat: string): HTMLElement {
  return root.querySelector(`.cat-header[data-category="${cat}"]`) as HTMLElement;
}

function stored(): Record<string, boolean> {
  const raw = localStorage.getItem(COLLAPSE_KEY);
  return raw ? JSON.parse(raw) : {};
}

describe("ui-shell collapse defaults", () => {
  beforeEach(() => {
    __testHooks.reset();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("mounts with the quick-access tier expanded and the rest collapsed", () => {
    const root = mount();
    expect(collapsedAttr(root, "Consumable")).toBe("false");
    expect(collapsedAttr(root, "Weapon")).toBe("true");
    expect(collapsedAttr(root, "Tool")).toBe("true");
  });

  it("restores a persisted override on mount", () => {
    localStorage.setItem(COLLAPSE_KEY,
      JSON.stringify({ Weapon: false, Consumable: true }));
    const root = mount();
    expect(collapsedAttr(root, "Weapon")).toBe("false");
    expect(collapsedAttr(root, "Consumable")).toBe("true");
    // Untouched category still follows the tier default.
    expect(collapsedAttr(root, "Tool")).toBe("true");
  });

  it("persists a header toggle so the next mount honors it", () => {
    const root = mount();
    headerFor(root, "Weapon").click();
    expect(collapsedAttr(root, "Weapon")).toBe("false");
    expect(stored()).toEqual({ Weapon: false });

    document.body.innerHTML = "";
    const root2 = mount();
    expect(collapsedAttr(root2, "Weapon")).toBe("false");
  });

  it("persists collapse-all across every rendered category", () => {
    const root = mount();
    root.querySelector<HTMLButtonElement>('[title="Collapse all categories"]')!.click();
    expect(collapsedAttr(root, "Consumable")).toBe("true");
    expect(stored()).toEqual({ Consumable: true, Weapon: true, Tool: true });

    document.body.innerHTML = "";
    expect(collapsedAttr(mount(), "Consumable")).toBe("true");
  });

  it("persists expand-all across every rendered category", () => {
    const root = mount();
    root.querySelector<HTMLButtonElement>('[title="Expand all categories"]')!.click();
    expect(collapsedAttr(root, "Weapon")).toBe("false");
    expect(stored()).toEqual({ Consumable: false, Weapon: false, Tool: false });

    document.body.innerHTML = "";
    expect(collapsedAttr(mount(), "Weapon")).toBe("false");
  });
});

describe("ui-shell collapse during search", () => {
  beforeEach(() => {
    __testHooks.reset();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("expands matching groups while a search is active", () => {
    const root = mount();
    expect(collapsedAttr(root, "Weapon")).toBe("true");

    const search = root.querySelector(".shell-search") as HTMLInputElement;
    search.value = "longsword";
    search.dispatchEvent(new Event("input"));

    expect(collapsedAttr(root, "Weapon")).toBe("false");
    expect(root.querySelector('.inv-row[data-item-id="sword"]')).not.toBeNull();
  });

  it("restores the collapsed state when the search clears, storing nothing", () => {
    const root = mount();
    const search = root.querySelector(".shell-search") as HTMLInputElement;
    search.value = "longsword";
    search.dispatchEvent(new Event("input"));
    search.value = "";
    search.dispatchEvent(new Event("input"));

    expect(collapsedAttr(root, "Weapon")).toBe("true");
    expect(stored()).toEqual({});
  });
});

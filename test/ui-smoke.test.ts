import { describe, it, expect, beforeEach } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import { mountShell } from "../src/ui-shell";
import type { CatalogItem, PlayerInventoryRecord } from "../src/types";

const catalog: CatalogItem[] = [
  { id: "h1", name: "Healing Potion", category: "Consumables",
    icon: "u", description: "d", rarity: "uncommon", weight: 0.5 },
  { id: "a1", name: "+1 Arrows", category: "Weapons",
    icon: "u", description: "Sharp.", rarity: "rare" },
];

const record: PlayerInventoryRecord = {
  name: "Alice", color: "#fff",
  items: [["h1", 3], ["a1", 20]],
  currency: { pp: 0, gp: 142, sp: 7, cp: 3 },
};

describe("ui-shell smoke", () => {
  beforeEach(() => {
    __testHooks.reset();
    document.body.innerHTML = "";
  });

  it("mounts a shell with the right number of rows", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    mountShell(root, record, catalog, makeNoopHandlers());
    const rows = root.querySelectorAll(".inv-row");
    expect(rows.length).toBe(2);
  });

  it("hides ± and × buttons when locked", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    mountShell(root, record, catalog, makeNoopHandlers());
    expect(root.querySelectorAll('[data-action="dec"]').length).toBe(0);
    expect(root.querySelectorAll('[data-action="inc"]').length).toBe(0);
    expect(root.querySelectorAll('[data-action="remove"]').length).toBe(0);
  });

  it("reveals ± and × after clicking the lock toggle", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    mountShell(root, record, catalog, makeNoopHandlers());
    (root.querySelector(".lock-toggle") as HTMLButtonElement).click();
    expect(root.querySelectorAll('[data-action="dec"]').length).toBe(2);
    expect(root.querySelectorAll('[data-action="inc"]').length).toBe(2);
    expect(root.querySelectorAll('[data-action="remove"]').length).toBe(2);
  });

  it("filters by name only on search (description match doesn't show)", () => {
    const cat: CatalogItem[] = [
      { id: "x1", name: "Sword", category: "Weapons",
        icon: "u", description: "potion of stabbing" },
      { id: "x2", name: "Healing Potion", category: "Consumables",
        icon: "u", description: "drink" },
    ];
    const r: PlayerInventoryRecord = {
      name: "A", color: "#fff",
      items: [["x1", 1], ["x2", 1]],
      currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    };
    const root = document.createElement("div");
    document.body.appendChild(root);
    mountShell(root, r, cat, makeNoopHandlers());
    const search = root.querySelector(".shell-search") as HTMLInputElement;
    search.value = "potion";
    search.dispatchEvent(new Event("input"));
    const visibleNames = Array.from(root.querySelectorAll(".inv-name"))
      .map((el) => el.textContent ?? "");
    expect(visibleNames).toEqual(["Healing Potion"]);
  });
});

function makeNoopHandlers() {
  return {
    onIncrement: async () => {},
    onDecrement: async () => {},
    onRemove: async () => {},
    onCurrencyChange: async () => {},
    onAddClick: () => {},
    onDescription: () => {},
    onTransfer: () => {},
  };
}

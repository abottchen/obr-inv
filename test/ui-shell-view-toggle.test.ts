import { describe, it, expect, beforeEach, vi } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import { mountShell, type ShellHandlers } from "../src/ui-shell";
import type { CatalogItem, PlayerInventoryRecord } from "../src/types";

const catalog: CatalogItem[] = [
  { id: "h1", name: "Healing Potion", category: "Consumables",
    icon: "https://example.com/h.png", description: "", rarity: "uncommon" },
  { id: "a1", name: "+1 Arrows", category: "Weapons",
    icon: "https://example.com/a.png", description: "", rarity: "rare" },
];

const record: PlayerInventoryRecord = {
  name: "Alice", color: "#fff",
  items: [["h1", 3], ["a1", 5]],
  currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
};

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

describe("ui-shell view toggle", () => {
  beforeEach(() => {
    __testHooks.reset();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("renders a view-toggle button in the header", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    mountShell(root, record, catalog, noopHandlers());
    expect(root.querySelector(".shell-header .view-toggle")).not.toBeNull();
  });

  it("defaults to list view when localStorage has no value", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    mountShell(root, record, catalog, noopHandlers());
    expect(root.querySelectorAll(".inv-row").length).toBe(2);
    expect(root.querySelectorAll(".inv-cell").length).toBe(0);
  });

  it("renders grid view immediately when localStorage holds 'grid'", () => {
    localStorage.setItem("obr-inv:viewMode", "grid");
    const root = document.createElement("div");
    document.body.appendChild(root);
    mountShell(root, record, catalog, noopHandlers());
    expect(root.querySelectorAll(".inv-cell").length).toBe(2);
    expect(root.querySelectorAll(".inv-row").length).toBe(0);
  });

  it("falls back to list view when localStorage holds a malformed value", () => {
    localStorage.setItem("obr-inv:viewMode", "banana");
    const root = document.createElement("div");
    document.body.appendChild(root);
    mountShell(root, record, catalog, noopHandlers());
    expect(root.querySelectorAll(".inv-row").length).toBe(2);
    expect(root.querySelectorAll(".inv-cell").length).toBe(0);
  });

  it("clicking the segmented toggle swaps the rendered view and persists to localStorage", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    mountShell(root, record, catalog, noopHandlers());

    expect(root.querySelectorAll(".inv-row").length).toBe(2);
    expect(root.querySelectorAll(".inv-cell").length).toBe(0);

    // .view-toggle is the grid-mode button in the segmented control;
    // .view-seg button[data-mode="list"] is the list-mode button.
    const gridBtn = root.querySelector<HTMLButtonElement>(".view-toggle")!;
    const listBtn = root.querySelector<HTMLButtonElement>(
      '.view-seg button[data-mode="list"]',
    )!;
    gridBtn.click();

    expect(root.querySelectorAll(".inv-cell").length).toBe(2);
    expect(root.querySelectorAll(".inv-row").length).toBe(0);
    expect(localStorage.getItem("obr-inv:viewMode")).toBe("grid");

    listBtn.click();
    expect(root.querySelectorAll(".inv-row").length).toBe(2);
    expect(root.querySelectorAll(".inv-cell").length).toBe(0);
    expect(localStorage.getItem("obr-inv:viewMode")).toBe("list");
  });

  it("shows a global tooltip layer on cell mouseover and hides it on mouseout", () => {
    localStorage.setItem("obr-inv:viewMode", "grid");
    const root = document.createElement("div");
    document.body.appendChild(root);
    mountShell(root, record, catalog, noopHandlers());

    // Layer is attached to the shell wrap (or body), NOT inside .cat-body-inner.
    const layer = document.querySelector<HTMLElement>(".cell-tooltip-layer");
    expect(layer).not.toBeNull();
    // Layer's ancestors must not include any overflow:hidden cat-body-inner.
    expect(layer!.closest(".cat-body-inner")).toBeNull();

    const cell = root.querySelector<HTMLElement>('.inv-cell[data-item-id="h1"]')!;
    cell.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(layer!.textContent).toBe("Healing Potion");
    expect(layer!.dataset.rarity).toBe("uncommon");
    expect(layer!.style.display).not.toBe("none");

    cell.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }));
    expect(layer!.style.display).toBe("none");
  });

  it("threads unlocked, count, and edit handlers into onDescription ctx", async () => {
    let captured: { id: string; ctx: { unlocked: boolean; count: number; onIncrement: () => void; onDecrement: () => void; onRemove: () => void } } | null = null;
    let incCalls = 0;
    const handlers: ShellHandlers = {
      onIncrement: async () => { incCalls++; },
      onDecrement: async () => {},
      onRemove: async () => {},
      onCurrencyChange: async () => {},
      onAddClick: () => {},
      onDescription: (id, _anchor, ctx) => { captured = { id, ctx: ctx! }; },
    };
    const root = document.createElement("div");
    document.body.appendChild(root);
    mountShell(root, record, catalog, handlers);

    // Locked first
    const row = root.querySelector<HTMLElement>('.inv-row[data-item-id="h1"]')!;
    row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 1, clientY: 1 }));
    expect(captured).not.toBeNull();
    expect(captured!.ctx.unlocked).toBe(false);
    expect(captured!.ctx.count).toBe(3);

    // Unlock
    root.querySelector<HTMLButtonElement>(".lock-toggle")!.click();
    captured = null;
    const row2 = root.querySelector<HTMLElement>('.inv-row[data-item-id="h1"]')!;
    row2.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 1, clientY: 1 }));
    expect(captured!.ctx.unlocked).toBe(true);

    // Edit handlers in ctx invoke the underlying shell handlers
    captured!.ctx.onIncrement();
    await Promise.resolve();
    expect(incCalls).toBe(1);
  });

  it("does not throw when localStorage access throws", () => {
    const getSpy = vi.spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => { throw new Error("blocked"); });
    const setSpy = vi.spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => { throw new Error("blocked"); });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const root = document.createElement("div");
    document.body.appendChild(root);
    expect(() => mountShell(root, record, catalog, noopHandlers())).not.toThrow();
    expect(root.querySelectorAll(".inv-row").length).toBe(2);

    const gridBtn = root.querySelector<HTMLButtonElement>(".view-toggle")!;
    expect(() => gridBtn.click()).not.toThrow();
    expect(root.querySelectorAll(".inv-cell").length).toBe(2);

    getSpy.mockRestore();
    setSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

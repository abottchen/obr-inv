import { describe, it, expect, beforeEach } from "vitest";
import { renderGrid, type GridState, type GridHandlers } from "../src/ui-grid";
import { createPulseTracker } from "../src/ui-feedback";
import type { CatalogItem } from "../src/types";

const catalog: CatalogItem[] = [
  { id: "h1", name: "Healing Potion", category: "Consumables",
    icon: "https://example.com/heal.png", description: "", rarity: "uncommon" },
  { id: "h2", name: "Antitoxin",      category: "Consumables",
    icon: "https://example.com/anti.png", description: "" },
  { id: "a1", name: "+1 Arrows",      category: "Weapons",
    icon: "https://example.com/arr.png", description: "", rarity: "rare" },
  { id: "a2", name: "Dagger",         category: "Weapons",
    icon: "https://example.com/dag.png", description: "" },
];

function baseState(overrides: Partial<GridState> = {}): GridState {
  return {
    items: [],
    catalog,
    search: "",
    ghosts: new Set<string>(),
    tracker: createPulseTracker(),
    phantomRemoves: new Set<string>(),
    ...overrides,
  };
}

function noopHandlers(): GridHandlers {
  return {
    onDescription: () => {},
  };
}

function cellFor(root: HTMLElement, id: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`.inv-cell[data-item-id="${id}"]`);
}

describe("renderGrid", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders one .inv-cell per item in a flat grid", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    renderGrid(root, baseState({ items: [["h1", 2], ["a1", 5]] }), noopHandlers());

    expect(root.querySelector(".grid-cells")).not.toBeNull();
    expect(root.querySelectorAll(".cat-group").length).toBe(0);
    expect(root.querySelectorAll(".inv-cell").length).toBe(2);
    expect(cellFor(root, "h1")).not.toBeNull();
    expect(cellFor(root, "a1")).not.toBeNull();
  });

  it("sorts cells alphabetically within each category by item name", () => {
    const root = document.createElement("div");
    renderGrid(root, baseState({
      items: [["h1", 1], ["h2", 1]],
    }), noopHandlers());
    const cells = root.querySelectorAll<HTMLElement>(".inv-cell");
    expect([...cells].map((c) => c.dataset.itemId)).toEqual(["h2", "h1"]);
  });

  it("stamps data-rarity on cells with a known rarity", () => {
    const root = document.createElement("div");
    renderGrid(root, baseState({ items: [["a1", 1]] }), noopHandlers());
    expect(cellFor(root, "a1")?.dataset.rarity).toBe("rare");
  });

  it("shows a count badge with ×N when count > 1", () => {
    const root = document.createElement("div");
    renderGrid(root, baseState({ items: [["h1", 3]] }), noopHandlers());
    const badge = cellFor(root, "h1")?.querySelector(".cell-count");
    expect(badge?.textContent).toBe("×3");
  });

  it("hides the count badge when count === 1", () => {
    const root = document.createElement("div");
    renderGrid(root, baseState({ items: [["h1", 1]] }), noopHandlers());
    expect(cellFor(root, "h1")?.querySelector(".cell-count")).toBeNull();
  });

  it("renders a tooltip span carrying the item name", () => {
    const root = document.createElement("div");
    renderGrid(root, baseState({ items: [["a1", 1]] }), noopHandlers());
    const tip = cellFor(root, "a1")?.querySelector<HTMLElement>(".cell-tooltip");
    expect(tip?.textContent).toBe("+1 Arrows");
    expect(tip?.dataset.rarity).toBe("rare");
  });

  it("renders ❓ for missing-from-catalog items", () => {
    const root = document.createElement("div");
    renderGrid(root, baseState({ items: [["mystery", 1]] }), noopHandlers());
    const cell = cellFor(root, "mystery");
    expect(cell).not.toBeNull();
    expect(cell?.querySelector(".cell-image")?.textContent).toContain("❓");
  });

  it("cells carry no inline edit affordances (popover is the sole edit surface)", () => {
    const root = document.createElement("div");
    renderGrid(root, baseState({ items: [["h1", 2]] }), noopHandlers());
    expect(root.querySelectorAll('[data-action]').length).toBe(0);
  });

  it("right-click on a cell calls onDescription with the item id and click coordinates", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    let captured: { id: string; x: number; y: number } | null = null;
    renderGrid(root, baseState({ items: [["h1", 1]] }), {
      onDescription: (id, anchor) => {
        captured = { id, x: anchor.x, y: anchor.y };
      },
    });
    const cell = cellFor(root, "h1")!;
    const ev = new MouseEvent("contextmenu", { clientX: 42, clientY: 99, bubbles: true, cancelable: true });
    cell.dispatchEvent(ev);
    expect(captured).toEqual({ id: "h1", x: 42, y: 99 });
    expect(ev.defaultPrevented).toBe(true);
  });

  it("left-click on a cell also calls onDescription (popover-as-sole-edit-surface)", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    let captured: { id: string; x: number; y: number } | null = null;
    renderGrid(root, baseState({ items: [["h1", 1]] }), {
      onDescription: (id, anchor) => {
        captured = { id, x: anchor.x, y: anchor.y };
      },
    });
    const cell = cellFor(root, "h1")!;
    cell.dispatchEvent(new MouseEvent("click", { clientX: 11, clientY: 22, bubbles: true }));
    expect(captured).toEqual({ id: "h1", x: 11, y: 22 });
  });

  it("filters cells by search query", () => {
    const root = document.createElement("div");
    renderGrid(root, baseState({
      items: [["h1", 1], ["h2", 1], ["a1", 1]],
      search: "POT",
    }), noopHandlers());
    const ids = [...root.querySelectorAll<HTMLElement>(".inv-cell")].map((c) => c.dataset.itemId);
    expect(ids).toEqual(["h1"]);
  });

  it("renders the empty-state element when nothing matches", () => {
    const root = document.createElement("div");
    renderGrid(root, baseState({ items: [["h1", 1]], search: "xyzzy" }), noopHandlers());
    expect(root.querySelector(".empty-state")?.textContent).toBe('No items match "xyzzy"');
  });

  it("renders the evocative empty-pack state when inventory is empty", () => {
    const root = document.createElement("div");
    renderGrid(root, baseState({ items: [] }), noopHandlers());
    const empty = root.querySelector(".empty-state");
    expect(empty).not.toBeNull();
    expect(empty?.classList.contains("empty-pack")).toBe(true);
    expect(empty?.querySelector(".empty-title")?.textContent).toBe("Your pack is empty");
  });

  it("stamps data-pulse from the tracker onto cells", () => {
    const tracker = createPulseTracker();
    tracker.mark(new Map([["h1", { kind: "received", delta: 2 }]]));
    const root = document.createElement("div");
    renderGrid(root, baseState({ items: [["h1", 2]], tracker }), noopHandlers());
    expect(cellFor(root, "h1")?.dataset.pulse).toBe("received");
  });
});

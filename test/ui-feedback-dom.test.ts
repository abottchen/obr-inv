import { describe, it, expect, beforeEach, vi } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import { mountShell, type ShellHandlers } from "../src/ui-shell";
import type { CatalogItem, PlayerInventoryRecord } from "../src/types";

const catalog: CatalogItem[] = [
  { id: "h1", name: "Healing Potion", category: "Consumables",
    icon: "u", description: "d", rarity: "uncommon" },
  { id: "a1", name: "+1 Arrows", category: "Weapons",
    icon: "u", description: "Sharp.", rarity: "rare" },
  { id: "x1", name: "Shield", category: "Armor",
    icon: "u", description: "Block.", rarity: "common" },
];

function rec(items: Array<[string, number]>): PlayerInventoryRecord {
  return {
    name: "Alice", color: "#fff",
    items,
    currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
  };
}

function noop(): void {}
function makeHandlers(): ShellHandlers {
  return {
    onIncrement: async () => {},
    onDecrement: async () => {},
    onRemove: async () => {},
    onCurrencyChange: async () => {},
    onAddClick: noop,
    onDescription: noop,
    onTransfer: noop,
  };
}

function rowFor(root: HTMLElement, id: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`.inv-row[data-item-id="${id}"]`);
}

describe("ui-feedback DOM integration", () => {
  beforeEach(() => {
    __testHooks.reset();
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("emits data-pulse=inc and a +1 delta when count increases", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const refs = mountShell(root, rec([["h1", 3]]), catalog, makeHandlers());

    refs.rerender(rec([["h1", 4]]), catalog);

    const row = rowFor(root, "h1");
    expect(row?.dataset.pulse).toBe("inc");
    expect(row?.querySelector(".inv-delta")?.textContent).toBe("+1");
  });

  it("emits data-pulse=dec and a -1 delta when count decreases", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const refs = mountShell(root, rec([["h1", 3]]), catalog, makeHandlers());

    refs.rerender(rec([["h1", 2]]), catalog);

    const row = rowFor(root, "h1");
    expect(row?.dataset.pulse).toBe("dec");
    expect(row?.querySelector(".inv-delta")?.textContent).toBe("−1");
  });

  it("emits data-pulse=add for newly appearing items", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const refs = mountShell(root, rec([["h1", 1]]), catalog, makeHandlers());

    refs.rerender(rec([["h1", 1], ["x1", 2]]), catalog);

    const row = rowFor(root, "x1");
    expect(row?.dataset.pulse).toBe("add");
    expect(row?.querySelector(".inv-delta")?.textContent).toBe("+2");
  });

  it("renders a phantom row with data-pulse=remove for one render after removal", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const refs = mountShell(root, rec([["h1", 2], ["a1", 1]]), catalog, makeHandlers());

    refs.rerender(rec([["a1", 1]]), catalog);
    let row = rowFor(root, "h1");
    expect(row).not.toBeNull();
    expect(row?.dataset.pulse).toBe("remove");

    refs.rerender(rec([["a1", 1]]), catalog);
    row = rowFor(root, "h1");
    expect(row).toBeNull();
  });

  it("markReceived overrides a concurrent inc with received", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const refs = mountShell(root, rec([["h1", 3]]), catalog, makeHandlers());

    refs.markReceived("h1", 2);
    refs.rerender(rec([["h1", 5]]), catalog);

    const row = rowFor(root, "h1");
    expect(row?.dataset.pulse).toBe("received");
    expect(row?.querySelector(".inv-delta")?.textContent).toBe("+2");
  });

  it("auto-expands a collapsed category for received pulses", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const refs = mountShell(root, rec([["h1", 3]]), catalog, makeHandlers());

    const header = root.querySelector(
      '.cat-header[data-category="Consumables"]',
    ) as HTMLElement;
    header.click();
    expect(
      root.querySelector('.cat-group[data-category="Consumables"]')
        ?.getAttribute("data-collapsed"),
    ).toBe("true");

    refs.markReceived("h1", 1);
    refs.rerender(rec([["h1", 4]]), catalog);

    expect(
      root.querySelector('.cat-group[data-category="Consumables"]')
        ?.getAttribute("data-collapsed"),
    ).toBe("false");
  });

  it("clears data-pulse after the duration window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0));
    const root = document.createElement("div");
    document.body.appendChild(root);
    const refs = mountShell(root, rec([["h1", 3]]), catalog, makeHandlers());

    refs.rerender(rec([["h1", 4]]), catalog);
    expect(rowFor(root, "h1")?.dataset.pulse).toBe("inc");

    vi.advanceTimersByTime(701);
    refs.rerender(rec([["h1", 4]]), catalog);
    expect(rowFor(root, "h1")?.dataset.pulse).toBeUndefined();

    vi.useRealTimers();
  });
});

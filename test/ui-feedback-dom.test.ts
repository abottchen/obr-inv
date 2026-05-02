import { describe, it, expect, beforeEach, vi } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import { mountShell, type ShellHandlers, type DescriptionCtx } from "../src/ui-shell";
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
  };
}

/**
 * Edits now route through the description popover, which is built by
 * the shell at right-click / left-click time. Tests that need to invoke
 * a decrement/remove on a row simulate a click on the row to capture
 * the ctx, then call ctx.onDecrement() / ctx.onRemove() directly.
 */
function captureCtx(
  root: HTMLElement, baseHandlers: ShellHandlers,
): { handlers: ShellHandlers; openFor: (id: string) => DescriptionCtx } {
  const captured = new Map<string, DescriptionCtx>();
  const handlers: ShellHandlers = {
    ...baseHandlers,
    onDescription: (id, _anchor, ctx) => { captured.set(id, ctx); },
  };
  const openFor = (id: string): DescriptionCtx => {
    const row = root.querySelector<HTMLElement>(`.inv-row[data-item-id="${id}"]`);
    if (!row) throw new Error(`no row for ${id}`);
    row.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 1, clientY: 1 }));
    const ctx = captured.get(id);
    if (!ctx) throw new Error(`onDescription not called for ${id}`);
    return ctx;
  };
  return { handlers, openFor };
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

  it("keeps the row visible (as ghost) when decrement leaves count at 0", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const { handlers, openFor } = captureCtx(root, makeHandlers());
    const refs = mountShell(root, rec([["h1", 1]]), catalog, handlers);

    // Open the popover for h1 (left-click on row), capture its ctx, then
    // invoke onDecrement — the shell wraps that callback to add h1 to
    // its ghost set, which is the behaviour under test.
    openFor("h1").onDecrement();

    // Metadata round-trip: writeRecord runs pruneZeros, so the returned
    // record has h1 stripped entirely. The shell must re-inject it from
    // the ghost set so the row stays visible.
    refs.rerender(rec([]), catalog);

    const row = rowFor(root, "h1");
    expect(row).not.toBeNull();
    expect(row?.dataset.pulse).toBe("dec");
    expect(row?.querySelector(".inv-count")?.textContent).toContain("×0");
  });

  it("removes the ghost row when the user invokes the popover trashcan", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const { handlers, openFor } = captureCtx(root, makeHandlers());
    const refs = mountShell(root, rec([["h1", 1]]), catalog, handlers);

    openFor("h1").onDecrement();
    refs.rerender(rec([]), catalog); // ghost still visible

    expect(rowFor(root, "h1")).not.toBeNull();

    openFor("h1").onRemove();
    refs.rerender(rec([]), catalog); // first render: phantom-remove + leave anim

    let row = rowFor(root, "h1");
    expect(row?.dataset.pulse).toBe("remove");

    refs.rerender(rec([]), catalog); // second render: gone
    row = rowFor(root, "h1");
    expect(row).toBeNull();
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

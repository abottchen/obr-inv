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
  name: "Alice", color: "#fff", w: "",
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

function mount(handlers: ShellHandlers, options?: Parameters<typeof mountShell>[4]) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const refs = mountShell(root, record, catalog, handlers, options);
  return { root, refs };
}

describe("ui-shell read-only mode and stash hooks", () => {
  beforeEach(() => {
    __testHooks.reset();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("read-only mode renders no Add or Create buttons", () => {
    const { root } = mount(
      { ...noopHandlers(), onCreateCustomClick: () => {} },
      { readOnly: true },
    );
    expect(root.querySelector(".btn-add")).toBeNull();
    expect(root.querySelector(".btn-create")).toBeNull();
  });

  it("read-only mode makes coin inputs non-editable", () => {
    const onCurrencyChange = vi.fn(async () => {});
    const { root } = mount({ ...noopHandlers(), onCurrencyChange }, { readOnly: true });
    const inputs = root.querySelectorAll<HTMLInputElement>(".coin-input");
    expect(inputs.length).toBe(4);
    for (const inp of inputs) {
      expect(inp.readOnly).toBe(true);
      expect(inp.tabIndex).toBe(-1);
    }
    expect(root.querySelector<HTMLElement>(".gold-strip")!.dataset.readonly).toBe("true");
    inputs[1].value = "+5";
    inputs[1].dispatchEvent(new Event("change"));
    expect(onCurrencyChange).not.toHaveBeenCalled();
  });

  it("default mode leaves coin inputs editable and shows Add", () => {
    const { root } = mount(noopHandlers());
    expect(root.querySelector(".btn-add")).not.toBeNull();
    for (const inp of root.querySelectorAll<HTMLInputElement>(".coin-input")) {
      expect(inp.readOnly).toBe(false);
    }
  });

  it("title and subtitle overrides land in the brand row", () => {
    const { root } = mount(noopHandlers(), { title: "Mr. Stompy", subtitle: "Read only" });
    expect(root.querySelector(".brand-title")!.textContent).toBe("Mr. Stompy");
    expect(root.querySelector(".brand-sub")!.textContent).toBe("Read only");
  });

  it("defaults title to Tome of Holdings and subtitle to the record name", () => {
    const { root } = mount(noopHandlers());
    expect(root.querySelector(".brand-title")!.textContent).toBe("Tome of Holdings");
    expect(root.querySelector(".brand-sub")!.textContent).toBe("Alice");
  });

  it("onClose renders a close button that calls back", () => {
    const onClose = vi.fn();
    const { root } = mount(noopHandlers(), { onClose });
    const btn = root.querySelector<HTMLButtonElement>(".brand-close")!;
    expect(btn).not.toBeNull();
    btn.click();
    expect(onClose).toHaveBeenCalledTimes(1);

    const { root: root2 } = mount(noopHandlers());
    expect(root2.querySelector(".brand-close")).toBeNull();
  });

  it("onStashClick renders a hidden Stash button that setStashVisible reveals", () => {
    const onStashClick = vi.fn();
    const { root, refs } = mount({ ...noopHandlers(), onStashClick });
    const btn = root.querySelector<HTMLButtonElement>(".btn-stash")!;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe("Stash");
    expect(btn.hidden).toBe(true);
    refs.setStashVisible(true);
    expect(btn.hidden).toBe(false);
    btn.click();
    expect(onStashClick).toHaveBeenCalledTimes(1);
    const kids = Array.from(root.querySelector(".shell-actions")!.children);
    expect(kids.indexOf(btn)).toBeLessThan(kids.indexOf(root.querySelector(".btn-add")!));
  });

  it("without onStashClick there is no Stash button and setStashVisible is a no-op", () => {
    const { root, refs } = mount(noopHandlers());
    expect(root.querySelector(".btn-stash")).toBeNull();
    expect(() => refs.setStashVisible(true)).not.toThrow();
    expect(root.querySelector(".btn-stash")).toBeNull();
  });

  it("read-only: a focused coin input still refreshes on rerender", () => {
    const { root, refs } = mount(noopHandlers(), { readOnly: true });
    const gp = root.querySelector('[data-ccy="gp"] .coin-input') as HTMLInputElement;
    gp.focus();
    refs.rerender({ ...record, currency: { ...record.currency, gp: 999 } }, catalog);
    expect(gp.value).toBe("999");
  });

  it("default mode: a focused coin input is protected from rerender", () => {
    const { root, refs } = mount(noopHandlers());
    const gp = root.querySelector('[data-ccy="gp"] .coin-input') as HTMLInputElement;
    gp.focus();
    refs.rerender({ ...record, currency: { ...record.currency, gp: 999 } }, catalog);
    expect(gp.value).toBe("0");
  });

  it("read-only coins say Read only; default keeps the edit tip", () => {
    const ro = mount(noopHandlers(), { readOnly: true }).root;
    const inputs = Array.from(ro.querySelectorAll(".coin-input")) as HTMLElement[];
    const cells = Array.from(ro.querySelectorAll(".gold-cell")) as HTMLElement[];
    expect(inputs.length).toBeGreaterThan(0);
    expect(cells.length).toBeGreaterThan(0);
    for (const el of [...inputs, ...cells]) expect(el.title).toBe("Read only");
    const def = mount(noopHandlers()).root;
    for (const el of Array.from(def.querySelectorAll(".coin-input")) as HTMLElement[]) {
      expect(el.title.startsWith("Type a number")).toBe(true);
    }
  });
});

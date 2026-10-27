import { describe, it, expect, beforeEach } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import { openStash, updateStash, closeStash } from "../src/ui-stash";
import type { StashEntry } from "../src/stash";
import type { CatalogItem } from "../src/types";

const catalog: CatalogItem[] = [
  { id: "c1", name: "Canoe", category: "Adventuring Gear - Camping & Travel",
    icon: "https://example.com/c.png", description: "A canoe.", weight: 100 },
  { id: "b1", name: "Barrel", category: "Adventuring Gear - Camping & Travel",
    icon: "https://example.com/b.png", description: "A barrel.", weight: 70 },
];

function stompy(over: Partial<StashEntry["record"]> = {}): StashEntry {
  return {
    id: "npc-mr-stompy",
    record: {
      name: "Mr. Stompy", color: "#fff", w: "",
      items: [["c1", 1], ["b1", 1]],
      currency: { pp: 0, gp: 222, sp: 6, cp: 5 },
      ...over,
    },
  };
}
const wagon: StashEntry = {
  id: "npc-wagon",
  record: {
    name: "Wagon", color: "#fff", w: "",
    items: [["c1", 2]],
    currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
  },
};

const q = <T extends Element>(sel: string) => document.querySelector(sel) as T;
const qa = (sel: string) => Array.from(document.querySelectorAll(sel));
const text = (sel: string) => q(sel)?.textContent;
const coins = () => qa(".stash-panel .coin-input").map((i) => (i as HTMLInputElement).value);
const esc = (target: EventTarget) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

describe("ui-stash window", () => {
  beforeEach(() => {
    __testHooks.reset();
    document.body.innerHTML = "";
    closeStash();
    localStorage.clear();
  });

  it("opens with one stash: title, no pills, rows, coins", () => {
    openStash({ stashes: [stompy()], catalog });
    expect(q(".stash-panel")).not.toBeNull();
    expect(text(".stash-panel .brand-title")).toBe("Mr. Stompy");
    expect(text(".stash-panel .brand-sub")).toBe("Read only");
    expect(q(".stash-tabs")).toBeNull();
    expect(qa(".stash-panel .inv-row").length).toBe(2);
    expect(coins()).toEqual(["0", "222", "6", "5"]);
  });

  it("renders no edit affordances", () => {
    openStash({ stashes: [stompy()], catalog });
    expect(q(".btn-add")).toBeNull();
    expect(q(".btn-create")).toBeNull();
    expect(q(".btn-stash")).toBeNull();
    for (const i of qa(".coin-input")) expect((i as HTMLInputElement).readOnly).toBe(true);
  });

  it("two stashes render pills and clicking swaps the shell", () => {
    openStash({ stashes: [stompy(), wagon], catalog });
    const tabs = qa(".stash-tab") as HTMLButtonElement[];
    expect(tabs.length).toBe(2);
    expect(tabs[0].classList.contains("active")).toBe(true);
    tabs[1].click();
    expect(text(".stash-panel .brand-title")).toBe("Wagon");
    expect(qa(".stash-panel .inv-row").length).toBe(1);
    expect((qa(".stash-tab")[1]).classList.contains("active")).toBe(true);
  });

  it("updateStash re-renders a changed count in place", () => {
    openStash({ stashes: [stompy()], catalog });
    updateStash([stompy({
      items: [["c1", 3], ["b1", 1]],
      currency: { pp: 0, gp: 200, sp: 6, cp: 5 },
    })], catalog);
    expect(coins()[1]).toBe("200");
    const row = q<HTMLElement>('.inv-row[data-item-id="c1"]');
    expect(row.querySelector(".inv-count")!.textContent).toContain("×3");
  });

  it("updateStash falls back when the shown stash disappears", () => {
    openStash({ stashes: [stompy(), wagon], catalog });
    (qa(".stash-tab")[1] as HTMLButtonElement).click();
    updateStash([stompy()], catalog);
    expect(text(".stash-panel .brand-title")).toBe("Mr. Stompy");
    expect(q(".stash-tabs")).toBeNull();
  });

  it("updateStash with an empty list closes the window", () => {
    openStash({ stashes: [stompy()], catalog });
    updateStash([], catalog);
    expect(q(".stash-panel")).toBeNull();
    expect(q(".modal-backdrop")).toBeNull();
  });

  it("updateStash with a renamed stash updates the title", () => {
    openStash({ stashes: [stompy()], catalog });
    updateStash([stompy({ name: "Sir Stompy" })], catalog);
    expect(text(".stash-panel .brand-title")).toBe("Sir Stompy");
  });

  it("updateStash is a no-op when closed", () => {
    expect(() => updateStash([stompy()], catalog)).not.toThrow();
    expect(q(".stash-panel")).toBeNull();
  });

  it("close button, Escape, and backdrop mousedown each close", () => {
    openStash({ stashes: [stompy()], catalog });
    q<HTMLButtonElement>(".brand-close").click();
    expect(q(".modal-backdrop")).toBeNull();

    openStash({ stashes: [stompy()], catalog });
    esc(document.body);
    expect(q(".modal-backdrop")).toBeNull();

    openStash({ stashes: [stompy()], catalog });
    q(".modal-backdrop").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(q(".modal-backdrop")).toBeNull();
  });

  it("Escape with search text clears the search instead of closing; second Escape closes", () => {
    openStash({ stashes: [stompy()], catalog });
    const input = q<HTMLInputElement>(".stash-panel .shell-search");
    input.value = "can";
    esc(input);
    expect(q(".stash-panel")).not.toBeNull();
    expect(input.value).toBe("");
    esc(input);
    expect(q(".stash-panel")).toBeNull();
  });

  it("clicking a row opens a read-only description popover", () => {
    openStash({ stashes: [stompy()], catalog });
    q(".inv-row").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(q(".description-popover")).not.toBeNull();
    expect(q(".btn-step")).toBeNull();
    expect(q(".btn-x")).toBeNull();
    expect(q(".desc-transfer")).toBeNull();
  });

  it("closing the window also closes an open description popover", () => {
    openStash({ stashes: [stompy()], catalog });
    q(".inv-row").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(q(".description-popover")).not.toBeNull();
    closeStash();
    expect(q(".description-popover")).toBeNull();
  });

  it("items missing from the catalog still render", () => {
    openStash({ stashes: [stompy({ items: [["zzz", 1]] })], catalog });
    const rows = qa(".stash-panel .inv-row");
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector(".inv-name")!.textContent).toContain("missing from catalog");
  });

  it("Escape closes an open description popover first, then the window", async () => {
    openStash({ stashes: [stompy()], catalog });
    q(".inv-row").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0)); // popover registers its Escape listener on a 0ms timer
    expect(q(".description-popover")).not.toBeNull();
    esc(document.body);
    expect(q(".description-popover")).toBeNull();
    expect(q(".stash-panel")).not.toBeNull();
    esc(document.body);
    expect(q(".stash-panel")).toBeNull();
  });

  it("remounting on rename closes a stale description popover", () => {
    openStash({ stashes: [stompy()], catalog });
    q(".inv-row").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(q(".description-popover")).not.toBeNull();
    updateStash([stompy({ name: "Sir Stompy" })], catalog);
    expect(q(".description-popover")).toBeNull();
    expect(text(".stash-panel .brand-title")).toBe("Sir Stompy");
  });
});

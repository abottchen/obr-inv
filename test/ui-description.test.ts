import { describe, it, expect, beforeEach } from "vitest";
import { showDescription, closeDescription } from "../src/ui-description";
import type { CatalogItem } from "../src/types";

const item: CatalogItem = {
  id: "h1", name: "Healing Potion", category: "Consumables",
  icon: "u", description: "Restores HP.", rarity: "uncommon",
};

describe("ui-description popover", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    closeDescription();
  });

  it("right-click on the popover closes it", () => {
    showDescription({ x: 10, y: 10 }, item);
    const pop = document.querySelector(".description-popover") as HTMLElement;
    expect(pop).not.toBeNull();

    pop.dispatchEvent(new MouseEvent("contextmenu", {
      bubbles: true, cancelable: true,
    }));

    expect(document.querySelector(".description-popover")).toBeNull();
  });

  it("renders no Transfer button when no callback is provided", () => {
    showDescription({ x: 10, y: 10 }, item);
    expect(document.querySelector(".desc-transfer")).toBeNull();
  });

  it("renders a Transfer button when onTransfer is provided", () => {
    let invoked = false;
    showDescription({ x: 10, y: 10 }, item, undefined, {
      onTransfer: () => { invoked = true; },
    });
    const btn = document.querySelector(".desc-transfer") as HTMLButtonElement;
    expect(btn).not.toBeNull();

    btn.click();
    // Popover dismisses before invoking the callback.
    expect(document.querySelector(".description-popover")).toBeNull();
    expect(invoked).toBe(true);
  });

  it("preventDefault is called so the OS context menu doesn't appear", () => {
    showDescription({ x: 10, y: 10 }, item);
    const pop = document.querySelector(".description-popover") as HTMLElement;
    const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    pop.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});

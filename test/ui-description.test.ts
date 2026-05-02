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

  it("renders no edit controls when editControls is omitted", () => {
    showDescription({ x: 10, y: 10 }, item);
    expect(document.querySelector('[data-action="dec"]')).toBeNull();
    expect(document.querySelector('[data-action="inc"]')).toBeNull();
    expect(document.querySelector('[data-action="remove"]')).toBeNull();
    expect(document.querySelector(".desc-count")).toBeNull();
  });

  it("renders ± and trash buttons plus count when editControls is provided", () => {
    let inc = 0, dec = 0, rm = 0;
    showDescription({ x: 10, y: 10 }, item, undefined, {
      editControls: {
        count: 7,
        onIncrement: () => { inc++; },
        onDecrement: () => { dec++; },
        onRemove: () => { rm++; },
      },
    });
    const decBtn = document.querySelector<HTMLButtonElement>('[data-action="dec"]')!;
    const incBtn = document.querySelector<HTMLButtonElement>('[data-action="inc"]')!;
    const rmBtn  = document.querySelector<HTMLButtonElement>('[data-action="remove"]')!;
    expect(decBtn).not.toBeNull();
    expect(incBtn).not.toBeNull();
    expect(rmBtn).not.toBeNull();
    expect(document.querySelector(".desc-count")?.textContent).toBe("×7");

    decBtn.click(); incBtn.click(); rmBtn.click();
    expect(dec).toBe(1);
    expect(inc).toBe(1);
    expect(rm).toBe(1);
  });

  it("dismisses the popover when the trash button is clicked", () => {
    showDescription({ x: 10, y: 10 }, item, undefined, {
      editControls: {
        count: 3,
        onIncrement: () => {},
        onDecrement: () => {},
        onRemove: () => {},
      },
    });
    const rmBtn = document.querySelector<HTMLButtonElement>('[data-action="remove"]')!;
    rmBtn.click();
    expect(document.querySelector(".description-popover")).toBeNull();
  });

  it("updates the displayed count optimistically on + and − clicks", () => {
    showDescription({ x: 10, y: 10 }, item, undefined, {
      editControls: {
        count: 3,
        onIncrement: () => {},
        onDecrement: () => {},
        onRemove: () => {},
      },
    });
    const cnt = document.querySelector<HTMLElement>(".desc-count")!;
    expect(cnt.textContent).toBe("×3");

    document.querySelector<HTMLButtonElement>('[data-action="inc"]')!.click();
    expect(cnt.textContent).toBe("×4");

    document.querySelector<HTMLButtonElement>('[data-action="dec"]')!.click();
    expect(cnt.textContent).toBe("×3");
  });

  it("clamps the displayed count at 0 on repeated − clicks", () => {
    showDescription({ x: 10, y: 10 }, item, undefined, {
      editControls: {
        count: 1,
        onIncrement: () => {},
        onDecrement: () => {},
        onRemove: () => {},
      },
    });
    const cnt = document.querySelector<HTMLElement>(".desc-count")!;
    document.querySelector<HTMLButtonElement>('[data-action="dec"]')!.click();
    expect(cnt.textContent).toBe("×0");
    document.querySelector<HTMLButtonElement>('[data-action="dec"]')!.click();
    expect(cnt.textContent).toBe("×0");
  });

  it("renders a floating +1 / −1 delta on inc/dec click", () => {
    showDescription({ x: 10, y: 10 }, item, undefined, {
      editControls: {
        count: 3,
        onIncrement: () => {},
        onDecrement: () => {},
        onRemove: () => {},
      },
    });
    const delta = document.querySelector<HTMLElement>(".desc-delta")!;
    expect(delta).not.toBeNull();
    document.querySelector<HTMLButtonElement>('[data-action="inc"]')!.click();
    expect(delta.textContent).toBe("+1");
    document.querySelector<HTMLButtonElement>('[data-action="dec"]')!.click();
    expect(delta.textContent).toBe("−1");
  });

  it("stamps data-pulse=inc on the count after + click and dec after −", () => {
    showDescription({ x: 10, y: 10 }, item, undefined, {
      editControls: {
        count: 2,
        onIncrement: () => {},
        onDecrement: () => {},
        onRemove: () => {},
      },
    });
    const cnt = document.querySelector<HTMLElement>(".desc-count")!;
    document.querySelector<HTMLButtonElement>('[data-action="inc"]')!.click();
    expect(cnt.dataset.pulse).toBe("inc");
    document.querySelector<HTMLButtonElement>('[data-action="dec"]')!.click();
    expect(cnt.dataset.pulse).toBe("dec");
  });

  it("renders edit controls alongside the Transfer button when both are provided", () => {
    showDescription({ x: 10, y: 10 }, item, undefined, {
      onTransfer: () => {},
      editControls: {
        count: 1,
        onIncrement: () => {},
        onDecrement: () => {},
        onRemove: () => {},
      },
    });
    expect(document.querySelector(".desc-transfer")).not.toBeNull();
    expect(document.querySelector('[data-action="inc"]')).not.toBeNull();
  });
});

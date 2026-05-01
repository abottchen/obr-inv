import { describe, it, expect, beforeEach, vi } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import {
  closeCustomsDialog, openCustomsDialog,
} from "../src/ui-customs-dialog";
import type { CatalogItem, CustomItem } from "../src/types";

const resolved: CatalogItem[] = [
  { id: "h1", name: "Healing Potion", category: "Consumables",
    icon: "u", description: "d", rarity: "uncommon" },
  { id: "s1", name: "Sword", category: "Weapons",
    icon: "u", description: "d" },
];

describe("ui-customs-dialog smoke", () => {
  beforeEach(() => {
    __testHooks.reset();
    document.body.innerHTML = "";
    closeCustomsDialog();
  });

  it("mounts in create mode with all required fields and Save initially disabled", () => {
    openCustomsDialog({ resolved, onSave: vi.fn() });
    const dialog = document.querySelector(".customs-dialog") as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.querySelector("h3")?.textContent).toBe("Create custom item");
    const save = dialog.querySelector(".btn-save") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it("validates required fields and enables Save when filled", () => {
    openCustomsDialog({ resolved, onSave: vi.fn() });
    const dialog = document.querySelector(".customs-dialog") as HTMLElement;
    const inputs = dialog.querySelectorAll<HTMLInputElement>("input.customs-input");
    const [name, category, icon] = Array.from(inputs);
    const desc = dialog.querySelector("textarea") as HTMLTextAreaElement;
    const save = dialog.querySelector(".btn-save") as HTMLButtonElement;

    name.value = "Flower";
    name.dispatchEvent(new Event("input"));
    expect(save.disabled).toBe(true);

    category.value = "Misc";
    category.dispatchEvent(new Event("input"));
    expect(save.disabled).toBe(true);

    desc.value = "A small bloom";
    desc.dispatchEvent(new Event("input"));
    expect(save.disabled).toBe(false);

    // Bad URL re-disables
    icon.value = "ftp://nope";
    icon.dispatchEvent(new Event("input"));
    expect(save.disabled).toBe(true);

    icon.value = "";
    icon.dispatchEvent(new Event("input"));
    expect(save.disabled).toBe(false);

    icon.value = "https://example.test/x.png";
    icon.dispatchEvent(new Event("input"));
    expect(save.disabled).toBe(false);
  });

  it("Save calls onSave with a normalized custom item", async () => {
    const onSave = vi.fn(async (_item: CustomItem) => {});
    openCustomsDialog({ resolved, prefillName: "flower", onSave });
    const dialog = document.querySelector(".customs-dialog") as HTMLElement;
    const inputs = dialog.querySelectorAll<HTMLInputElement>("input.customs-input");
    const [name, category] = Array.from(inputs);
    const desc = dialog.querySelector("textarea") as HTMLTextAreaElement;
    const save = dialog.querySelector(".btn-save") as HTMLButtonElement;
    const raritySel = dialog.querySelector("select") as HTMLSelectElement;

    expect(name.value).toBe("flower");
    category.value = "Misc";
    category.dispatchEvent(new Event("input"));
    desc.value = "  A bloom  ";
    desc.dispatchEvent(new Event("input"));
    raritySel.value = "rare";

    save.click();
    // Defer assertions until the click handler's microtask completes.
    await Promise.resolve();
    await Promise.resolve();

    expect(onSave).toHaveBeenCalledTimes(1);
    const arg = onSave.mock.calls[0][0];
    expect(arg.name).toBe("flower");
    expect(arg.category).toBe("Misc");
    expect(arg.description).toBe("A bloom");
    expect(arg.rarity).toBe("rare");
    expect(arg.weight).toBeNull();
    expect(arg.id).toMatch(/^[0-9A-Za-z]{6}$/);
  });

  it("edit mode prefills fields from the initial item and reuses its id", async () => {
    const initial: CustomItem = {
      id: "abc123", name: "Flower", category: "Misc",
      icon: "https://example.test/f.png", description: "A bloom",
      rarity: "uncommon", weight: 1.5,
    };
    const onSave = vi.fn(async (_item: CustomItem) => {});
    openCustomsDialog({ resolved, initial, onSave });
    const dialog = document.querySelector(".customs-dialog") as HTMLElement;
    expect(dialog.querySelector("h3")?.textContent).toBe("Edit custom item");

    const save = dialog.querySelector(".btn-save") as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    save.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].id).toBe("abc123");
  });
});

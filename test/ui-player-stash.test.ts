import { describe, it, expect, beforeEach, vi } from "vitest";
import { OBR, __testHooks } from "./_mocks/obr-sdk";
import { recordKey } from "../src/metadata";
import { mountPlayerView } from "../src/ui-player";
import { closeStash } from "../src/ui-stash";
import type { PlayerInventoryRecord } from "../src/types";

const rec = (name: string, gp = 0): PlayerInventoryRecord => ({
  w: "", name, color: "#888888", items: [], currency: { pp: 0, gp, sp: 0, cp: 0 },
});
const selfRecord = rec("Alice");
const stash = (gp = 0) => rec("Mr. Stompy", gp);

let root: HTMLElement;
const mount = () => {
  root = document.createElement("div");
  document.body.appendChild(root);
  return mountPlayerView({
    root, catalog: [], initialCustoms: [], playerId: "player-self", initialRecord: selfRecord,
  });
};
const btn = () => root.querySelector<HTMLButtonElement>(".btn-stash")!;
const gpInput = () =>
  document.querySelectorAll<HTMLInputElement>(".stash-panel .coin-input")[1];

beforeEach(() => {
  __testHooks.reset();
  document.body.innerHTML = "";
  localStorage.clear();
  closeStash();
  __testHooks.store.set(recordKey("player-self"), selfRecord);
});

describe("player view stash button", () => {
  it("shows the Stash button after mount when a stash record already exists", async () => {
    __testHooks.store.set(recordKey("npc-mr-stompy"), stash());
    mount();
    await vi.waitFor(() => expect(btn().hidden).toBe(false));
  });

  it("hides the Stash button when the room has no stash records", async () => {
    mount();
    await new Promise((r) => setTimeout(r, 0));
    expect(btn().hidden).toBe(true);
  });

  it("reveals the button when a stash record appears, and hides it when it is deleted", async () => {
    mount();
    await OBR.room.setMetadata({ [recordKey("npc-mr-stompy")]: stash() });
    expect(btn().hidden).toBe(false);
    await OBR.room.setMetadata({ [recordKey("npc-mr-stompy")]: undefined });
    expect(btn().hidden).toBe(true);
  });

  it("clicking Stash opens the window for the stash", async () => {
    __testHooks.store.set(recordKey("npc-mr-stompy"), stash());
    mount();
    await vi.waitFor(() => expect(btn().hidden).toBe(false));
    btn().click();
    expect(document.querySelector(".stash-panel")).not.toBeNull();
    expect(document.querySelector(".stash-panel .brand-title")?.textContent).toBe("Mr. Stompy");
  });

  it("live changes to the stash re-render the open window", async () => {
    __testHooks.store.set(recordKey("npc-mr-stompy"), stash());
    mount();
    await vi.waitFor(() => expect(btn().hidden).toBe(false));
    btn().click();
    await OBR.room.setMetadata({ [recordKey("npc-mr-stompy")]: stash(300) });
    expect(gpInput().value).toBe("300");
  });

  it("a metadata event without the player's own record still updates the stash UI", async () => {
    __testHooks.store.set(recordKey("npc-mr-stompy"), stash());
    mount();
    await vi.waitFor(() => expect(btn().hidden).toBe(false));
    btn().click();
    await OBR.room.setMetadata({
      [recordKey("player-self")]: undefined,
      [recordKey("npc-mr-stompy")]: stash(1),
    });
    expect(document.querySelector(".stash-panel")).not.toBeNull();
    expect(gpInput().value).toBe("1");
  });

  it("deleting the last stash while the window is open closes it", async () => {
    __testHooks.store.set(recordKey("npc-mr-stompy"), stash());
    mount();
    await vi.waitFor(() => expect(btn().hidden).toBe(false));
    btn().click();
    await OBR.room.setMetadata({ [recordKey("npc-mr-stompy")]: undefined });
    expect(document.querySelector(".stash-panel")).toBeNull();
    expect(btn().hidden).toBe(true);
  });

  it("teardown closes the window", async () => {
    __testHooks.store.set(recordKey("npc-mr-stompy"), stash());
    const destroy = mount();
    await vi.waitFor(() => expect(btn().hidden).toBe(false));
    btn().click();
    expect(document.querySelector(".stash-panel")).not.toBeNull();
    destroy();
    expect(document.querySelector(".stash-panel")).toBeNull();
  });
});

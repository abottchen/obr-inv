import { describe, it, expect } from "vitest";
import { isStashId, selectStashes } from "../src/stash";
import type { PlayerInventoryRecord } from "../src/types";

const rec = (name: string): PlayerInventoryRecord => ({
  w: "", name, color: "#000", items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
});

describe("isStashId", () => {
  it("accepts the npc- prefix", () => expect(isStashId("npc-mr-stompy")).toBe(true));
  it("rejects a UUID-shaped player id", () =>
    expect(isStashId("70e514a9-1dc6-4752-962c-614fe150b233")).toBe(false));
  it("rejects npc- appearing anywhere but the start", () =>
    expect(isStashId("x-npc-y")).toBe(false));
});

describe("selectStashes", () => {
  it("returns only stash records, sorted by name, carrying their ids", () => {
    const out = selectStashes({
      "npc-wagon": rec("Wagon"),
      "player-1": rec("Alice"),
      "npc-mr-stompy": rec("Mr. Stompy"),
    });
    expect(out.map((s) => s.id)).toEqual(["npc-mr-stompy", "npc-wagon"]);
    expect(out[0].record.name).toBe("Mr. Stompy");
  });
  it("drops malformed records instead of throwing", () => {
    const bad = { w: "", name: "Broken", color: "#000" } as unknown as PlayerInventoryRecord;
    const noCurrency = { w: "", name: "NoCoins", color: "#000", items: [] } as unknown as PlayerInventoryRecord;
    const out = selectStashes({ "npc-bad": bad, "npc-nocoins": noCurrency, "npc-ok": rec("Ok") });
    expect(out.map((s) => s.id)).toEqual(["npc-ok"]);
  });
  it("returns an empty array when there are no stash records", () =>
    expect(selectStashes({ "player-1": rec("Alice") })).toEqual([]));
});

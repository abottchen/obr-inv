import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { OBR, __testHooks } from "./_mocks/obr-sdk";
import { __atomicTestHooks } from "../src/atomic";
import { writeRecord, getRecord } from "../src/metadata";
import * as mergeMod from "../src/merge";
import { planHeal, runHeal } from "../src/heal";
import type { PlayerInventoryRecord } from "../src/types";

// Partial-mock merge so the resilience test can spy on executeMerge while all
// other tests use the real implementation (spread from the actual module).
vi.mock("../src/merge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/merge")>()),
}));

const seedRecord = async (
  pid: string,
  name: string,
  items: [string, number][] = [],
  currency = { pp: 0, gp: 0, sp: 0, cp: 0 },
) => {
  await writeRecord(
    pid,
    () => ({ w: "", name, color: "#fff", items, currency }),
    { description: `seed ${pid}` },
  );
};

const party = (id: string) => [{ id, name: "ScorpioTHK", color: "#ffd433" }];

const rec = (
  name: string,
  items: [string, number][] = [],
  currency = { pp: 0, gp: 0, sp: 0, cp: 0 },
): PlayerInventoryRecord => ({ w: "", name, color: "#fff", items, currency });

describe("planHeal (pure)", () => {
  it("returns null when no record matches the name", () => {
    const records = { a: rec("Someone"), b: rec("Else") };
    expect(planHeal("ScorpioTHK", "live", records)).toBeNull();
  });

  it("returns null when only the live-id record has the name", () => {
    const records = { live: rec("ScorpioTHK", [["sword", 1]]) };
    expect(planHeal("ScorpioTHK", "live", records)).toBeNull();
  });

  it("plans a merge for a blank live record plus a full stale record", () => {
    const records = {
      live: rec("ScorpioTHK"),
      old: rec("ScorpioTHK", [["sword", 1]]),
    };
    expect(planHeal("ScorpioTHK", "live", records)).toEqual({
      targetId: "live",
      sourceIds: ["old"],
    });
  });

  it("plans a re-key when there is no live record but a full stale record", () => {
    const records = { old: rec("ScorpioTHK", [["sword", 1]]) };
    expect(planHeal("ScorpioTHK", "live", records)).toEqual({
      targetId: "live",
      sourceIds: ["old"],
    });
  });

  it("returns null for a single empty stale record with no live record", () => {
    const records = { old: rec("ScorpioTHK") };
    expect(planHeal("ScorpioTHK", "live", records)).toBeNull();
  });

  it("re-keys an empty stale record when it carries currency", () => {
    const records = { old: rec("ScorpioTHK", [], { pp: 0, gp: 5, sp: 0, cp: 0 }) };
    expect(planHeal("ScorpioTHK", "live", records)).toEqual({
      targetId: "live",
      sourceIds: ["old"],
    });
  });

  it("lists all stale records as sources", () => {
    const records = {
      live: rec("ScorpioTHK"),
      old1: rec("ScorpioTHK", [["a", 1]]),
      old2: rec("ScorpioTHK", [["b", 2]]),
    };
    const plan = planHeal("ScorpioTHK", "live", records);
    expect(plan?.targetId).toBe("live");
    expect(plan?.sourceIds.sort()).toEqual(["old1", "old2"]);
  });

  it("matches the name case-insensitively and trims whitespace", () => {
    const records = { old: rec("  scorpiothk ", [["a", 1]]) };
    expect(planHeal("ScorpioTHK", "live", records)).toEqual({
      targetId: "live",
      sourceIds: ["old"],
    });
  });

  it("removes a duplicate blank stale record even when the live record is blank", () => {
    const records = { live: rec("ScorpioTHK"), old: rec("ScorpioTHK") };
    expect(planHeal("ScorpioTHK", "live", records)).toEqual({
      targetId: "live",
      sourceIds: ["old"],
    });
  });
});

describe("runHeal (integration)", () => {
  beforeEach(() => { __testHooks.reset(); __atomicTestHooks.reset(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("merges a full stale record into the blank live record and notifies", async () => {
    await seedRecord("scorpio-old", "ScorpioTHK", [["sword", 3]], { pp: 0, gp: 50, sp: 0, cp: 0 });
    await seedRecord("scorpio-new", "ScorpioTHK");

    await runHeal(party("scorpio-new"));

    expect(await getRecord("scorpio-old")).toBeNull();
    const live = await getRecord("scorpio-new");
    expect(live?.items).toEqual([["sword", 3]]);
    expect(live?.currency.gp).toBe(50);
    expect(OBR.notification.show).toHaveBeenCalledTimes(1);
  });

  it("creates the live record and re-keys when he has not opened his popover", async () => {
    await seedRecord("scorpio-old", "ScorpioTHK", [["potion", 2]]);

    await runHeal(party("scorpio-new"));

    expect(await getRecord("scorpio-old")).toBeNull();
    const live = await getRecord("scorpio-new");
    expect(live?.items).toEqual([["potion", 2]]);
    expect(OBR.notification.show).toHaveBeenCalledTimes(1);
  });

  it("does nothing when only the live record exists", async () => {
    await seedRecord("scorpio-new", "ScorpioTHK", [["sword", 1]]);

    await runHeal(party("scorpio-new"));

    const live = await getRecord("scorpio-new");
    expect(live?.items).toEqual([["sword", 1]]);
    expect(OBR.notification.show).not.toHaveBeenCalled();
  });

  it("does nothing when the target player is not connected", async () => {
    await seedRecord("scorpio-old", "ScorpioTHK", [["sword", 1]]);

    await runHeal([{ id: "someone", name: "NotScorpio", color: "#fff" }]);

    expect(await getRecord("scorpio-old")).not.toBeNull();
    expect(OBR.notification.show).not.toHaveBeenCalled();
  });

  it("continues past a failed merge and still heals the rest", async () => {
    await seedRecord("old1", "ScorpioTHK", [["sword", 1]]);
    await seedRecord("old2", "ScorpioTHK", [["shield", 1]]);
    const real = mergeMod.executeMerge;
    vi.spyOn(mergeMod, "executeMerge").mockImplementation((t, s, o) =>
      s === "old1" ? Promise.reject(new Error("boom")) : real(t, s, o),
    );

    await runHeal(party("scorpio-new"));

    const live = await getRecord("scorpio-new");
    expect(live?.items).toEqual([["shield", 1]]);   // old2 merged in
    expect(await getRecord("old1")).not.toBeNull();  // failed source left intact
    expect(await getRecord("old2")).toBeNull();      // successful source deleted
  });
});

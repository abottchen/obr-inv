import { describe, it, expect } from "vitest";
import { planHeal } from "../src/heal";
import type { PlayerInventoryRecord } from "../src/types";

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

import { describe, it, expect } from "vitest";
import { createPulseTracker } from "../src/ui-feedback";
import type { PlayerInventoryRecord } from "../src/types";

function rec(items: Array<[string, number]>): PlayerInventoryRecord {
  return {
    name: "T", color: "#000",
    items,
    currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
  };
}

describe("PulseTracker.diff", () => {
  const t = createPulseTracker();

  it("returns empty map when prev is null", () => {
    const out = t.diff(null, rec([["a", 1]]));
    expect(out.size).toBe(0);
  });

  it("flags added ids as 'add' with delta = next count", () => {
    const out = t.diff(rec([]), rec([["a", 3]]));
    expect(out.get("a")).toEqual({ kind: "add", delta: 3 });
  });

  it("flags removed ids as 'remove' with no delta", () => {
    const out = t.diff(rec([["a", 2]]), rec([]));
    expect(out.get("a")).toEqual({ kind: "remove" });
  });

  it("flags count-up as 'inc' with positive delta", () => {
    const out = t.diff(rec([["a", 2]]), rec([["a", 5]]));
    expect(out.get("a")).toEqual({ kind: "inc", delta: 3 });
  });

  it("flags count-down (>0) as 'dec' with negative delta", () => {
    const out = t.diff(rec([["a", 5]]), rec([["a", 2]]));
    expect(out.get("a")).toEqual({ kind: "dec", delta: -3 });
  });

  it("flags count → 0 as 'remove'", () => {
    const out = t.diff(rec([["a", 2]]), rec([["a", 0]]));
    expect(out.get("a")).toEqual({ kind: "remove" });
  });

  it("skips ids with unchanged count", () => {
    const out = t.diff(rec([["a", 2]]), rec([["a", 2]]));
    expect(out.has("a")).toBe(false);
  });

  it("captures multiple ids in one diff", () => {
    const out = t.diff(
      rec([["a", 1], ["b", 3]]),
      rec([["a", 2], ["c", 1]]),
    );
    expect(out.get("a")).toEqual({ kind: "inc", delta: 1 });
    expect(out.get("b")).toEqual({ kind: "remove" });
    expect(out.get("c")).toEqual({ kind: "add", delta: 1 });
  });
});

describe("PulseTracker.mark + consume", () => {
  it("returns the marked kind during the duration window", () => {
    let now = 1000;
    const t = createPulseTracker(() => now);
    t.mark(new Map([["a", { kind: "inc", delta: 1 }]]));
    expect(t.consume("a")?.kind).toBe("inc");
    now = 1500;
    expect(t.consume("a")?.kind).toBe("inc");
  });

  it("returns null after the duration window expires", () => {
    let now = 1000;
    const t = createPulseTracker(() => now);
    t.mark(new Map([["a", { kind: "inc", delta: 1 }]]));
    now = 1701;
    expect(t.consume("a")).toBe(null);
    expect(t.consume("a")).toBe(null);
  });

  it("does not allow lower-priority kind to overwrite a higher-priority one", () => {
    const t = createPulseTracker(() => 1000);
    t.mark(new Map([["a", { kind: "received", delta: 2 }]]));
    t.mark(new Map([["a", { kind: "inc", delta: 1 }]]));
    expect(t.consume("a")?.kind).toBe("received");
  });

  it("allows higher-priority kind to overwrite a lower-priority one", () => {
    const t = createPulseTracker(() => 1000);
    t.mark(new Map([["a", { kind: "inc", delta: 1 }]]));
    t.mark(new Map([["a", { kind: "received", delta: 2 }]]));
    expect(t.consume("a")?.kind).toBe("received");
    expect(t.consume("a")?.delta).toBe(2);
  });

  it("refreshes the timestamp on same-kind re-mark", () => {
    let now = 1000;
    const t = createPulseTracker(() => now);
    t.mark(new Map([["a", { kind: "inc", delta: 1 }]]));
    now = 1500;
    t.mark(new Map([["a", { kind: "inc", delta: 1 }]]));
    now = 2100; // 600ms past second mark; still inside the 700ms window
    expect(t.consume("a")?.kind).toBe("inc");
  });

  it("returns null for unmarked ids", () => {
    const t = createPulseTracker();
    expect(t.consume("never")).toBe(null);
  });

  it("uses 1500ms window for received", () => {
    let now = 1000;
    const t = createPulseTracker(() => now);
    t.mark(new Map([["a", { kind: "received", delta: 2 }]]));
    now = 2400; // 1400ms in
    expect(t.consume("a")?.kind).toBe("received");
    now = 2501; // 1501ms in
    expect(t.consume("a")).toBe(null);
  });

  it("uses 400ms window for remove", () => {
    let now = 1000;
    const t = createPulseTracker(() => now);
    t.mark(new Map([["a", { kind: "remove" }]]));
    now = 1399;
    expect(t.consume("a")?.kind).toBe("remove");
    now = 1401;
    expect(t.consume("a")).toBe(null);
  });
});

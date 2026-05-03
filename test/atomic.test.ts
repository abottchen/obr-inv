import { describe, it, expect, beforeEach } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import { parseWriter, randomNonce, __atomicTestHooks, _internal_getLatestWriter } from "../src/atomic";

describe("parseWriter", () => {
  it("splits playerId and nonce on the first colon", () => {
    expect(parseWriter("alice-id:V1StGXR8")).toEqual({
      playerId: "alice-id",
      nonce: "V1StGXR8",
    });
  });

  it("returns playerId=null for empty (legacy) writers", () => {
    expect(parseWriter("")).toEqual({ playerId: null, nonce: "" });
  });

  it("returns playerId=null when no colon is present", () => {
    expect(parseWriter("garbled")).toEqual({ playerId: null, nonce: "garbled" });
  });

  it("preserves additional colons in the nonce portion", () => {
    expect(parseWriter("alice:abc:def")).toEqual({
      playerId: "alice",
      nonce: "abc:def",
    });
  });
});

describe("randomNonce", () => {
  it("returns 8 base62 characters", () => {
    const n = randomNonce();
    expect(n).toMatch(/^[0-9A-Za-z]{8}$/);
  });

  it("returns different values across calls (probabilistic)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(randomNonce());
    expect(seen.size).toBe(100);
  });
});

describe("echo tracker", () => {
  beforeEach(() => {
    __testHooks.reset();
    __atomicTestHooks.reset();
  });

  it("captures w from each key in onMetadataChange events", async () => {
    __atomicTestHooks.startTracker();
    // simulate a setMetadata that triggers onMetadataChange
    const key = "com.abottchen.obr-inv/v1/p1";
    await (await import("@owlbear-rodeo/sdk")).default.room.setMetadata({
      [key]: { w: "alice:abc12345", name: "X", color: "#fff", items: [], currency: { pp:0, gp:0, sp:0, cp:0 } },
    });
    expect(_internal_getLatestWriter(key)).toBe("alice:abc12345");
  });

  it("synthesizes empty writer for legacy (missing w) values", async () => {
    __atomicTestHooks.startTracker();
    const key = "com.abottchen.obr-inv/v1/legacy";
    await (await import("@owlbear-rodeo/sdk")).default.room.setMetadata({
      [key]: { name: "L", color: "#fff", items: [], currency: { pp:0, gp:0, sp:0, cp:0 } },
    });
    expect(_internal_getLatestWriter(key)).toBe("");
  });
});

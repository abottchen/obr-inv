import { describe, it, expect } from "vitest";
import { parseWriter } from "../src/atomic";
import { randomNonce } from "../src/atomic";

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

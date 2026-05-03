import { describe, it, expect, beforeEach, vi } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import { parseWriter, randomNonce, __atomicTestHooks, _internal_getLatestWriter, atomicUpdate, atomicMultiUpdate } from "../src/atomic";
import type { WriterStamp } from "../src/types";
import { ConflictError, AbortError, OverCapError } from "../src/types";
import { STORAGE_CAP_BYTES } from "../src/constants";

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

describe("atomicUpdate (happy path)", () => {
  beforeEach(() => {
    __testHooks.reset();
    __atomicTestHooks.reset();
    __atomicTestHooks.startTracker();
    __testHooks.setSelf("alice", "Alice", "#fff");
  });

  it("writes a fresh record when key is empty", async () => {
    const result = await atomicUpdate<{ name: string } & WriterStamp>(
      "com.abottchen.obr-inv/v1/alice",
      () => ({ w: "", name: "Alice" }),
      { description: "test" },
    );
    expect(result?.name).toBe("Alice");
    expect(result?.w).toMatch(/^alice:[0-9A-Za-z]{8}$/);
  });

  it("calls mutator with current value on subsequent writes", async () => {
    const key = "com.abottchen.obr-inv/v1/alice";
    await atomicUpdate(key, () => ({ w: "", count: 1 }), { description: "first" });
    const result = await atomicUpdate<{ count: number } & WriterStamp>(
      key,
      (current) => ({ ...current!, count: current!.count + 1 }),
      { description: "increment" },
    );
    expect(result?.count).toBe(2);
  });
});

describe("atomicUpdate (conflict + retry)", () => {
  beforeEach(() => {
    __testHooks.reset();
    __atomicTestHooks.reset();
    __atomicTestHooks.startTracker();
    __testHooks.setSelf("alice", "Alice", "#fff");
  });

  it("retries when echo carries a different writer and succeeds", async () => {
    const key = "com.abottchen.obr-inv/v1/alice";
    const sdk = (await import("@owlbear-rodeo/sdk")).default;
    const realSet = sdk.room.setMetadata;
    let firstCall = true;
    sdk.room.setMetadata = vi.fn(async (patch: Record<string, unknown>) => {
      await realSet(patch);
      // simulate concurrent overwrite by another writer on the first call only
      if (firstCall) {
        firstCall = false;
        await realSet({ [key]: { ...(patch[key] as object), w: "bob:nonce123" } });
      }
    }) as typeof sdk.room.setMetadata;

    const onConflict = vi.fn();
    const result = await atomicUpdate<{ count: number } & WriterStamp>(
      key,
      (current) => ({ w: "", count: (current?.count ?? 0) + 1 }),
      { description: "test", onConflict },
    );
    expect(result?.count).toBeGreaterThanOrEqual(1);
    expect(onConflict).toHaveBeenCalledTimes(1);
    expect(onConflict.mock.calls[0][0].blockerWriter).toBe("bob:nonce123");
  });

  it("throws ConflictError after MAX_ATTEMPTS conflicts", async () => {
    const key = "com.abottchen.obr-inv/v1/alice";
    const sdk = (await import("@owlbear-rodeo/sdk")).default;
    const realSet = sdk.room.setMetadata;
    sdk.room.setMetadata = vi.fn(async (patch: Record<string, unknown>) => {
      await realSet(patch);
      // every call gets stomped by bob
      await realSet({ [key]: { ...(patch[key] as object), w: "bob:nonce" } });
    }) as typeof sdk.room.setMetadata;

    await expect(
      atomicUpdate(key, () => ({ w: "", count: 1 }), { description: "test" }),
    ).rejects.toThrow(ConflictError);
  });
});

describe("atomicUpdate (cancel)", () => {
  beforeEach(() => {
    __testHooks.reset();
    __atomicTestHooks.reset();
    __atomicTestHooks.startTracker();
    __testHooks.setSelf("alice", "Alice", "#fff");
  });

  it("throws AbortError when signal is aborted before start", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      atomicUpdate("k1", () => ({ w: "", v: 1 }), { description: "x", signal: ac.signal }),
    ).rejects.toThrow(AbortError);
  });

  it("throws AbortError if signal aborts during backoff", async () => {
    const sdk = (await import("@owlbear-rodeo/sdk")).default;
    const realSet = sdk.room.setMetadata;
    sdk.room.setMetadata = vi.fn(async (patch: Record<string, unknown>) => {
      await realSet(patch);
      // always stomp so we go to backoff
      const k = Object.keys(patch)[0];
      await realSet({ [k]: { ...(patch[k] as object), w: "bob:nonce" } });
    }) as typeof sdk.room.setMetadata;

    const ac = new AbortController();
    setTimeout(() => ac.abort(), 10);
    await expect(
      atomicUpdate("k1", () => ({ w: "", v: 1 }), { description: "x", signal: ac.signal }),
    ).rejects.toThrow(AbortError);
  });
});

describe("atomicMultiUpdate", () => {
  beforeEach(() => {
    __testHooks.reset();
    __atomicTestHooks.reset();
    __atomicTestHooks.startTracker();
    __testHooks.setSelf("alice", "Alice", "#fff");
  });

  it("writes both keys in a single setMetadata call with the same writer", async () => {
    const sdk = (await import("@owlbear-rodeo/sdk")).default;
    const setSpy = vi.spyOn(sdk.room, "setMetadata");
    await atomicMultiUpdate([
      { key: "k1", mutate: () => ({ w: "", v: 1 }) },
      { key: "k2", mutate: () => ({ w: "", v: 2 }) },
    ], { description: "test" });
    // only one setMetadata call, with both keys
    expect(setSpy).toHaveBeenCalledTimes(1);
    const patch = setSpy.mock.calls[0][0] as Record<string, { w: string }>;
    expect(Object.keys(patch).sort()).toEqual(["k1", "k2"]);
    expect(patch.k1.w).toBe(patch.k2.w);     // same writer for both
    expect(patch.k1.w).toMatch(/^alice:[0-9A-Za-z]{8}$/);
  });

  it("retries if any key's echo doesn't match", async () => {
    const sdk = (await import("@owlbear-rodeo/sdk")).default;
    const realSet = sdk.room.setMetadata;
    let firstCall = true;
    sdk.room.setMetadata = vi.fn(async (patch: Record<string, unknown>) => {
      await realSet(patch);
      if (firstCall) {
        firstCall = false;
        // stomp only k2 — k1's echo will be ours, k2's will be different
        await realSet({ k2: { ...(patch.k2 as object), w: "bob:nonce" } });
      }
    }) as typeof sdk.room.setMetadata;

    const onConflict = vi.fn();
    await atomicMultiUpdate([
      { key: "k1", mutate: () => ({ w: "", v: 1 }) },
      { key: "k2", mutate: () => ({ w: "", v: 2 }) },
    ], { description: "test", onConflict });
    expect(onConflict).toHaveBeenCalledTimes(1);
  });
});

describe("atomicUpdate (cap check)", () => {
  beforeEach(() => {
    __testHooks.reset();
    __atomicTestHooks.reset();
    __atomicTestHooks.startTracker();
    __testHooks.setSelf("alice", "Alice", "#fff");
  });

  it("throws OverCapError when projected size exceeds the cap", async () => {
    const huge = "x".repeat(STORAGE_CAP_BYTES);
    await expect(
      atomicUpdate(
        "com.abottchen.obr-inv/v1/alice",
        () => ({ w: "", payload: huge }),
        { description: "test" },
      ),
    ).rejects.toThrow(OverCapError);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import { __atomicTestHooks } from "../src/atomic";
import {
  deleteRecord, ensureRecord, getCustoms, getRecord, listInventoryRecords,
  onRoomMetadataChange, recordKey, roomDataByteSize, writeCustoms, writeRecord,
} from "../src/metadata";
import { OverCapError } from "../src/types";
import { CUSTOMS_KEY, STORAGE_CAP_BYTES } from "../src/constants";

describe("metadata", () => {
  beforeEach(() => { __testHooks.reset(); __atomicTestHooks.reset(); });

  it("recordKey is namespaced", () => {
    expect(recordKey("p1")).toBe("com.abottchen.obr-inv/v1/p1");
  });

  it("roomDataByteSize counts owned (prefixed) keys verbatim", async () => {
    await writeRecord("p1",
      () => ({ w: "", name: "A", color: "#fff", items: [["a1", 2]], currency: { pp: 0, gp: 5, sp: 0, cp: 0 } }),
      { description: "seed p1" },
    );
    const md = await __testHooks.store;
    const owned: Record<string, unknown> = {};
    for (const [k, v] of md) {
      if (k.startsWith("com.abottchen.obr-inv/v1/")) owned[k] = v;
    }
    const expected = new TextEncoder().encode(JSON.stringify(owned)).byteLength;
    expect(await roomDataByteSize()).toBe(expected);
  });

  it("roomDataByteSize includes the customs key alongside inventories", async () => {
    await writeRecord("p1",
      () => ({ w: "", name: "A", color: "#fff", items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 } }),
      { description: "seed p1" },
    );
    const baseline = await roomDataByteSize();
    await writeCustoms(
      () => ({ w: "", items: [{ id: "qZx91A", name: "Flower", category: "Misc", icon: "",
        description: "A small bloom" }] }),
      { description: "test fixture" },
    );
    const after = await roomDataByteSize();
    expect(after).toBeGreaterThan(baseline);
  });

  it("listInventoryRecords filters to inventory keys only", async () => {
    await writeRecord("p1",
      () => ({ w: "", name: "A", color: "#fff", items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 } }),
      { description: "seed p1" },
    );
    __testHooks.store.set("other.extension/key", { junk: true });
    const recs = await listInventoryRecords();
    expect(Object.keys(recs)).toEqual(["p1"]);
  });

  it("listInventoryRecords skips null tombstones (OBR can persist nulls)", async () => {
    await writeRecord("p1",
      () => ({ w: "", name: "A", color: "#fff", items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 } }),
      { description: "seed p1" },
    );
    __testHooks.store.set("com.abottchen.obr-inv/v1/ghost", null);
    const recs = await listInventoryRecords();
    expect(Object.keys(recs)).toEqual(["p1"]);
  });

  it("onRoomMetadataChange skips null tombstones in delivered records", async () => {
    const seen: Array<Record<string, unknown>> = [];
    const unsub = onRoomMetadataChange((r) => seen.push(r));
    __testHooks.store.set("com.abottchen.obr-inv/v1/ghost", null);
    await writeRecord("p1",
      () => ({ w: "", name: "A", color: "#fff", items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 } }),
      { description: "seed p1" },
    );
    unsub();
    const last = seen[seen.length - 1];
    expect(Object.keys(last)).toEqual(["p1"]);
  });

  it("ensureRecord creates an empty record when absent", async () => {
    await ensureRecord("p1", "Alice", "#abc");
    const r = await getRecord("p1");
    expect(r?.name).toBe("Alice");
    expect(r?.items).toEqual([]);
  });

  it("ensureRecord updates name/color, leaves items/currency", async () => {
    await writeRecord("p1",
      () => ({ w: "", name: "Old", color: "#000", items: [["a1", 3]], currency: { pp: 1, gp: 2, sp: 3, cp: 4 } }),
      { description: "seed p1" },
    );
    await ensureRecord("p1", "New", "#fff");
    const r = await getRecord("p1");
    expect(r?.name).toBe("New");
    expect(r?.color).toBe("#fff");
    expect(r?.items).toEqual([["a1", 3]]);
    expect(r?.currency).toEqual({ pp: 1, gp: 2, sp: 3, cp: 4 });
  });

  it("writeRecord prunes zero-count entries before persisting", async () => {
    await writeRecord("p1",
      () => ({ w: "", name: "A", color: "#fff", items: [["a1", 0], ["b2", 2]], currency: { pp: 0, gp: 0, sp: 0, cp: 0 } }),
      { description: "test fixture" },
    );
    const r = await getRecord("p1");
    expect(r?.items).toEqual([["b2", 2]]);
  });

  it("writeRecord rejects when projected size > cap", async () => {
    const big = "x".repeat(STORAGE_CAP_BYTES + 100);
    await expect(writeRecord("p1",
      () => ({ w: "", name: big, color: "#fff", items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 } }),
      { description: "test fixture" },
    )).rejects.toThrow(OverCapError);
    expect(await getRecord("p1")).toBeNull();
  });

  it("deleteRecord removes the key", async () => {
    await writeRecord("p1",
      () => ({ w: "", name: "A", color: "#fff", items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 } }),
      { description: "seed p1" },
    );
    await deleteRecord("p1");
    expect(await getRecord("p1")).toBeNull();
  });

  it("serializes concurrent writes to the same key", async () => {
    const writes = Array.from({ length: 5 }, (_, i) =>
      writeRecord("p1",
        () => ({ w: "", name: `n${i}`, color: "#fff", items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 } }),
        { description: `write n${i}` },
      )
    );
    await Promise.all(writes);
    const r = await getRecord("p1");
    expect(r?.name).toBe("n4");
  });

  it("listInventoryRecords ignores the customs key", async () => {
    await writeCustoms(
      () => ({ w: "", items: [{ id: "qZx91A", name: "Flower", category: "Misc", icon: "",
        description: "A bloom" }] }),
      { description: "test fixture" },
    );
    const recs = await listInventoryRecords();
    expect(Object.keys(recs)).toEqual([]);
  });

  it("writeCustoms persists then getCustoms reads back", async () => {
    await writeCustoms(
      () => ({ w: "", items: [{ id: "qZx91A", name: "Flower", category: "Misc", icon: "",
        description: "A bloom" }] }),
      { description: "test fixture" },
    );
    const got = await getCustoms();
    expect(got).toHaveLength(1);
    expect(got[0].name).toBe("Flower");
  });

  it("getCustoms returns [] when the key isn't present", async () => {
    expect(await getCustoms()).toEqual([]);
  });

  it("writeCustoms is cap-guarded same as writeRecord", async () => {
    const huge = "x".repeat(STORAGE_CAP_BYTES + 100);
    await expect(writeCustoms(
      () => ({ w: "", items: [{ id: "qZx91A", name: huge, category: "Misc", icon: "",
        description: "d" }] }),
      { description: "test fixture" },
    )).rejects.toThrow(OverCapError);
    expect(__testHooks.store.has(CUSTOMS_KEY)).toBe(false);
  });

  it("writeCustoms factors existing inventories into the projected size", async () => {
    // Seed an inventory that consumes most of the cap; a small customs
    // write that fits on its own should still be rejected because the
    // cap is shared.
    const big = "x".repeat(STORAGE_CAP_BYTES - 200);
    __testHooks.store.set(
      "com.abottchen.obr-inv/v1/p1",
      { name: big, color: "#fff", items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 } },
    );
    await expect(writeCustoms(
      () => ({ w: "", items: [{ id: "qZx91A", name: "Padding".repeat(50), category: "Misc",
        icon: "", description: "x".repeat(500) }] }),
      { description: "test fixture" },
    )).rejects.toThrow(OverCapError);
  });

  it("writeRecord factors customs into the projected size", async () => {
    // Seed a near-full customs blob; a small inventory write that fits
    // on its own should still be rejected because customs counts too.
    const padding = "x".repeat(STORAGE_CAP_BYTES - 200);
    __testHooks.store.set(CUSTOMS_KEY, [
      { id: "qZx91A", name: padding, category: "Misc", icon: "", description: "" },
    ]);
    await expect(writeRecord("p1",
      () => ({ w: "", name: "A".repeat(500), color: "#fff", items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 } }),
      { description: "test fixture" },
    )).rejects.toThrow(OverCapError);
  });
});

describe("legacy shape tolerance", () => {
  beforeEach(() => { __testHooks.reset(); __atomicTestHooks.reset(); });

  it("reads pre-versioning records and synthesizes w: ''", async () => {
    __testHooks.store.set("com.abottchen.obr-inv/v1/legacy", {
      name: "Old", color: "#fff",
      items: [["a1", 1]],
      currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    });
    const r = await getRecord("legacy");
    expect(r?.name).toBe("Old");
    expect(r?.w).toBe("");
  });

  it("reads pre-envelope customs (bare array) and wraps it", async () => {
    __testHooks.store.set("com.abottchen.obr-inv/v1/customs", [
      { id: "x", name: "X", category: "Misc", icon: "🌸", description: "" },
    ]);
    const items = await getCustoms();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("x");
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import {
  inventoryByteSize, listInventoryRecords, getRecord, writeRecord,
  ensureRecord, deleteRecord, recordKey,
} from "../src/metadata";
import { OverCapError } from "../src/types";
import { STORAGE_CAP_BYTES } from "../src/constants";

describe("metadata", () => {
  beforeEach(() => __testHooks.reset());

  it("recordKey is namespaced", () => {
    expect(recordKey("p1")).toBe("com.abottchen.obr-inv/v1/p1");
  });

  it("inventoryByteSize matches TextEncoder length", async () => {
    await writeRecord("p1", {
      name: "A", color: "#fff",
      items: [["a1", 2]], currency: { pp: 0, gp: 5, sp: 0, cp: 0 },
    });
    const all = await listInventoryRecords();
    const expected = new TextEncoder().encode(JSON.stringify(all)).byteLength;
    expect(await inventoryByteSize()).toBe(expected);
  });

  it("listInventoryRecords filters to inventory keys only", async () => {
    await writeRecord("p1", {
      name: "A", color: "#fff",
      items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    });
    __testHooks.store.set("other.extension/key", { junk: true });
    const recs = await listInventoryRecords();
    expect(Object.keys(recs)).toEqual(["p1"]);
  });

  it("ensureRecord creates an empty record when absent", async () => {
    await ensureRecord("p1", "Alice", "#abc");
    const r = await getRecord("p1");
    expect(r?.name).toBe("Alice");
    expect(r?.items).toEqual([]);
  });

  it("ensureRecord updates name/color, leaves items/currency", async () => {
    await writeRecord("p1", {
      name: "Old", color: "#000",
      items: [["a1", 3]], currency: { pp: 1, gp: 2, sp: 3, cp: 4 },
    });
    await ensureRecord("p1", "New", "#fff");
    const r = await getRecord("p1");
    expect(r).toEqual({
      name: "New", color: "#fff",
      items: [["a1", 3]], currency: { pp: 1, gp: 2, sp: 3, cp: 4 },
    });
  });

  it("writeRecord prunes zero-count entries before persisting", async () => {
    await writeRecord("p1", {
      name: "A", color: "#fff",
      items: [["a1", 0], ["b2", 2]],
      currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    });
    const r = await getRecord("p1");
    expect(r?.items).toEqual([["b2", 2]]);
  });

  it("writeRecord rejects when projected size > cap", async () => {
    const big = "x".repeat(STORAGE_CAP_BYTES + 100);
    await expect(writeRecord("p1", {
      name: big, color: "#fff",
      items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    })).rejects.toThrow(OverCapError);
    expect(await getRecord("p1")).toBeNull();
  });

  it("deleteRecord removes the key", async () => {
    await writeRecord("p1", {
      name: "A", color: "#fff",
      items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    });
    await deleteRecord("p1");
    expect(await getRecord("p1")).toBeNull();
  });

  it("serializes concurrent writes to the same key", async () => {
    const writes = Array.from({ length: 5 }, (_, i) =>
      writeRecord("p1", {
        name: `n${i}`, color: "#fff",
        items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
      })
    );
    await Promise.all(writes);
    const r = await getRecord("p1");
    expect(r?.name).toBe("n4");
  });
});

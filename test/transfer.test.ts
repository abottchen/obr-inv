import { describe, it, expect, beforeEach, vi } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import * as metadata from "../src/metadata";
import { writeRecord, getRecord } from "../src/metadata";
import { transferItem } from "../src/transfer";
import { BROADCAST_CHANNEL, STORAGE_CAP_BYTES } from "../src/constants";

const seedRecord = async (
  pid: string, name: string, items: [string, number][] = [],
) => {
  await writeRecord(pid, {
    name, color: "#fff", items,
    currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
  });
};

describe("transferItem", () => {
  beforeEach(() => __testHooks.reset());

  it("moves qty from sender to recipient and emits a transfer-received broadcast", async () => {
    await seedRecord("alice", "Alice", [["a1", 5]]);
    await seedRecord("bob", "Bob");
    __testHooks.setParty([
      { id: "alice", name: "Alice", color: "#fff", role: "PLAYER" },
      { id: "bob", name: "Bob", color: "#fff", role: "PLAYER" },
    ]);

    await transferItem({
      fromPlayerId: "alice", toPlayerId: "bob",
      itemId: "a1", itemName: "Sword", qty: 3,
    });

    expect((await getRecord("alice"))?.items).toEqual([["a1", 2]]);
    expect((await getRecord("bob"))?.items).toEqual([["a1", 3]]);
    const transferMsg = __testHooks.broadcasts.find(
      (b) => b.channel === BROADCAST_CHANNEL
        && (b.data as any).type === "transfer-received",
    );
    expect(transferMsg).toBeTruthy();
    const data = transferMsg?.data as any;
    expect(data.fromPlayerId).toBe("alice");
    expect(data.fromName).toBe("Alice");
    expect(data.toPlayerId).toBe("bob");
    expect(data.toName).toBe("Bob");
    expect(data.itemId).toBe("a1");
    expect(data.itemName).toBe("Sword");
    expect(data.quantity).toBe(3);
    expect(transferMsg?.destination).toBe("ALL");
  });

  it("rejects and emits over-cap broadcast when recipient would overflow", async () => {
    const big = "x".repeat(STORAGE_CAP_BYTES - 200);
    __testHooks.store.set(
      "com.abottchen.obr-inv/v1/bob",
      { name: big, color: "#fff", items: [], currency: { pp:0, gp:0, sp:0, cp:0 } },
    );
    // Bypass cap guard for alice's setup since bob is already near-full.
    __testHooks.store.set(
      "com.abottchen.obr-inv/v1/alice",
      { name: "Alice", color: "#fff", items: [["a1", 5]], currency: { pp:0, gp:0, sp:0, cp:0 } },
    );
    __testHooks.setParty([
      { id: "gm", name: "GM", color: "#fff", role: "GM" },
      { id: "alice", name: "Alice", color: "#fff", role: "PLAYER" },
      { id: "bob", name: "Bob", color: "#fff", role: "PLAYER" },
    ]);

    await expect(transferItem({
      fromPlayerId: "alice", toPlayerId: "bob",
      itemId: "a1", itemName: "Sword", qty: 3,
    })).rejects.toThrow();

    expect((await getRecord("alice"))?.items).toEqual([["a1", 5]]);
    const overCapMsg = __testHooks.broadcasts.find(
      (b) => (b.data as any).type === "over-cap",
    );
    expect(overCapMsg).toBeTruthy();
    expect(overCapMsg?.destination).toBe("ALL");
    expect((overCapMsg?.data as any).triggeringPlayerName).toBe("Alice");
  });

  it("rejects when recipient has no inventory record", async () => {
    await seedRecord("alice", "Alice", [["a1", 1]]);
    await expect(transferItem({
      fromPlayerId: "alice", toPlayerId: "ghost",
      itemId: "a1", itemName: "X", qty: 1,
    })).rejects.toThrow(/no inventory record/i);
  });

  it("reverts recipient credit when the sender write fails after recipient succeeded", async () => {
    await seedRecord("alice", "Alice", [["a1", 5]]);
    await seedRecord("bob", "Bob");
    __testHooks.setParty([
      { id: "alice", name: "Alice", color: "#fff", role: "PLAYER" },
      { id: "bob", name: "Bob", color: "#fff", role: "PLAYER" },
    ]);

    // Force the second writeRecord call (sender debit) to throw, while
    // letting the recipient credit and the rollback write succeed.
    const real = metadata.writeRecord;
    let calls = 0;
    const spy = vi.spyOn(metadata, "writeRecord").mockImplementation(
      async (pid, rec) => {
        calls++;
        if (calls === 2) throw new Error("simulated sender-write failure");
        return real(pid, rec);
      },
    );
    // Suppress the rollback-failure console.error path; we expect rollback
    // to succeed so it shouldn't fire, but we want a clean test output.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(transferItem({
        fromPlayerId: "alice", toPlayerId: "bob",
        itemId: "a1", itemName: "Sword", qty: 3,
      })).rejects.toThrow(/simulated sender-write failure/);

      // alice never had her debit persisted (write 2 threw before commit)
      expect((await getRecord("alice"))?.items).toEqual([["a1", 5]]);
      // bob was credited (write 1) then rolled back (write 3): back to empty
      expect((await getRecord("bob"))?.items).toEqual([]);
      // No transfer-received broadcast — the transfer ultimately failed
      const tx = __testHooks.broadcasts.find(
        (b) => (b.data as any).type === "transfer-received",
      );
      expect(tx).toBeUndefined();
    } finally {
      spy.mockRestore();
      errSpy.mockRestore();
    }
  });
});

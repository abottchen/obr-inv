import { describe, it, expect, beforeEach } from "vitest";
import { OBR, __testHooks } from "./_mocks/obr-sdk";

describe("sdk mock sanity", () => {
  beforeEach(() => __testHooks.reset());

  it("stores and retrieves metadata", async () => {
    await OBR.room.setMetadata({ "test/key": { hello: "world" } });
    const md = await OBR.room.getMetadata();
    expect(md["test/key"]).toEqual({ hello: "world" });
  });

  it("notifies metadata listeners on write", async () => {
    let received: Record<string, unknown> | null = null;
    OBR.room.onMetadataChange((m) => { received = m; });
    await OBR.room.setMetadata({ "k": 1 });
    expect(received).not.toBeNull();
    expect((received as any)["k"]).toBe(1);
  });
});

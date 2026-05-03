# Atomic Inventory Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the silent-overwrite bug in concurrent inventory writes by routing all mutations through an optimistic concurrency control layer that stamps each write with a `<playerId>:<nonce>` "writer" field, verifies the write landed by watching the metadata-change echo, and retries with bounded budget on conflict. Add a UI overlay with cancel + blocker reporting.

**Architecture:** A new `src/atomic.ts` module owns writer-stamping, a global FIFO queue, retry, echo verification, and storage-cap projection. `src/metadata.ts` becomes a thin wrapper over it (writers take `Mutator<T>` instead of finished records). `src/transfer.ts` uses `atomicMultiUpdate` to commit sender + recipient in one server-side write. A new `src/ui-overlay.ts` provides a singleton spinner + cancel button used by every mutating UI call site.

**Tech Stack:** TypeScript, Vitest (jsdom), OBR SDK (mocked in tests via `test/_mocks/obr-sdk.ts`).

**Spec:** [`2026-05-02-atomic-inventory-updates-design.md`](../specs/2026-05-02-atomic-inventory-updates-design.md)

---

## File Structure

**Create:**
- `src/atomic.ts` — OCC engine (writer stamping, queue, echo tracker, retry, cap check)
- `src/ui-overlay.ts` — pending-operation overlay singleton
- `src/styles-overlay.ts` — overlay CSS
- `test/atomic.test.ts` — unit tests for atomic engine
- `test/ui-overlay.test.ts` — unit tests for overlay DOM

**Modify:**
- `src/types.ts` — add `WriterStamp`, extend `PlayerInventoryRecord`, add `CustomItemsEnvelope`, add `ConflictError`/`AbortError`
- `src/metadata.ts` — refactor writers to mutator-based API; legacy-shape tolerance on reads
- `src/inventory.ts` — split `applyTransfer` into `applyTransferOut`/`applyTransferIn`
- `src/transfer.ts` — replace internals with `atomicMultiUpdate`
- `src/ui-player.ts`, `src/ui-gm.ts`, `src/ui-add-dialog.ts`, `src/ui-customs-dialog.ts`, `src/ui-customs-panel.ts` — wire mutations through overlay
- `src/main.ts` — inject overlay styles, mount overlay container
- `test/transfer.test.ts`, `test/metadata.test.ts`, `test/customs.test.ts` — update for new API
- `test/_mocks/obr-sdk.ts` — add `crypto.randomUUID` polyfill if jsdom lacks it; ensure `OBR.player.id` is settable

---

## Phase 1 — Foundation: types and pure helpers

### Task 1: Add writer types and error classes to types.ts

**Files:**
- Modify: `src/types.ts:29-34` (extend `PlayerInventoryRecord`); append new exports at end of file

- [ ] **Step 1: Read the current file**

Run: `cat src/types.ts`

- [ ] **Step 2: Add `WriterStamp` and extend records**

Edit `src/types.ts`. Replace the `PlayerInventoryRecord` interface and add new types after the existing types:

```ts
export interface WriterStamp {
  /**
   * "<playerId>:<nonce>" stamped by the atomic helper on every write.
   * Empty string for legacy records (synthesized on read).
   */
  w: string;
}

export interface PlayerInventoryRecord extends WriterStamp {
  name: string;
  color: string;
  items: InventoryEntry[];
  currency: Currency;
}

export interface CustomItemsEnvelope extends WriterStamp {
  items: CustomItem[];
}
```

- [ ] **Step 3: Add `ConflictError` and `AbortError` after `OverCapError`**

Append to `src/types.ts`:

```ts
export class ConflictError extends Error {
  constructor(
    public readonly attempts: number,
    public readonly lastBlockerWriter: string | null,
  ) {
    super(`Could not commit after ${attempts} attempts`);
    this.name = "ConflictError";
  }
}

export class AbortError extends Error {
  constructor(message = "Operation cancelled") {
    super(message);
    this.name = "AbortError";
  }
}
```

- [ ] **Step 4: Run typecheck to verify**

Run: `npx tsc --noEmit`
Expected: existing `src/inventory.ts` will report errors because `emptyRecord`/etc. don't include `w`. **Stop here — those will be fixed in later tasks.** Verify only the *types* compile and the errors are the expected propagated ones from missing `w` fields, not syntax errors.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add WriterStamp envelope and conflict/abort errors"
```

### Task 2: Add `parseWriter` pure helper

**Files:**
- Create: `src/atomic.ts`
- Test: `test/atomic.test.ts`

- [ ] **Step 1: Write failing test**

Create `test/atomic.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseWriter } from "../src/atomic";

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
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- atomic`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `parseWriter`**

Create `src/atomic.ts`:

```ts
export function parseWriter(w: string): { playerId: string | null; nonce: string } {
  const colon = w.indexOf(":");
  if (colon < 0) return { playerId: null, nonce: w };
  return { playerId: w.slice(0, colon), nonce: w.slice(colon + 1) };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- atomic`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/atomic.ts test/atomic.test.ts
git commit -m "feat(atomic): add parseWriter helper"
```

### Task 3: Add `randomNonce` helper

**Files:**
- Modify: `src/atomic.ts`, `test/atomic.test.ts`

- [ ] **Step 1: Write failing test**

Append to `test/atomic.test.ts`:

```ts
import { randomNonce } from "../src/atomic";

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
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- atomic`
Expected: FAIL on import (`randomNonce` not exported).

- [ ] **Step 3: Implement `randomNonce`**

Append to `src/atomic.ts`:

```ts
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function randomNonce(): string {
  // 8 chars × 62 = ~218 trillion possibilities — collision-free for any
  // realistic concurrent-in-flight write count within a session.
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[buf[i] % 62];
  return out;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- atomic`
Expected: all atomic tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/atomic.ts test/atomic.test.ts
git commit -m "feat(atomic): add randomNonce helper"
```

---

## Phase 2 — Atomic core: echo tracker and single-key happy path

### Task 4: Echo tracker — record latest writer per key

**Files:**
- Modify: `src/atomic.ts`, `test/atomic.test.ts`

- [ ] **Step 1: Write failing test**

Append to `test/atomic.test.ts`:

```ts
import { __atomicTestHooks, _internal_getLatestWriter } from "../src/atomic";
import { __testHooks } from "./_mocks/obr-sdk";

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
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- atomic`
Expected: FAIL on imports (`__atomicTestHooks`, `_internal_getLatestWriter` not exported).

- [ ] **Step 3: Implement echo tracker**

Append to `src/atomic.ts`:

```ts
import OBR from "@owlbear-rodeo/sdk";
import { CUSTOMS_KEY, METADATA_KEY_PREFIX } from "./constants";
import type { WriterStamp } from "./types";

const latestWriters = new Map<string, string>();
const waiters = new Set<() => boolean>();
let unsubscribe: (() => void) | null = null;

function ingest(md: Record<string, unknown>): void {
  // OBR fires onMetadataChange on every room metadata change, including
  // OBR's own keys and other extensions'. Filter to keys we own so the
  // tracker doesn't accumulate writer values for keys we never wait on.
  for (const [k, v] of Object.entries(md)) {
    if (k !== CUSTOMS_KEY && !k.startsWith(METADATA_KEY_PREFIX)) continue;
    latestWriters.set(k, (v as WriterStamp | null)?.w ?? "");
  }
  for (const w of [...waiters]) {
    if (w()) waiters.delete(w);
  }
}

export function startEchoTracker(): void {
  if (unsubscribe) return;
  unsubscribe = OBR.room.onMetadataChange(ingest);
}

export function stopEchoTracker(): void {
  unsubscribe?.();
  unsubscribe = null;
  latestWriters.clear();
  waiters.clear();
}

export const __atomicTestHooks = {
  reset(): void { stopEchoTracker(); },
  startTracker(): void { startEchoTracker(); },
};

export function _internal_getLatestWriter(key: string): string | undefined {
  return latestWriters.get(key);
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- atomic`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/atomic.ts test/atomic.test.ts
git commit -m "feat(atomic): echo tracker subscribes to onMetadataChange"
```

### Task 5: `atomicUpdate` happy path (no retry, no queue, no cap check)

**Files:**
- Modify: `src/atomic.ts`, `test/atomic.test.ts`

- [ ] **Step 1: Write failing test**

Append to `test/atomic.test.ts`:

```ts
import { atomicUpdate } from "../src/atomic";

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
```

You will also need to add `import type { WriterStamp } from "../src/types";` at the top of the test file.

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- atomic`
Expected: FAIL — `atomicUpdate` not exported.

- [ ] **Step 3: Implement minimal `atomicUpdate`**

Append to `src/atomic.ts`:

```ts
export interface AtomicUpdateOptions {
  signal?: AbortSignal;
  description: string;
  onConflict?: (info: { blockerWriter: string; attempt: number }) => void;
}

export type Mutator<T> = (current: T | null) => T | null;

export const ECHO_TIMEOUT_MS = 1000;

function makeWriter(): string {
  return `${OBR.player.id}:${randomNonce()}`;
}

async function waitForEcho(
  keys: string[],
  ourWriter: string,
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Promise<{ ok: true } | { ok: false; blockerWriter: string | null }> {
  const allMatch = () => keys.every((k) => latestWriters.get(k) === ourWriter);
  if (allMatch()) return { ok: true };

  return new Promise((resolve) => {
    let settled = false;
    const predicate = () => {
      if (allMatch()) {
        if (!settled) { settled = true; resolve({ ok: true }); }
        return true;
      }
      return false;
    };
    waiters.add(predicate);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      waiters.delete(predicate);
      const blocker = keys.map((k) => latestWriters.get(k) ?? "")
        .find((w) => w !== ourWriter) ?? null;
      resolve({ ok: false, blockerWriter: blocker });
    }, timeoutMs);
    if (signal) {
      const onAbort = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        waiters.delete(predicate);
        resolve({ ok: false, blockerWriter: null });
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

export async function atomicUpdate<T extends WriterStamp>(
  key: string,
  mutate: Mutator<T>,
  opts: AtomicUpdateOptions,
): Promise<T | null> {
  startEchoTracker();
  const md = await OBR.room.getMetadata();
  const current = (md[key] as T | undefined) ?? null;
  const next = mutate(current);
  const ourWriter = makeWriter();

  if (next === null) {
    await OBR.room.setMetadata({ [key]: undefined });
    return null;
  }

  const stamped = { ...next, w: ourWriter };
  await OBR.room.setMetadata({ [key]: stamped });
  await waitForEcho([key], ourWriter, ECHO_TIMEOUT_MS, opts.signal);
  return stamped;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- atomic`
Expected: all tests pass. Note: this version does NOT retry on conflict — that's added in the next task.

- [ ] **Step 5: Commit**

```bash
git add src/atomic.ts test/atomic.test.ts
git commit -m "feat(atomic): atomicUpdate happy path"
```

### Task 6: Conflict detection and retry

**Files:**
- Modify: `src/atomic.ts`, `test/atomic.test.ts`

- [ ] **Step 1: Write failing test for retry**

Append to `test/atomic.test.ts`:

```ts
import { ConflictError } from "../src/types";

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
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- atomic`
Expected: FAIL — current `atomicUpdate` doesn't retry.

- [ ] **Step 3: Add retry loop and `MAX_ATTEMPTS` / `BACKOFF_MS`**

Edit `src/atomic.ts`. Replace the body of `atomicUpdate` and add constants:

```ts
export const MAX_ATTEMPTS = 3;
export const BACKOFF_MS = [50, 200];

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => { clearTimeout(t); reject(new AbortError()); };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

export async function atomicUpdate<T extends WriterStamp>(
  key: string,
  mutate: Mutator<T>,
  opts: AtomicUpdateOptions,
): Promise<T | null> {
  startEchoTracker();
  let lastBlocker: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (opts.signal?.aborted) throw new AbortError();
    const md = await OBR.room.getMetadata();
    const current = (md[key] as T | undefined) ?? null;
    const next = mutate(current);
    const ourWriter = makeWriter();

    if (next === null) {
      await OBR.room.setMetadata({ [key]: undefined });
      return null;
    }

    const stamped = { ...next, w: ourWriter };
    if (opts.signal?.aborted) throw new AbortError();
    await OBR.room.setMetadata({ [key]: stamped });
    const echo = await waitForEcho([key], ourWriter, ECHO_TIMEOUT_MS, opts.signal);
    if (echo.ok) return stamped;

    lastBlocker = echo.blockerWriter;
    opts.onConflict?.({ blockerWriter: echo.blockerWriter ?? "", attempt });
    if (attempt < MAX_ATTEMPTS) {
      await sleep(BACKOFF_MS[attempt - 1], opts.signal);
    }
  }

  throw new ConflictError(MAX_ATTEMPTS, lastBlocker);
}
```

Add `import { AbortError, ConflictError } from "./types";` to the imports.

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- atomic`
Expected: all atomic tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/atomic.ts test/atomic.test.ts
git commit -m "feat(atomic): retry with onConflict callback and ConflictError"
```

### Task 7: AbortSignal handling (cancellation at all checkpoints)

**Files:**
- Modify: `src/atomic.ts`, `test/atomic.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `test/atomic.test.ts`:

```ts
import { AbortError } from "../src/types";

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
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- atomic`
Expected: most pass already (the early abort works), but `signal aborts during backoff` may need confirmation — verify the AbortError is thrown.

- [ ] **Step 3: Verify abort coverage**

Read `src/atomic.ts` — confirm `signal?.aborted` checks at start of attempt and before setMetadata, and that `sleep()` rejects with AbortError on abort. If any check is missing, add it.

- [ ] **Step 4: Run tests**

Run: `npm test -- atomic`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/atomic.ts test/atomic.test.ts
git commit -m "test(atomic): cover AbortSignal at every await checkpoint"
```

### Task 8: `atomicMultiUpdate` for multi-key atomic writes

**Files:**
- Modify: `src/atomic.ts`, `test/atomic.test.ts`

- [ ] **Step 1: Write failing test**

Append to `test/atomic.test.ts`:

```ts
import { atomicMultiUpdate } from "../src/atomic";

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
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- atomic`
Expected: FAIL — `atomicMultiUpdate` not exported.

- [ ] **Step 3: Implement `atomicMultiUpdate`**

Refactor `src/atomic.ts` so `atomicUpdate` delegates to a multi-key path. Replace the old `atomicUpdate` body and add `atomicMultiUpdate`:

```ts
export async function atomicMultiUpdate(
  updates: Array<{ key: string; mutate: Mutator<WriterStamp> }>,
  opts: AtomicUpdateOptions,
): Promise<void> {
  startEchoTracker();
  let lastBlocker: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (opts.signal?.aborted) throw new AbortError();
    const md = await OBR.room.getMetadata();
    const ourWriter = makeWriter();
    const patch: Record<string, unknown> = {};
    const stampedKeys: string[] = [];
    for (const { key, mutate } of updates) {
      const current = (md[key] as WriterStamp | undefined) ?? null;
      const next = mutate(current);
      patch[key] = next === null ? undefined : { ...next, w: ourWriter };
      if (next !== null) stampedKeys.push(key);
    }
    if (opts.signal?.aborted) throw new AbortError();
    await OBR.room.setMetadata(patch);
    if (stampedKeys.length === 0) return;
    const echo = await waitForEcho(stampedKeys, ourWriter, ECHO_TIMEOUT_MS, opts.signal);
    if (echo.ok) return;

    lastBlocker = echo.blockerWriter;
    opts.onConflict?.({ blockerWriter: echo.blockerWriter ?? "", attempt });
    if (attempt < MAX_ATTEMPTS) await sleep(BACKOFF_MS[attempt - 1], opts.signal);
  }

  throw new ConflictError(MAX_ATTEMPTS, lastBlocker);
}

export async function atomicUpdate<T extends WriterStamp>(
  key: string,
  mutate: Mutator<T>,
  opts: AtomicUpdateOptions,
): Promise<T | null> {
  let result: T | null = null;
  await atomicMultiUpdate([
    {
      key,
      mutate: (current) => {
        const next = mutate(current as T | null);
        result = next as T | null;
        return next;
      },
    },
  ], opts);
  return result;
}
```

- [ ] **Step 4: Run all atomic tests**

Run: `npm test -- atomic`
Expected: all pass (the original single-key tests + new multi-key tests).

- [ ] **Step 5: Commit**

```bash
git add src/atomic.ts test/atomic.test.ts
git commit -m "feat(atomic): multi-key atomic update via single setMetadata"
```

### Task 9: Storage cap projection

**Files:**
- Modify: `src/atomic.ts`, `test/atomic.test.ts`

- [ ] **Step 1: Write failing test**

Append to `test/atomic.test.ts`:

```ts
import { OverCapError } from "../src/types";
import { STORAGE_CAP_BYTES } from "../src/constants";

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
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- atomic`
Expected: FAIL — write succeeds because no cap check yet.

- [ ] **Step 3: Add cap projection inside `atomicMultiUpdate`**

In `src/atomic.ts`, after computing the `patch` and before `setMetadata`, add the projection. Add imports `import { CUSTOMS_KEY, METADATA_KEY_PREFIX, STORAGE_CAP_BYTES } from "./constants";` and `import { OverCapError } from "./types";`. Insert this block after building `patch` and before the `if (opts.signal?.aborted)` check:

```ts
// Cap check: project all owned metadata with our pending writes applied,
// throw OverCapError if projection exceeds the cap.
const owned: Record<string, unknown> = {};
for (const [k, v] of Object.entries(md)) {
  if (k === CUSTOMS_KEY || k.startsWith(METADATA_KEY_PREFIX)) owned[k] = v;
}
for (const [k, v] of Object.entries(patch)) {
  if (k === CUSTOMS_KEY || k.startsWith(METADATA_KEY_PREFIX)) {
    if (v === undefined) delete owned[k];
    else owned[k] = v;
  }
}
const projectedBytes = new TextEncoder()
  .encode(JSON.stringify(owned)).byteLength;
if (projectedBytes > STORAGE_CAP_BYTES) {
  const currentBytes = new TextEncoder()
    .encode(JSON.stringify(
      Object.fromEntries(
        Object.entries(md).filter(([k]) =>
          k === CUSTOMS_KEY || k.startsWith(METADATA_KEY_PREFIX),
        ),
      ),
    )).byteLength;
  throw new OverCapError(currentBytes, STORAGE_CAP_BYTES, opts.description);
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- atomic`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/atomic.ts test/atomic.test.ts
git commit -m "feat(atomic): storage cap projection inside atomic helper"
```

### Task 10: Global FIFO queue

**Files:**
- Modify: `src/atomic.ts`, `test/atomic.test.ts`

- [ ] **Step 1: Write failing test**

Append to `test/atomic.test.ts`:

```ts
describe("atomicUpdate (global queue)", () => {
  beforeEach(() => {
    __testHooks.reset();
    __atomicTestHooks.reset();
    __atomicTestHooks.startTracker();
    __testHooks.setSelf("alice", "Alice", "#fff");
  });

  it("serializes concurrent calls — second sees first's write", async () => {
    const key = "com.abottchen.obr-inv/v1/alice";
    const observed: Array<number | null> = [];
    const p1 = atomicUpdate<{ count: number } & WriterStamp>(
      key,
      (current) => {
        observed.push(current?.count ?? null);
        return { w: "", count: 1 };
      },
      { description: "first" },
    );
    const p2 = atomicUpdate<{ count: number } & WriterStamp>(
      key,
      (current) => {
        observed.push(current?.count ?? null);
        return { w: "", count: (current?.count ?? 0) + 1 };
      },
      { description: "second" },
    );
    await Promise.all([p1, p2]);
    expect(observed).toEqual([null, 1]);  // second saw first's count
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- atomic`
Expected: FAIL — without queueing, both calls read the empty initial state.

- [ ] **Step 3: Add the global queue**

At the top of `src/atomic.ts` (module scope, near other module-level state), add:

```ts
let queueTail: Promise<void> = Promise.resolve();

function enqueue<T>(op: () => Promise<T>): Promise<T> {
  const result = queueTail.then(op, op);
  queueTail = result.then(() => {}, () => {});
  return result;
}
```

Wrap `atomicMultiUpdate`'s body in `enqueue`. Refactor:

```ts
export async function atomicMultiUpdate(
  updates: Array<{ key: string; mutate: Mutator<WriterStamp> }>,
  opts: AtomicUpdateOptions,
): Promise<void> {
  return enqueue(async () => {
    startEchoTracker();
    // ... (existing body)
  });
}
```

Also ensure the queue respects abort *before entering* the critical section: at the start of the enqueued op, check `opts.signal?.aborted`.

- [ ] **Step 4: Run all atomic tests**

Run: `npm test -- atomic`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/atomic.ts test/atomic.test.ts
git commit -m "feat(atomic): global FIFO queue serializes mutations"
```

---

## Phase 3 — Refactor metadata.ts

### Task 11: Update reads to tolerate legacy shapes

**Files:**
- Modify: `src/metadata.ts:34-38, 94-99`
- Modify: `test/metadata.test.ts` (add legacy-read coverage)

- [ ] **Step 1: Write failing test**

Append to `test/metadata.test.ts`:

```ts
describe("legacy shape tolerance", () => {
  beforeEach(() => __testHooks.reset());

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
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- metadata`
Expected: FAIL — `r.w` is undefined; `getCustoms` may return wrong shape (will depend on current implementation).

- [ ] **Step 3: Update `getRecord` to synthesize `w`**

Edit `src/metadata.ts`. Replace `getRecord`:

```ts
export async function getRecord(playerId: string): Promise<PlayerInventoryRecord | null> {
  const md = await OBR.room.getMetadata();
  const v = md[recordKey(playerId)];
  if (v == null) return null;
  const rec = v as PlayerInventoryRecord;
  return rec.w === undefined ? { ...rec, w: "" } : rec;
}
```

Update `listInventoryRecords` similarly to ensure all returned records have `w`:

```ts
export async function listInventoryRecords(): Promise<Record<string, PlayerInventoryRecord>> {
  const md = await OBR.room.getMetadata();
  const out: Record<string, PlayerInventoryRecord> = {};
  for (const [k, v] of Object.entries(md)) {
    if (!isRecordKey(k) || v == null) continue;
    const rec = v as PlayerInventoryRecord;
    out[playerIdFromKey(k)] = rec.w === undefined ? { ...rec, w: "" } : rec;
  }
  return out;
}
```

Update `getCustoms` to handle both bare-array and envelope shapes:

```ts
export async function getCustoms(): Promise<CustomItemsRecord> {
  const md = await OBR.room.getMetadata();
  const v = md[CUSTOMS_KEY];
  if (Array.isArray(v)) return v as CustomItemsRecord;
  if (v && typeof v === "object" && Array.isArray((v as { items?: unknown }).items)) {
    return ((v as CustomItemsEnvelope).items) as CustomItemsRecord;
  }
  return [];
}
```

Add `import type { CustomItemsEnvelope } from "./types";` to imports.

- [ ] **Step 4: Run tests**

Run: `npm test -- metadata`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/metadata.ts test/metadata.test.ts
git commit -m "feat(metadata): tolerate legacy shape on reads"
```

### Task 12: Refactor `writeRecord` to mutator API via `atomicUpdate`

**Files:**
- Modify: `src/metadata.ts:63-86`, `test/metadata.test.ts`, `test/transfer.test.ts`

- [ ] **Step 1: Update tests to new API**

The old `writeRecord(playerId, record)` becomes `writeRecord(playerId, mutate, opts)`. Update each call site in tests. Search and modify:

In `test/metadata.test.ts` and `test/transfer.test.ts`, replace direct-record writes:

```ts
// OLD
await writeRecord("p1", { name: "A", color: "#fff", items: [], currency: {pp:0,gp:0,sp:0,cp:0} });

// NEW
await writeRecord("p1",
  () => ({ w: "", name: "A", color: "#fff", items: [], currency: {pp:0,gp:0,sp:0,cp:0} }),
  { description: "seed p1" },
);
```

Use grep to find every call: `grep -n "writeRecord(" test/`.

- [ ] **Step 2: Run tests to confirm they fail (signature change)**

Run: `npm test`
Expected: many FAILs from type errors (writeRecord signature changed).

- [ ] **Step 3: Refactor `writeRecord`**

Edit `src/metadata.ts`. Replace `writeRecord` and remove the `enqueue`/`queues` per-key queue (no longer needed):

```ts
import { atomicUpdate, type AtomicUpdateOptions, type Mutator } from "./atomic";

export function writeRecord(
  playerId: string,
  mutate: Mutator<PlayerInventoryRecord>,
  opts: AtomicUpdateOptions,
): Promise<PlayerInventoryRecord | null> {
  return atomicUpdate(recordKey(playerId), mutate, opts);
}
```

Delete the `queues` map and `enqueue` function — they're replaced by the global queue in `atomic.ts`.

- [ ] **Step 4: Run tests**

Run: `npm test -- metadata transfer`
Expected: tests that were updated pass; tests still using old API need updating.

Update remaining test files until all pass.

- [ ] **Step 5: Commit**

```bash
git add src/metadata.ts test/metadata.test.ts test/transfer.test.ts
git commit -m "refactor(metadata): writeRecord takes mutator, delegates to atomicUpdate"
```

### Task 13: Refactor `ensureRecord`, `deleteRecord`, `writeCustoms`

**Files:**
- Modify: `src/metadata.ts:88-92, 101-121, 132-150`
- Modify: tests as needed

- [ ] **Step 1: Refactor `ensureRecord`**

Replace `ensureRecord`:

```ts
export async function ensureRecord(
  playerId: string, name: string, color: string,
): Promise<PlayerInventoryRecord> {
  const result = await atomicUpdate<PlayerInventoryRecord>(
    recordKey(playerId),
    (current) => {
      if (!current) {
        return {
          w: "",
          name, color, items: [],
          currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
        };
      }
      if (current.name !== name || current.color !== color) {
        return { ...current, name, color };
      }
      return current;
    },
    { description: `ensure ${playerId} record` },
  );
  return result!;
}
```

- [ ] **Step 2: Refactor `deleteRecord`**

```ts
export function deleteRecord(playerId: string): Promise<PlayerInventoryRecord | null> {
  return atomicUpdate<PlayerInventoryRecord>(
    recordKey(playerId),
    () => null,
    { description: `delete ${playerId} record` },
  );
}
```

- [ ] **Step 3: Refactor `writeCustoms`**

```ts
export function writeCustoms(
  mutate: Mutator<CustomItemsEnvelope>,
  opts: AtomicUpdateOptions,
): Promise<CustomItemsEnvelope | null> {
  return atomicUpdate(CUSTOMS_KEY, mutate, opts);
}
```

Update existing call sites in `src/customs.ts` (or wherever it's called). Search: `grep -rn "writeCustoms(" src test`.

- [ ] **Step 4: Update tests**

Update `test/customs.test.ts` and any others affected. Use grep to find call sites.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -p   # review staged hunks
git commit -m "refactor(metadata): ensureRecord/deleteRecord/writeCustoms take mutators"
```

---

## Phase 4 — Refactor inventory.ts and transfer.ts

### Task 14: Split `applyTransfer` into out/in halves

**Files:**
- Modify: `src/inventory.ts:61-79`
- Test: `test/inventory.test.ts`

- [ ] **Step 1: Write failing test**

Append to `test/inventory.test.ts`:

```ts
import { applyTransferOut, applyTransferIn } from "../src/inventory";

describe("applyTransferOut", () => {
  it("subtracts qty from sender", () => {
    const sender = {
      w: "", name: "A", color: "#fff",
      items: [["a1", 5]] as [string, number][],
      currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    };
    const out = applyTransferOut(sender, "a1", 3);
    expect(out.items).toEqual([["a1", 2]]);
  });

  it("throws when sender lacks the item", () => {
    const sender = {
      w: "", name: "A", color: "#fff",
      items: [] as [string, number][],
      currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    };
    expect(() => applyTransferOut(sender, "missing", 1)).toThrow();
  });
});

describe("applyTransferIn", () => {
  it("adds qty to recipient", () => {
    const recipient = {
      w: "", name: "B", color: "#fff",
      items: [["a1", 1]] as [string, number][],
      currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    };
    const out = applyTransferIn(recipient, "a1", 2);
    expect(out.items).toEqual([["a1", 3]]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- inventory`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement the split**

Edit `src/inventory.ts`. Replace `applyTransfer` with two halves:

```ts
export function applyTransferOut(
  sender: PlayerInventoryRecord,
  id: string,
  qty: number,
): PlayerInventoryRecord {
  if (qty <= 0) throw new Error(`applyTransferOut: qty must be > 0 (got ${qty})`);
  const senderItems = sender.items.map((e) => [...e] as InventoryEntry);
  const i = findIndex(senderItems, id);
  if (i < 0) throw new Error(`applyTransferOut: sender has no item ${id}`);
  if (senderItems[i][1] < qty) {
    throw new Error(`applyTransferOut: qty ${qty} exceeds sender count ${senderItems[i][1]}`);
  }
  senderItems[i][1] -= qty;
  return withItems(sender, senderItems);
}

export function applyTransferIn(
  recipient: PlayerInventoryRecord,
  id: string,
  qty: number,
): PlayerInventoryRecord {
  if (qty <= 0) throw new Error(`applyTransferIn: qty must be > 0 (got ${qty})`);
  return addItem(recipient, id, qty);
}
```

Keep `applyTransfer` as a backward-compatible re-export composing the two until call sites migrate, OR delete it after Task 15 updates `transfer.ts`. **Decision: keep `applyTransfer` for one task to avoid breakage; delete it in Task 15.**

- [ ] **Step 4: Run tests**

Run: `npm test -- inventory`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/inventory.ts test/inventory.test.ts
git commit -m "refactor(inventory): split applyTransfer into out/in halves"
```

### Task 15: Refactor `transferItem` to use `atomicMultiUpdate`

**Files:**
- Modify: `src/transfer.ts`
- Modify: `src/inventory.ts` (remove old `applyTransfer`)
- Modify: `test/transfer.test.ts` (update for new API + add multi-key + retry coverage)

- [ ] **Step 1: Update transfer test for new API**

In `test/transfer.test.ts`, the call to `transferItem` now requires `AtomicUpdateOptions`:

```ts
await transferItem({
  fromPlayerId: "alice", toPlayerId: "bob",
  itemId: "a1", itemName: "Sword", qty: 3,
}, { description: "transfer test" });
```

Update all call sites.

- [ ] **Step 2: Refactor `transferItem`**

Replace `src/transfer.ts`:

```ts
import OBR from "@owlbear-rodeo/sdk";
import { BROADCAST_CHANNEL } from "./constants";
import { atomicMultiUpdate, type AtomicUpdateOptions, type Mutator } from "./atomic";
import { applyTransferIn, applyTransferOut } from "./inventory";
import { getRecord, recordKey } from "./metadata";
import type { PlayerInventoryRecord, TransferReceivedMessage } from "./types";

interface TransferRequest {
  fromPlayerId: string;
  toPlayerId: string;
  itemId: string;
  itemName: string;
  qty: number;
}

export async function transferItem(
  req: TransferRequest,
  opts: AtomicUpdateOptions,
): Promise<void> {
  // Read names up-front for the broadcast notification — this read isn't
  // load-bearing for the transfer itself; the mutators below re-read fresh
  // state each attempt.
  const sender = await getRecord(req.fromPlayerId);
  const recipient = await getRecord(req.toPlayerId);
  if (!sender) throw new Error(`Sender ${req.fromPlayerId} has no inventory record`);
  if (!recipient) throw new Error(`Recipient ${req.toPlayerId} has no inventory record`);

  const outMutator: Mutator<PlayerInventoryRecord> = (current) => {
    if (!current) throw new Error(`Sender ${req.fromPlayerId} has no inventory record`);
    return applyTransferOut(current, req.itemId, req.qty);
  };
  const inMutator: Mutator<PlayerInventoryRecord> = (current) => {
    if (!current) throw new Error(`Recipient ${req.toPlayerId} has no inventory record`);
    return applyTransferIn(current, req.itemId, req.qty);
  };

  await atomicMultiUpdate([
    { key: recordKey(req.fromPlayerId), mutate: outMutator as unknown as Mutator<unknown> },
    { key: recordKey(req.toPlayerId), mutate: inMutator as unknown as Mutator<unknown> },
  ], opts);

  const note: TransferReceivedMessage = {
    type: "transfer-received",
    fromPlayerId: req.fromPlayerId,
    fromName: sender.name,
    toPlayerId: req.toPlayerId,
    toName: recipient.name,
    itemId: req.itemId,
    itemName: req.itemName,
    quantity: req.qty,
  };
  await OBR.broadcast.sendMessage(BROADCAST_CHANNEL, note, { destination: "ALL" });
}
```

- [ ] **Step 3: Remove old `applyTransfer` from `src/inventory.ts`**

Delete the old `applyTransfer` function. Run typecheck to find any stragglers:

Run: `npx tsc --noEmit`

Fix any remaining references (UI files may import `applyTransfer` directly — replace with the two halves at those sites).

- [ ] **Step 4: Add retry coverage to `test/transfer.test.ts`**

Append:

```ts
it("retries on conflict and converges (rapid-fire from one client)", async () => {
  await seedRecord("alice", "Alice", [["a1", 10]]);
  await seedRecord("bob", "Bob");
  __testHooks.setSelf("alice", "Alice", "#fff");

  // Fire 5 transfers without awaiting between
  const transfers = Array.from({ length: 5 }, () =>
    transferItem({
      fromPlayerId: "alice", toPlayerId: "bob",
      itemId: "a1", itemName: "Sword", qty: 1,
    }, { description: "rapid fire" }),
  );
  await Promise.all(transfers);

  const a = await getRecord("alice");
  const b = await getRecord("bob");
  expect(a?.items).toEqual([["a1", 5]]);
  expect(b?.items).toEqual([["a1", 5]]);
});
```

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/transfer.ts src/inventory.ts test/transfer.test.ts
git commit -m "refactor(transfer): use atomicMultiUpdate; rapid-fire test passes"
```

---

## Phase 5 — UI overlay

### Task 16: Overlay CSS module

**Files:**
- Create: `src/styles-overlay.ts`

- [ ] **Step 1: Create the file**

Write `src/styles-overlay.ts`:

```ts
export const OVERLAY_CSS = `
.atomic-overlay-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(20, 16, 11, 0.55);
  z-index: 9000;
  pointer-events: all;
}
.atomic-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 18px 22px;
  min-width: 280px;
  max-width: 80%;
  z-index: 9001;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}
.atomic-overlay__spinner {
  width: 28px; height: 28px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: atomic-spin 0.8s linear infinite;
}
@keyframes atomic-spin {
  to { transform: rotate(360deg); }
}
.atomic-overlay__text {
  color: var(--text);
  text-align: center;
  font-family: var(--font-body);
  font-size: 14px;
}
.atomic-overlay__cancel {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-family: var(--font-body);
}
.atomic-overlay__cancel:hover {
  border-color: var(--accent);
  color: var(--text);
}
.atomic-overlay__cancel:disabled {
  opacity: 0.5;
  cursor: default;
}
`;
```

- [ ] **Step 2: Wire into `main.ts`**

Edit `src/main.ts`. After existing `injectStyles` calls, add:

```ts
import { OVERLAY_CSS } from "./styles-overlay";
// ...
injectStyles(OVERLAY_CSS, "obr-inv-overlay-styles");
```

- [ ] **Step 3: Run build to verify CSS is reachable**

Run: `npm run build`
Expected: builds without error.

- [ ] **Step 4: Commit**

```bash
git add src/styles-overlay.ts src/main.ts
git commit -m "feat(ui): overlay CSS module"
```

### Task 17: Overlay singleton module

**Files:**
- Create: `src/ui-overlay.ts`
- Test: `test/ui-overlay.test.ts`

- [ ] **Step 1: Write failing test**

Create `test/ui-overlay.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { showOverlay, closeOverlay, setOverlayDescription, setOverlayState } from "../src/ui-overlay";

describe("ui-overlay", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("shows description and cancel button on showOverlay", () => {
    showOverlay({ description: "Working…", onCancel: () => {} });
    expect(document.querySelector(".atomic-overlay__text")?.textContent).toBe("Working…");
    expect(document.querySelector(".atomic-overlay__cancel")).toBeTruthy();
  });

  it("calls onCancel when cancel button clicked", () => {
    const onCancel = vi.fn();
    showOverlay({ description: "Working…", onCancel });
    (document.querySelector(".atomic-overlay__cancel") as HTMLButtonElement).click();
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel on Escape keydown", () => {
    const onCancel = vi.fn();
    showOverlay({ description: "Working…", onCancel });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("setOverlayDescription updates the visible text", () => {
    showOverlay({ description: "Working…", onCancel: () => {} });
    setOverlayDescription("Waiting on Bob…");
    expect(document.querySelector(".atomic-overlay__text")?.textContent).toBe("Waiting on Bob…");
  });

  it("setOverlayState 'cancelling' disables the cancel button and updates text", () => {
    showOverlay({ description: "Working…", onCancel: () => {} });
    setOverlayState("cancelling");
    const btn = document.querySelector(".atomic-overlay__cancel") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("closeOverlay removes the overlay and backdrop", () => {
    showOverlay({ description: "Working…", onCancel: () => {} });
    closeOverlay();
    expect(document.querySelector(".atomic-overlay")).toBeNull();
    expect(document.querySelector(".atomic-overlay-backdrop")).toBeNull();
  });

  it("closeOverlay clears the Escape listener", () => {
    const onCancel = vi.fn();
    showOverlay({ description: "Working…", onCancel });
    closeOverlay();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- ui-overlay`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the overlay**

Create `src/ui-overlay.ts`:

```ts
export interface ShowOverlayOpts {
  description: string;
  onCancel: () => void;
}

const HARD_CAP_MS = 5000;

let backdrop: HTMLElement | null = null;
let pop: HTMLElement | null = null;
let textEl: HTMLElement | null = null;
let cancelBtn: HTMLButtonElement | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;
let hardCapTimer: ReturnType<typeof setTimeout> | null = null;
let hardCapHandler: (() => void) | null = null;

export function showOverlay(opts: ShowOverlayOpts): void {
  closeOverlay();

  backdrop = document.createElement("div");
  backdrop.className = "atomic-overlay-backdrop";
  document.body.appendChild(backdrop);

  pop = document.createElement("div");
  pop.className = "atomic-overlay";

  const spinner = document.createElement("div");
  spinner.className = "atomic-overlay__spinner";
  pop.appendChild(spinner);

  textEl = document.createElement("div");
  textEl.className = "atomic-overlay__text";
  textEl.textContent = opts.description;
  pop.appendChild(textEl);

  cancelBtn = document.createElement("button");
  cancelBtn.className = "atomic-overlay__cancel";
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => opts.onCancel();
  pop.appendChild(cancelBtn);

  document.body.appendChild(pop);

  escHandler = (e) => { if (e.key === "Escape") opts.onCancel(); };
  document.addEventListener("keydown", escHandler);

  hardCapHandler = () => opts.onCancel();
  hardCapTimer = setTimeout(() => { hardCapHandler?.(); }, HARD_CAP_MS);
}

export function setOverlayDescription(text: string): void {
  if (textEl) textEl.textContent = text;
}

export function setOverlayState(state: "working" | "cancelling"): void {
  if (!cancelBtn || !textEl) return;
  if (state === "cancelling") {
    cancelBtn.disabled = true;
    textEl.textContent = "Cancelling…";
  } else {
    cancelBtn.disabled = false;
  }
}

export function closeOverlay(): void {
  if (hardCapTimer) { clearTimeout(hardCapTimer); hardCapTimer = null; }
  hardCapHandler = null;
  if (escHandler) {
    document.removeEventListener("keydown", escHandler);
    escHandler = null;
  }
  pop?.remove();
  backdrop?.remove();
  pop = null;
  backdrop = null;
  textEl = null;
  cancelBtn = null;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- ui-overlay`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui-overlay.ts test/ui-overlay.test.ts
git commit -m "feat(ui): overlay singleton with cancel and Escape handling"
```

---

## Phase 6 — Wire callers

### Task 18: Wire `transferItem` call in `ui-player.ts`

**Files:**
- Modify: `src/ui-player.ts` (find the transfer call site)

- [ ] **Step 1: Locate the transfer call site**

Run: `grep -n "transferItem" src/ui-player.ts src/ui-gm.ts`

- [ ] **Step 2: Update each transfer call site**

For each call to `transferItem`, wrap it in the overlay shape. Example pattern:

```ts
import { showOverlay, closeOverlay, setOverlayDescription, setOverlayState } from "./ui-overlay";
import { parseWriter } from "./atomic";
import { ConflictError, AbortError } from "./types";

async function performTransfer(req: TransferRequest, records: Record<string, PlayerInventoryRecord>) {
  const ac = new AbortController();
  const recipientName = records[req.toPlayerId]?.name ?? "player";
  const baseDescription = `Transferring ${req.qty}× ${req.itemName} to ${recipientName}…`;
  showOverlay({ description: baseDescription, onCancel: () => {
    setOverlayState("cancelling");
    ac.abort();
  }});

  try {
    await transferItem(req, {
      signal: ac.signal,
      description: baseDescription,
      onConflict: ({ blockerWriter }) => {
        const { playerId } = parseWriter(blockerWriter);
        if (playerId === OBR.player.id) {
          setOverlayDescription("Waiting on your other session…");
        } else {
          const name = playerId ? records[playerId]?.name : null;
          setOverlayDescription(name
            ? `Waiting on update from ${name}…`
            : "Update conflict — retrying…");
        }
      },
    });
    closeOverlay();
  } catch (err) {
    closeOverlay();
    if (err instanceof AbortError) {
      OBR.notification?.show?.("Cancelled", "INFO")?.catch?.(() => {});
    } else if (err instanceof ConflictError) {
      const { playerId } = parseWriter(err.lastBlockerWriter ?? "");
      const name = playerId ? records[playerId]?.name : null;
      const msg = name
        ? `Couldn't apply your change — kept conflicting with ${name}'s updates. Please try again.`
        : `Update conflict — please try again.`;
      OBR.notification?.show?.(msg, "ERROR")?.catch?.(() => {});
    } else {
      throw err;
    }
  }
}
```

Replace the existing direct `await transferItem(...)` calls with `await performTransfer(...)`.

- [ ] **Step 3: Run tests + manual smoke**

Run: `npm test`
Expected: existing transfer tests still pass (they don't go through performTransfer; they call transferItem directly with `{ description: "..." }`).

- [ ] **Step 4: Commit**

```bash
git add src/ui-player.ts
git commit -m "feat(ui): wire transferItem through overlay with cancel + blocker reporting"
```

### Task 19: Wire remaining mutating call sites

**Files:**
- Modify: `src/ui-gm.ts`, `src/ui-add-dialog.ts`, `src/ui-customs-dialog.ts`, `src/ui-customs-panel.ts`, `src/ui-description.ts`, `src/ui-player.ts` (currency)

- [ ] **Step 1: Identify all call sites**

Run: `grep -rn "writeRecord\|writeCustoms\|ensureRecord\|deleteRecord" src/ui-*.ts src/customs.ts`

- [ ] **Step 2: Wrap each user-initiated mutation in the overlay pattern**

For each call site, follow the same pattern as Task 18. Reusable helper recommended — consider creating `src/ui-mutate.ts`:

```ts
import OBR from "@owlbear-rodeo/sdk";
import { showOverlay, closeOverlay, setOverlayDescription, setOverlayState } from "./ui-overlay";
import { parseWriter } from "./atomic";
import { ConflictError, AbortError } from "./types";
import type { PlayerInventoryRecord } from "./types";

export async function withOverlay<T>(
  description: string,
  records: Record<string, PlayerInventoryRecord>,
  run: (opts: { signal: AbortSignal; description: string; onConflict: (info: { blockerWriter: string; attempt: number }) => void }) => Promise<T>,
): Promise<T | null> {
  const ac = new AbortController();
  showOverlay({ description, onCancel: () => { setOverlayState("cancelling"); ac.abort(); } });
  try {
    const result = await run({
      signal: ac.signal,
      description,
      onConflict: ({ blockerWriter }) => {
        const { playerId } = parseWriter(blockerWriter);
        if (playerId === OBR.player.id) setOverlayDescription("Waiting on your other session…");
        else {
          const name = playerId ? records[playerId]?.name : null;
          setOverlayDescription(name ? `Waiting on update from ${name}…` : "Update conflict — retrying…");
        }
      },
    });
    closeOverlay();
    return result;
  } catch (err) {
    closeOverlay();
    if (err instanceof AbortError) {
      OBR.notification?.show?.("Cancelled", "INFO")?.catch?.(() => {});
      return null;
    }
    if (err instanceof ConflictError) {
      const { playerId } = parseWriter(err.lastBlockerWriter ?? "");
      const name = playerId ? records[playerId]?.name : null;
      const msg = name
        ? `Couldn't apply your change — kept conflicting with ${name}'s updates. Please try again.`
        : "Update conflict — please try again.";
      OBR.notification?.show?.(msg, "ERROR")?.catch?.(() => {});
      return null;
    }
    throw err;
  }
}
```

Use it at each call site:

```ts
await withOverlay(`Adding ${itemName}…`, records, (opts) =>
  writeRecord(playerId, (current) => addItem(current!, itemId, qty), opts),
);
```

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 4: Manual smoke**

Run: `npm run dev` — open in OBR, transfer items rapidly, confirm:
- Spinner appears
- Items move correctly even on rapid clicks
- Cancel button works
- No items "pop back"

- [ ] **Step 5: Commit**

```bash
git add src/ui-mutate.ts src/ui-*.ts
git commit -m "feat(ui): wire all mutating call sites through overlay"
```

---

## Phase 7 — Final integration tests

### Task 20: Integration test — cross-client conflict

**Files:**
- Modify: `test/transfer.test.ts`

- [ ] **Step 1: Write the test**

Append to `test/transfer.test.ts`:

```ts
it("converges when two clients write the same record concurrently", async () => {
  await seedRecord("alice", "Alice", [["a1", 5]]);
  await seedRecord("bob", "Bob");
  __testHooks.setSelf("alice", "Alice", "#fff");

  // Simulate a second client (bob's tab) overwriting the recipient mid-flight.
  const sdk = (await import("@owlbear-rodeo/sdk")).default;
  const realSet = sdk.room.setMetadata;
  let stomped = false;
  sdk.room.setMetadata = vi.fn(async (patch: Record<string, unknown>) => {
    await realSet(patch);
    if (!stomped) {
      stomped = true;
      // pretend bob's tab wrote his record between alice's write and echo
      const bobKey = "com.abottchen.obr-inv/v1/bob";
      const bob = (patch[bobKey] as { items: [string, number][]; w: string }) ?? null;
      if (bob) {
        await realSet({
          [bobKey]: { ...bob, w: "bob-id:other", items: [...bob.items] },
        });
      }
    }
  }) as typeof sdk.room.setMetadata;

  await transferItem({
    fromPlayerId: "alice", toPlayerId: "bob",
    itemId: "a1", itemName: "Sword", qty: 2,
  }, { description: "test" });

  const a = await getRecord("alice");
  const b = await getRecord("bob");
  // alice's transfer eventually lands; bob's record reflects alice's transfer.
  expect(a?.items).toEqual([["a1", 3]]);
  expect(b?.items).toEqual([["a1", 2]]);
});
```

- [ ] **Step 2: Run**

Run: `npm test -- transfer`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add test/transfer.test.ts
git commit -m "test(transfer): cross-client conflict converges via retry"
```

### Task 21: Final typecheck and full test run

**Files:** none — verification step.

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Manual checklist (perform in dev)**

```bash
npm run dev
```

In OBR with the dev manifest:
- Transfer a single item — spinner appears, item moves, no error.
- Transfer 5 items rapidly back-to-back — all 5 land with no items "popping back."
- Open a second tab as the same player, perform simultaneous edits — both converge.
- Click Cancel during an in-flight transfer — overlay closes within 1s, state is consistent.
- (If feasible) test with two browsers signed in as different players: simultaneous transfers to the same recipient — both eventually land.

- [ ] **Step 5: Commit (if any tweaks were needed)**

```bash
# only if changes
git add -p
git commit -m "chore: final tweaks from manual smoke"
```

---

## Risks and Watch-Outs

1. **Test mock fires `onMetadataChange` synchronously after `setMetadata`.** The atomic engine's "register predicate, then resolve on echo" path needs to handle this — `waitForEcho` first checks `latestWriters` synchronously to handle the early-echo case. If a conflict test seems to hang, this is the place to check.

2. **`crypto.getRandomValues` requires jsdom or polyfill.** Vitest's jsdom environment should provide it; if not, add a polyfill in `test/setup.ts`.

3. **Existing call sites in UI files need careful migration.** Search globally with `grep -rn "writeRecord\|writeCustoms\|ensureRecord\|deleteRecord" src/`. Each call site needs the new `(mutate, opts)` signature. Don't miss any — TypeScript will flag them.

4. **`OverCapError` is now thrown by `atomicMultiUpdate` itself, not by `metadata.ts`.** The existing GM-broadcast handling in `transfer.ts` was wrapping a write that would throw OverCapError; with the refactor, the throw point moves into the atomic helper but still propagates out. Confirm the existing `try/catch` in callers still catches it (it should — the error type is unchanged).

5. **Don't delete the old per-key queue (`enqueue` in `metadata.ts`) until after Task 12 lands.** The new global queue replaces it; deleting it earlier would break ordering during the migration.

6. **Mutator that throws (e.g., "sender has no item")** will propagate out of `atomicMultiUpdate` and bypass retry — that's intentional. Programmer/data errors shouldn't loop.

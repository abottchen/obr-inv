# Auto-heal Inventory on Reconnect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `ScorpioTHK` reconnects under a fresh private-mode `playerId`, the GM client automatically merges his orphaned inventory record(s) onto his live id — no manual Merge step.

**Architecture:** A new `src/heal.ts` holds a pure planner (`planHeal`) and an IO executor (`runHeal`). `ui-gm.ts` calls `runHeal` on `OBR.party.onChange` and once at mount. It reuses the existing `executeMerge` / `ensureRecord` machinery; no schema change.

**Tech Stack:** Vanilla TypeScript, Vite, Vitest + jsdom, `@owlbear-rodeo/sdk` (mocked in tests).

**Spec:** [`../specs/2026-07-13-auto-heal-reconnect-design.md`](../specs/2026-07-13-auto-heal-reconnect-design.md)

## Global Constraints

- **Only the handle `ScorpioTHK` may appear in source/tests/commits — never a real player name.** The git forbidden-name hooks reject `<first-name> <Capitalized-word>`.
- **Background/boot writes skip `withOverlay`** — call the atomic helpers directly with a `description`. `runHeal` is background, so no overlay.
- **Test mock import ordering:** `test/_mocks/obr-sdk.ts` must be imported before any `src/` module that transitively imports the SDK.
- **Atomic tests reset both hooks:** any test that triggers a write calls `__testHooks.reset()` and `__atomicTestHooks.reset()` in `beforeEach`.
- **Run a single test file with:** `npx vitest run test/heal.test.ts`. Full suite: `npm test`. Build: `npm run build`.
- **Commit messages end with:** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: `AUTO_HEAL_NAME` constant + `planHeal` pure function

**Files:**
- Modify: `src/constants.ts` (append constant)
- Create: `src/heal.ts`
- Create: `test/heal.test.ts`

**Interfaces:**
- Consumes: `PlayerInventoryRecord` from `src/types.ts` (`{ w, name, color, items: [string, number][], currency: {pp,gp,sp,cp} }`).
- Produces:
  - `AUTO_HEAL_NAME: string` (from `src/constants.ts`)
  - `interface HealPlan { targetId: string; sourceIds: string[] }`
  - `planHeal(name: string, liveId: string, records: Record<string, PlayerInventoryRecord>): HealPlan | null`

- [ ] **Step 1: Add the constant**

Append to `src/constants.ts`:

```ts
// ScorpioTHK plays in a private browser window, so OBR issues him a new
// playerId every session, orphaning his inventory record. His display name
// is his only stable identifier, so the GM client auto-merges stray records
// with this name onto his live id whenever he (re)connects. See src/heal.ts.
// If he ever changes his OBR display name, update this value.
export const AUTO_HEAL_NAME = "ScorpioTHK";
```

- [ ] **Step 2: Write the failing test**

Create `test/heal.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run test/heal.test.ts`
Expected: FAIL — `Failed to resolve import "../src/heal"` (module does not exist yet).

- [ ] **Step 4: Write minimal implementation**

Create `src/heal.ts`:

```ts
import { AUTO_HEAL_NAME } from "./constants";
import type { PlayerInventoryRecord } from "./types";

const norm = (s: string): string => s.trim().toLowerCase();

function hasContent(rec: PlayerInventoryRecord): boolean {
  const items = rec.items.some(([, n]) => n > 0);
  const c = rec.currency;
  return items || c.pp > 0 || c.gp > 0 || c.sp > 0 || c.cp > 0;
}

export interface HealPlan {
  targetId: string;
  sourceIds: string[];
}

/**
 * Given the target display name, the connected player's live id, and all
 * inventory records, decide which stale records to consolidate onto the live
 * id. Pure — no OBR. Returns null when there is nothing worth doing.
 */
export function planHeal(
  name: string,
  liveId: string,
  records: Record<string, PlayerInventoryRecord>,
): HealPlan | null {
  const target = norm(name);
  const candidates = Object.keys(records).filter(
    (id) => norm(records[id].name) === target,
  );
  const sourceIds = candidates.filter((id) => id !== liveId);
  if (sourceIds.length === 0) return null;
  const liveHasRecord = candidates.includes(liveId);
  // No live record and every stray is empty → nothing worth re-keying;
  // avoid churning a write every session for an empty inventory.
  if (!liveHasRecord && sourceIds.every((id) => !hasContent(records[id]))) {
    return null;
  }
  return { targetId: liveId, sourceIds };
}
```

Note: `AUTO_HEAL_NAME` is imported now so it is available to `runHeal` in Task 2; it is intentionally unused in this task's exports. (It is referenced by the constant's own consumers; the import will be used once `runHeal` lands. If your linter fails the build on unused imports, defer this import line to Task 2 — `npm run build` uses `tsc` which does not error on unused imports by default here.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run test/heal.test.ts`
Expected: PASS — 9 passing.

- [ ] **Step 6: Commit**

```bash
git add src/constants.ts src/heal.ts test/heal.test.ts
git commit -m "$(cat <<'EOF'
feat: add planHeal and AUTO_HEAL_NAME for reconnect auto-heal

Pure planner that decides which stale same-name records consolidate onto a
connected player's live id. Hardcoded to the one private-mode account.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `runHeal` executor + `party.onChange` mock

**Files:**
- Modify: `test/_mocks/obr-sdk.ts` (add `party.onChange`, fire listeners on `setParty`)
- Modify: `src/heal.ts` (add `runHeal`)
- Modify: `test/heal.test.ts` (add `runHeal` integration tests)

**Interfaces:**
- Consumes: `listInventoryRecords`, `ensureRecord` from `src/metadata.ts`; `executeMerge(targetId, sourceId, opts)` from `src/merge.ts`; `OBR.notification.show`; `planHeal` from Task 1.
- Produces: `runHeal(players: Array<{ id: string; name: string; color: string }>): Promise<void>`

- [ ] **Step 1: Extend the SDK mock with `party.onChange`**

In `test/_mocks/obr-sdk.ts`:

Add after the `metadataListeners` declaration (currently line 11):

```ts
const partyListeners: Array<(p: typeof players) => void> = [];
```

Replace the `party` block (currently `party: { getPlayers: vi.fn(async () => players) },`) with:

```ts
  party: {
    getPlayers: vi.fn(async () => players),
    onChange: vi.fn((cb: (p: typeof players) => void) => {
      partyListeners.push(cb);
      return () => {
        const i = partyListeners.indexOf(cb);
        if (i >= 0) partyListeners.splice(i, 1);
      };
    }),
  },
```

In `__testHooks.reset()`, add after `players = [];`:

```ts
    partyListeners.length = 0;
```

and add near the other `mockClear()` calls:

```ts
    OBR.party.onChange.mockClear();
```

Replace `setParty` with a version that notifies listeners:

```ts
  setParty(p: typeof players) { players = p; partyListeners.forEach((l) => l(players)); },
```

- [ ] **Step 2: Write the failing tests**

Replace the import line at the top of `test/heal.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { planHeal } from "../src/heal";
import type { PlayerInventoryRecord } from "../src/types";
```

with:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { OBR, __testHooks } from "./_mocks/obr-sdk";
import { __atomicTestHooks } from "../src/atomic";
import { writeRecord, getRecord } from "../src/metadata";
import * as mergeMod from "../src/merge";
import { planHeal, runHeal } from "../src/heal";
import type { PlayerInventoryRecord } from "../src/types";

// Partial-mock merge so the resilience test can spy on executeMerge while all
// other tests use the real implementation (spread from the actual module).
vi.mock("../src/merge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/merge")>()),
}));

const seedRecord = async (
  pid: string,
  name: string,
  items: [string, number][] = [],
  currency = { pp: 0, gp: 0, sp: 0, cp: 0 },
) => {
  await writeRecord(
    pid,
    () => ({ w: "", name, color: "#fff", items, currency }),
    { description: `seed ${pid}` },
  );
};

const party = (id: string) => [{ id, name: "ScorpioTHK", color: "#ffd433" }];
```

Then append this describe block to the end of `test/heal.test.ts`:

```ts
describe("runHeal (integration)", () => {
  beforeEach(() => { __testHooks.reset(); __atomicTestHooks.reset(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("merges a full stale record into the blank live record and notifies", async () => {
    await seedRecord("scorpio-old", "ScorpioTHK", [["sword", 3]], { pp: 0, gp: 50, sp: 0, cp: 0 });
    await seedRecord("scorpio-new", "ScorpioTHK");

    await runHeal(party("scorpio-new"));

    expect(await getRecord("scorpio-old")).toBeNull();
    const live = await getRecord("scorpio-new");
    expect(live?.items).toEqual([["sword", 3]]);
    expect(live?.currency.gp).toBe(50);
    expect(OBR.notification.show).toHaveBeenCalledTimes(1);
  });

  it("creates the live record and re-keys when he has not opened his popover", async () => {
    await seedRecord("scorpio-old", "ScorpioTHK", [["potion", 2]]);

    await runHeal(party("scorpio-new"));

    expect(await getRecord("scorpio-old")).toBeNull();
    const live = await getRecord("scorpio-new");
    expect(live?.items).toEqual([["potion", 2]]);
    expect(OBR.notification.show).toHaveBeenCalledTimes(1);
  });

  it("does nothing when only the live record exists", async () => {
    await seedRecord("scorpio-new", "ScorpioTHK", [["sword", 1]]);

    await runHeal(party("scorpio-new"));

    const live = await getRecord("scorpio-new");
    expect(live?.items).toEqual([["sword", 1]]);
    expect(OBR.notification.show).not.toHaveBeenCalled();
  });

  it("does nothing when the target player is not connected", async () => {
    await seedRecord("scorpio-old", "ScorpioTHK", [["sword", 1]]);

    await runHeal([{ id: "someone", name: "NotScorpio", color: "#fff" }]);

    expect(await getRecord("scorpio-old")).not.toBeNull();
    expect(OBR.notification.show).not.toHaveBeenCalled();
  });

  it("continues past a failed merge and still heals the rest", async () => {
    await seedRecord("old1", "ScorpioTHK", [["sword", 1]]);
    await seedRecord("old2", "ScorpioTHK", [["shield", 1]]);
    const real = mergeMod.executeMerge;
    vi.spyOn(mergeMod, "executeMerge").mockImplementation((t, s, o) =>
      s === "old1" ? Promise.reject(new Error("boom")) : real(t, s, o),
    );

    await runHeal(party("scorpio-new"));

    const live = await getRecord("scorpio-new");
    expect(live?.items).toEqual([["shield", 1]]);   // old2 merged in
    expect(await getRecord("old1")).not.toBeNull();  // failed source left intact
    expect(await getRecord("old2")).toBeNull();      // successful source deleted
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run test/heal.test.ts`
Expected: FAIL — `runHeal` is not exported from `../src/heal` (planHeal tests still pass).

- [ ] **Step 4: Implement `runHeal`**

Add to `src/heal.ts` — imports at the top (merge the SDK/metadata/merge imports with the existing ones):

```ts
import OBR from "@owlbear-rodeo/sdk";
import { AUTO_HEAL_NAME } from "./constants";
import { listInventoryRecords, ensureRecord } from "./metadata";
import { executeMerge } from "./merge";
import type { PlayerInventoryRecord } from "./types";
```

(`planHeal`, `norm`, `hasContent`, `HealPlan` from Task 1 stay as they are.)

Append to the end of `src/heal.ts`:

```ts
interface HealablePlayer { id: string; name: string; color: string; }

// Serialize runs so two rapid party changes don't race on the same records.
let inFlight: Promise<void> | null = null;

/**
 * If the auto-heal target player is connected, consolidate any stray records
 * carrying his name onto his live id. GM-client only; background write (no
 * overlay). Safe to call repeatedly — idempotent once consolidated.
 */
export function runHeal(players: HealablePlayer[]): Promise<void> {
  const next = (inFlight ?? Promise.resolve())
    .catch(() => {})
    .then(() => healOnce(players));
  inFlight = next.catch(() => {});
  return next;
}

async function healOnce(players: HealablePlayer[]): Promise<void> {
  const live = players.find((p) => norm(p.name) === norm(AUTO_HEAL_NAME));
  if (!live) return;

  const records = await listInventoryRecords();
  const plan = planHeal(AUTO_HEAL_NAME, live.id, records);
  if (!plan) return;

  if (!records[live.id]) {
    await ensureRecord(live.id, live.name, live.color);
  }

  let healed = false;
  for (const sourceId of plan.sourceIds) {
    try {
      await executeMerge(plan.targetId, sourceId, {
        description: "auto-heal reconnect",
      });
      healed = true;
    } catch (e) {
      console.warn("[obr-inv] auto-heal merge failed", sourceId, e);
    }
  }

  if (healed) {
    OBR.notification?.show?.(
      `Reunited ${AUTO_HEAL_NAME} with their inventory.`,
      "INFO",
    )?.catch?.(() => console.warn("[obr-inv] notification.show unavailable"));
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run test/heal.test.ts`
Expected: PASS — 14 passing (9 `planHeal` + 5 `runHeal`).

- [ ] **Step 6: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: PASS — all existing suites green (the `setParty` change is a no-op for tests without party listeners).

- [ ] **Step 7: Commit**

```bash
git add src/heal.ts test/heal.test.ts test/_mocks/obr-sdk.ts
git commit -m "$(cat <<'EOF'
feat: add runHeal executor for reconnect auto-heal

Consolidates a private-mode player's orphaned records onto his live id using
the existing executeMerge machinery; notifies the GM once per heal. Adds
party.onChange to the test SDK mock.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire `runHeal` into the GM view

**Files:**
- Modify: `src/ui-gm.ts` (import `runHeal`, subscribe to `party.onChange`, initial run at mount, unsubscribe on destroy)

**Interfaces:**
- Consumes: `runHeal` from `src/heal.ts`; `OBR.party.onChange`, `OBR.party.getPlayers`.
- Produces: nothing new (wiring only).

- [ ] **Step 1: Import `runHeal`**

In `src/ui-gm.ts`, add alongside the other local imports (e.g. right after `import { openMergeDialog } from "./ui-merge";`):

```ts
import { runHeal } from "./heal";
```

- [ ] **Step 2: Subscribe to party changes**

In `src/ui-gm.ts`, immediately after the `const unsubBroadcast = OBR.broadcast.onMessage(...)` block closes (before the comment `// main.ts already calls ensureRecord...`), add:

```ts
  // Auto-heal: when a private-mode player reconnects under a fresh id, the GM
  // client merges their orphaned record(s) onto the live id. See src/heal.ts.
  // Party events (not metadata) drive this, so the heal's own writes can't loop.
  const unsubParty = OBR.party.onChange((players) => { void runHeal(players); });
```

- [ ] **Step 3: Run an initial heal at mount**

In `src/ui-gm.ts`, change the final IIFE from:

```ts
  void (async () => {
    records = await listInventoryRecords();
    renderAll();
  })();
```

to:

```ts
  void (async () => {
    records = await listInventoryRecords();
    renderAll();
    void runHeal(await OBR.party.getPlayers());
  })();
```

- [ ] **Step 4: Unsubscribe on destroy**

In `src/ui-gm.ts`, change the cleanup return from:

```ts
  return () => {
    unsubMeta(); unsubCustoms(); unsubBroadcast(); shellRefs?.destroy();
  };
```

to:

```ts
  return () => {
    unsubMeta(); unsubCustoms(); unsubBroadcast(); unsubParty(); shellRefs?.destroy();
  };
```

- [ ] **Step 5: Verify the full suite still passes**

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 6: Verify the build/typecheck**

Run: `npm run build`
Expected: `tsc` passes with no type errors and Vite produces `dist/` successfully.

- [ ] **Step 7: Commit**

```bash
git add src/ui-gm.ts
git commit -m "$(cat <<'EOF'
feat: run reconnect auto-heal from the GM view

Subscribe to OBR.party.onChange and run once at mount so a private-mode
player's inventory follows them onto each new playerId automatically.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8 (manual, optional): Verify in Owlbear Rodeo**

Per `CLAUDE.md` local OBR testing: `npm run dev`, add the dev extension, open the GM view, and confirm that when the target player joins with a new id, his old record is absorbed and the "Reunited…" notification appears. (There is no automated ui-gm test; this is the end-to-end check.)

---

## Self-Review

**Spec coverage:**
- §3 "Where it runs / Trigger" → Task 3 (party.onChange + mount, GM-only view).
- §3 "Identity match" (trim/case-insensitive) → Task 1 `norm`, tested.
- §3 "Target selection / ensure live record" → Task 2 `healOnce`, tested (re-key case).
- §3 "Merge primitive / no overlay" → Task 2 uses `executeMerge` with a `description`, no `withOverlay`.
- §3 "Notification only when a merge happened" → Task 2 `healed` flag, tested (positive + negative).
- §3 "Race / multi-GM safety" → Task 2 per-merge try/catch, tested (resilience case).
- §4.2 `planHeal` steps 1-5 incl. empty-inventory guard → Task 1, tested.
- §6 test cases → Tasks 1 & 2 cover every listed case; mock `party.onChange` added in Task 2.
- §7 hardcoded handle / collision → constant comment (Task 1); collision accepted per spec, no code.

**Placeholder scan:** none — every code step is complete.

**Type consistency:** `HealPlan { targetId, sourceIds }` produced in Task 1 and consumed in Task 2. `runHeal(players)` param `{id,name,color}[]` matches OBR `Player[]` (structural) passed in Task 3. `executeMerge(target, source, opts)` matches `src/merge.ts`. `ensureRecord(id, name, color)` matches `src/metadata.ts`.

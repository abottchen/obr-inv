# UI Reactivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visual feedback (pulse, glow, delta indicator, row enter/leave motion) to inventory state changes — increment, decrement, add, remove, transfer-out, transfer-received — across the player view and GM view.

**Architecture:** A pure `PulseTracker` module diffs metadata snapshots and stamps timed pulse entries. `ui-shell.ts` calls `tracker.diff` + `tracker.mark` on every rerender; `ui-list.ts` reads pulses at row-render time and emits `data-pulse` attributes. CSS keyframes attached to `[data-pulse]` selectors do the rest. Transfer-received gets a louder treatment via a small `markReceived` method exposed on `ShellRefs`, called from the existing broadcast handler in `ui-player.ts`.

**Tech Stack:** TypeScript, Vite, Vitest + jsdom, vanilla DOM. No new runtime dependencies.

**Spec:** [`docs/superpowers/specs/2026-05-01-ui-reactivity-design.md`](../specs/2026-05-01-ui-reactivity-design.md)

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/types.ts` | Modify | Add `itemId: string` to `TransferReceivedMessage`. |
| `src/transfer.ts` | Modify | Populate `itemId` when broadcasting. |
| `src/ui-feedback.ts` | Create | `PulseTracker` interface, `createPulseTracker`, durations, priority. |
| `src/styles-feedback.ts` | Create | `FEEDBACK_CSS` string with all keyframes + reduced-motion branch. |
| `src/styles-list.ts` | Modify | `.inv-count { position: relative }` so `.inv-delta` can absolute-position. |
| `src/main.ts` | Modify | Inject `FEEDBACK_CSS`. |
| `src/ui-list.ts` | Modify | Extend `ListState` with `tracker` and `phantomRemoves`; render synthetic remove rows; emit `data-pulse` + `.inv-delta`; `scrollIntoView` on received. |
| `src/ui-shell.ts` | Modify | Construct tracker per shell; diff/mark on rerender; auto-expand collapsed categories on `received`; expose `markReceived(itemId, qty)` on `ShellRefs`. |
| `src/ui-player.ts` | Modify | Call `refs.markReceived(...)` on `transfer-received` broadcast. |
| `src/ui-gm.ts` | (no changes) | Verified by re-running existing smoke tests. |
| `test/ui-feedback.test.ts` | Create | Pure `PulseTracker` tests. |
| `test/ui-feedback-dom.test.ts` | Create | DOM integration via `mountShell`. |

---

## Task 1: Add `itemId` to the transfer-received message

**Files:**
- Modify: `src/types.ts:31-37`
- Modify: `src/transfer.ts:78-84`
- Test: existing `test/transfer.test.ts` should still pass

- [ ] **Step 1: Update the type**

In `src/types.ts`, change:

```ts
export interface TransferReceivedMessage {
  type: "transfer-received";
  fromName: string;
  toPlayerId: string;
  itemName: string;
  quantity: number;
}
```

to:

```ts
export interface TransferReceivedMessage {
  type: "transfer-received";
  fromName: string;
  toPlayerId: string;
  itemId: string;
  itemName: string;
  quantity: number;
}
```

- [ ] **Step 2: Populate `itemId` in transfer.ts**

In `src/transfer.ts`, change the `note` literal:

```ts
const note: TransferReceivedMessage = {
  type: "transfer-received",
  fromName: sender.name,
  toPlayerId: req.toPlayerId,
  itemName: req.itemName,
  quantity: req.qty,
};
```

to:

```ts
const note: TransferReceivedMessage = {
  type: "transfer-received",
  fromName: sender.name,
  toPlayerId: req.toPlayerId,
  itemId: req.itemId,
  itemName: req.itemName,
  quantity: req.qty,
};
```

- [ ] **Step 3: Run typecheck + tests**

```
npx tsc --noEmit
npm test
```
Expected: PASS (all 50+ tests still pass; typecheck clean).

- [ ] **Step 4: Commit**

```
git add src/types.ts src/transfer.ts
git commit -m "feat(types): include itemId in transfer-received broadcast"
```

---

## Task 2: Implement the `PulseTracker` (TDD, pure logic)

**Files:**
- Create: `src/ui-feedback.ts`
- Test: `test/ui-feedback.test.ts`

- [ ] **Step 1: Write the test file**

Create `test/ui-feedback.test.ts`:

```ts
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
    now = 2100; // 600ms past second mark; still in 700ms window
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
```

- [ ] **Step 2: Run the test file — confirm failure**

```
npm test -- test/ui-feedback.test.ts
```
Expected: FAIL — `Cannot find module '../src/ui-feedback'`.

- [ ] **Step 3: Implement `src/ui-feedback.ts`**

Create `src/ui-feedback.ts`:

```ts
import type { PlayerInventoryRecord } from "./types";

export type PulseKind = "inc" | "dec" | "add" | "remove" | "received";

export interface PulseEntry {
  kind: PulseKind;
  delta?: number;
  startedAt: number;
}

export type PulseMark = Omit<PulseEntry, "startedAt">;

export interface PulseTracker {
  diff(
    prev: PlayerInventoryRecord | null,
    next: PlayerInventoryRecord,
  ): Map<string, PulseMark>;
  mark(marks: Map<string, PulseMark>): void;
  consume(id: string): PulseEntry | null;
}

const DURATIONS: Record<PulseKind, number> = {
  inc: 700,
  dec: 700,
  add: 700,
  remove: 400,
  received: 1500,
};

const PRIORITY: Record<PulseKind, number> = {
  remove: 1,
  dec: 2,
  add: 3,
  inc: 3,
  received: 4,
};

export function createPulseTracker(
  now: () => number = Date.now,
): PulseTracker {
  const entries = new Map<string, PulseEntry>();

  return {
    diff(prev, next) {
      const out = new Map<string, PulseMark>();
      if (prev === null) return out;

      const prevMap = new Map(prev.items);
      const nextMap = new Map(next.items);
      const allIds = new Set<string>([...prevMap.keys(), ...nextMap.keys()]);

      for (const id of allIds) {
        const p = prevMap.get(id) ?? 0;
        const n = nextMap.get(id) ?? 0;
        if (p === n) continue;
        if (p === 0 && n > 0) {
          out.set(id, { kind: "add", delta: n });
        } else if (n === 0) {
          out.set(id, { kind: "remove" });
        } else if (n > p) {
          out.set(id, { kind: "inc", delta: n - p });
        } else {
          out.set(id, { kind: "dec", delta: n - p });
        }
      }
      return out;
    },

    mark(marks) {
      const ts = now();
      for (const [id, m] of marks) {
        const existing = entries.get(id);
        if (existing && existing.startedAt + DURATIONS[existing.kind] > ts) {
          if (PRIORITY[m.kind] < PRIORITY[existing.kind]) continue;
        }
        entries.set(id, { ...m, startedAt: ts });
      }
    },

    consume(id) {
      const entry = entries.get(id);
      if (!entry) return null;
      if (now() - entry.startedAt >= DURATIONS[entry.kind]) {
        entries.delete(id);
        return null;
      }
      return entry;
    },
  };
}
```

- [ ] **Step 4: Run the test file — confirm pass**

```
npm test -- test/ui-feedback.test.ts
```
Expected: PASS — all tracker tests green. Then run full suite to confirm nothing else broke:

```
npm test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```
git add src/ui-feedback.ts test/ui-feedback.test.ts
git commit -m "feat(ui-feedback): add PulseTracker for timed visual feedback"
```

---

## Task 3: Create `styles-feedback.ts` and inject from main

**Files:**
- Create: `src/styles-feedback.ts`
- Modify: `src/main.ts:13-15`

- [ ] **Step 1: Create `src/styles-feedback.ts`**

```ts
export const FEEDBACK_CSS = `
.inv-row { position: relative; }
.inv-delta {
  position: absolute; right: 0; top: -2px;
  font-size: 11px; font-weight: 700; pointer-events: none;
  opacity: 0;
}
.inv-delta:empty { display: none; }

/* Standard glow (inc / add positive, dec negative) */
.inv-row[data-pulse="inc"], .inv-row[data-pulse="add"] {
  animation: feedback-glow 700ms ease-out;
}
.inv-row[data-pulse="dec"] {
  animation: feedback-glow-neg 700ms ease-out;
}
@keyframes feedback-glow {
  0%   { box-shadow: none; }
  25%  { box-shadow: 0 0 0 2px var(--accent), 0 0 16px rgba(124,77,255,0.5); }
  100% { box-shadow: none; }
}
@keyframes feedback-glow-neg {
  0%   { box-shadow: none; }
  25%  { box-shadow: 0 0 0 2px var(--warn), 0 0 14px rgba(252,211,77,0.3); }
  100% { box-shadow: none; }
}

/* Count pulse */
.inv-row[data-pulse="inc"] .inv-count,
.inv-row[data-pulse="add"] .inv-count,
.inv-row[data-pulse="received"] .inv-count {
  animation: feedback-count-pos 500ms ease-out;
}
.inv-row[data-pulse="dec"] .inv-count {
  animation: feedback-count-neg 500ms ease-out;
}
@keyframes feedback-count-pos {
  0%   { transform: scale(1); }
  20%  { color: #fff; text-shadow: 0 0 10px var(--accent); transform: scale(1.18); }
  100% { transform: scale(1); }
}
@keyframes feedback-count-neg {
  0%   { transform: scale(1); }
  20%  { color: var(--warn); transform: scale(0.88); }
  100% { transform: scale(1); }
}

/* Floating delta */
.inv-row[data-pulse="inc"] .inv-delta,
.inv-row[data-pulse="add"] .inv-delta,
.inv-row[data-pulse="received"] .inv-delta {
  animation: feedback-float 800ms ease-out;
  color: var(--accent);
}
.inv-row[data-pulse="dec"] .inv-delta {
  animation: feedback-float 800ms ease-out;
  color: var(--warn);
}
@keyframes feedback-float {
  0%   { opacity: 0; transform: translateY(0); }
  20%  { opacity: 1; }
  100% { opacity: 0; transform: translateY(-18px); }
}

/* Received (louder) */
.inv-row[data-pulse="received"] {
  animation: feedback-glow-louder 1500ms ease-out;
}
.inv-row[data-pulse="received"] .inv-name {
  animation: feedback-name-flash 1500ms ease-out;
}
@keyframes feedback-glow-louder {
  0%   { box-shadow: none; }
  15%  { box-shadow: 0 0 0 2px var(--accent), 0 0 20px rgba(124,77,255,0.7); }
  35%  { box-shadow: 0 0 0 1px rgba(124,77,255,0.3), 0 0 8px rgba(124,77,255,0.2); }
  55%  { box-shadow: 0 0 0 2px var(--accent), 0 0 16px rgba(124,77,255,0.55); }
  100% { box-shadow: none; }
}
@keyframes feedback-name-flash {
  0%   { color: inherit; }
  15%  { color: #fff; text-shadow: 0 0 6px rgba(124,77,255,0.5); }
  100% { color: inherit; }
}

/* Add: layer collapse-in onto the standard glow */
.inv-row[data-pulse="add"] {
  animation:
    feedback-glow 700ms ease-out,
    feedback-row-enter 350ms ease-out;
}
@keyframes feedback-row-enter {
  0%   {
    max-height: 0; opacity: 0;
    padding-top: 0; padding-bottom: 0;
    margin-top: 0; margin-bottom: 0;
    transform: translateY(-4px);
  }
  100% {
    max-height: 60px; opacity: 1;
    transform: translateY(0);
  }
}

/* Remove: pulse-then-collapse, hold final state */
.inv-row[data-pulse="remove"] {
  animation: feedback-row-leave 400ms ease-in forwards;
  overflow: hidden;
}
@keyframes feedback-row-leave {
  0% {
    max-height: 60px; opacity: 1;
    box-shadow: 0 0 0 2px var(--warn), 0 0 14px rgba(252,211,77,0.3);
  }
  25% {
    max-height: 60px; opacity: 1;
  }
  100% {
    max-height: 0; opacity: 0;
    padding-top: 0; padding-bottom: 0;
    margin-top: 0; margin-bottom: 0;
    box-shadow: none;
  }
}

/* Reduced motion: drop transforms, keep informational color */
@media (prefers-reduced-motion: reduce) {
  .inv-row[data-pulse] { animation-duration: 0ms !important; }
  .inv-row[data-pulse="received"] {
    animation: feedback-glow-louder 800ms ease-out !important;
  }
  .inv-row[data-pulse="received"] .inv-name { animation: none !important; }
  .inv-row[data-pulse="inc"] .inv-count,
  .inv-row[data-pulse="add"] .inv-count,
  .inv-row[data-pulse="received"] .inv-count {
    animation: feedback-color-pos 350ms ease-out !important;
  }
  .inv-row[data-pulse="dec"] .inv-count {
    animation: feedback-color-neg 350ms ease-out !important;
  }
  .inv-delta { display: none !important; }
}
@keyframes feedback-color-pos {
  0%   { color: inherit; }
  20%  { color: var(--accent); }
  100% { color: inherit; }
}
@keyframes feedback-color-neg {
  0%   { color: inherit; }
  20%  { color: var(--warn); }
  100% { color: inherit; }
}
`;
```

- [ ] **Step 2: Inject in main.ts**

In `src/main.ts`, change the imports:

```ts
import { LIST_CSS } from "./styles-list";
import { DIALOG_CSS } from "./styles-dialog";
```

to:

```ts
import { LIST_CSS } from "./styles-list";
import { DIALOG_CSS } from "./styles-dialog";
import { FEEDBACK_CSS } from "./styles-feedback";
```

And the inject calls:

```ts
injectStyles(LIST_CSS, "obr-inv-list-styles");
injectStyles(DIALOG_CSS, "obr-inv-dialog-styles");
```

to:

```ts
injectStyles(LIST_CSS, "obr-inv-list-styles");
injectStyles(DIALOG_CSS, "obr-inv-dialog-styles");
injectStyles(FEEDBACK_CSS, "obr-inv-feedback-styles");
```

- [ ] **Step 3: Verify typecheck + tests still green**

```
npx tsc --noEmit
npm test
```
Expected: PASS.

- [ ] **Step 4: Commit**

```
git add src/styles-feedback.ts src/main.ts
git commit -m "feat(styles): add feedback animation styles"
```

---

## Task 4: Make `.inv-count` `position: relative`

**Files:**
- Modify: `src/styles-list.ts:63`

- [ ] **Step 1: Edit the rule**

In `src/styles-list.ts`, change:

```css
.inv-count { font-variant-numeric: tabular-nums; min-width: 26px; text-align: right; color: var(--text-dim); }
```

to:

```css
.inv-count { font-variant-numeric: tabular-nums; min-width: 26px; text-align: right; color: var(--text-dim); position: relative; }
```

- [ ] **Step 2: Verify tests**

```
npm test
```
Expected: PASS.

- [ ] **Step 3: Commit**

```
git add src/styles-list.ts
git commit -m "feat(styles): position .inv-count relative for delta indicator"
```

---

## Task 5: Write DOM integration tests (failing)

**Files:**
- Create: `test/ui-feedback-dom.test.ts`

- [ ] **Step 1: Write the test file**

Create `test/ui-feedback-dom.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import { mountShell } from "../src/ui-shell";
import type { CatalogItem, PlayerInventoryRecord } from "../src/types";

const catalog: CatalogItem[] = [
  { id: "h1", name: "Healing Potion", category: "Consumables",
    icon: "u", description: "d", rarity: "uncommon" },
  { id: "a1", name: "+1 Arrows", category: "Weapons",
    icon: "u", description: "Sharp.", rarity: "rare" },
  { id: "x1", name: "Shield", category: "Armor",
    icon: "u", description: "Block.", rarity: "common" },
];

function rec(items: Array<[string, number]>): PlayerInventoryRecord {
  return {
    name: "Alice", color: "#fff",
    items,
    currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
  };
}

function noop(): void {}
function makeHandlers() {
  return {
    onIncrement: async () => {},
    onDecrement: async () => {},
    onRemove: async () => {},
    onCurrencyChange: async () => {},
    onAddClick: noop,
    onDescription: noop,
    onTransfer: noop,
  };
}

function unlock(root: HTMLElement) {
  const lock = root.querySelector(".lock-toggle") as HTMLButtonElement;
  lock.click();
}

function rowFor(root: HTMLElement, id: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`.inv-row[data-item-id="${id}"]`);
}

describe("ui-feedback DOM integration", () => {
  beforeEach(() => {
    __testHooks.reset();
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("emits data-pulse=inc and a +1 delta when count increases", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const refs = mountShell(root, rec([["h1", 3]]), catalog, makeHandlers());

    refs.rerender(rec([["h1", 4]]), catalog);

    const row = rowFor(root, "h1");
    expect(row?.dataset.pulse).toBe("inc");
    expect(row?.querySelector(".inv-delta")?.textContent).toBe("+1");
  });

  it("emits data-pulse=dec and a -1 delta when count decreases", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const refs = mountShell(root, rec([["h1", 3]]), catalog, makeHandlers());

    refs.rerender(rec([["h1", 2]]), catalog);

    const row = rowFor(root, "h1");
    expect(row?.dataset.pulse).toBe("dec");
    expect(row?.querySelector(".inv-delta")?.textContent).toBe("−1");
  });

  it("emits data-pulse=add for newly appearing items", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const refs = mountShell(root, rec([["h1", 1]]), catalog, makeHandlers());

    refs.rerender(rec([["h1", 1], ["x1", 2]]), catalog);

    const row = rowFor(root, "x1");
    expect(row?.dataset.pulse).toBe("add");
    expect(row?.querySelector(".inv-delta")?.textContent).toBe("+2");
  });

  it("renders a phantom row with data-pulse=remove for one render after removal", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const refs = mountShell(root, rec([["h1", 2], ["a1", 1]]), catalog, makeHandlers());

    // First rerender: h1 is gone — phantom row should appear with data-pulse=remove.
    refs.rerender(rec([["a1", 1]]), catalog);
    let row = rowFor(root, "h1");
    expect(row).not.toBeNull();
    expect(row?.dataset.pulse).toBe("remove");

    // Second rerender (no further changes): phantom is gone.
    refs.rerender(rec([["a1", 1]]), catalog);
    row = rowFor(root, "h1");
    expect(row).toBeNull();
  });

  it("markReceived overrides a concurrent inc with received", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const refs = mountShell(root, rec([["h1", 3]]), catalog, makeHandlers());

    refs.markReceived("h1", 2);
    refs.rerender(rec([["h1", 5]]), catalog);

    const row = rowFor(root, "h1");
    expect(row?.dataset.pulse).toBe("received");
    expect(row?.querySelector(".inv-delta")?.textContent).toBe("+2");
  });

  it("auto-expands a collapsed category for received pulses", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const refs = mountShell(root, rec([["h1", 3]]), catalog, makeHandlers());

    // Collapse the Consumables category.
    const header = root.querySelector(
      '.cat-header[data-category="Consumables"]',
    ) as HTMLElement;
    header.click();
    expect(
      root.querySelector('.cat-group[data-category="Consumables"]')
        ?.getAttribute("data-collapsed"),
    ).toBe("true");

    refs.markReceived("h1", 1);
    refs.rerender(rec([["h1", 4]]), catalog);

    expect(
      root.querySelector('.cat-group[data-category="Consumables"]')
        ?.getAttribute("data-collapsed"),
    ).toBe("false");
  });

  it("clears data-pulse after the duration window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0));
    const root = document.createElement("div");
    document.body.appendChild(root);
    const refs = mountShell(root, rec([["h1", 3]]), catalog, makeHandlers());

    refs.rerender(rec([["h1", 4]]), catalog);
    expect(rowFor(root, "h1")?.dataset.pulse).toBe("inc");

    vi.advanceTimersByTime(701);
    refs.rerender(rec([["h1", 4]]), catalog);
    expect(rowFor(root, "h1")?.dataset.pulse).toBeUndefined();

    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run the test file — confirm failure**

```
npm test -- test/ui-feedback-dom.test.ts
```
Expected: FAIL — `markReceived` not defined on `ShellRefs`, no `data-pulse` on rows.

- [ ] **Step 3: Don't commit yet** — these tests pass after Tasks 6 & 7. Leave them in working tree.

---

## Task 6: Wire tracker through `ui-list.ts` and `ui-shell.ts`

This is one task because the changes are tightly coupled — `ListState` in `ui-list.ts` grows two new fields (`tracker`, `phantomRemoves`), and `ui-shell.ts` is the only caller that constructs them.

**Files:**
- Modify: `src/ui-list.ts` — entire file
- Modify: `src/ui-shell.ts:5-18, 105-152, 184-188`

- [ ] **Step 1: Update `src/ui-list.ts`**

Replace the file contents with:

```ts
import type { CatalogItem, InventoryEntry, Rarity } from "./types";
import type { PulseTracker, PulseEntry } from "./ui-feedback";

export interface RowHandlers {
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onDescription: (id: string, anchor: { x: number; y: number }) => void;
  onTransfer: (id: string, anchor: { x: number; y: number }) => void;
}

export interface ListState {
  items: InventoryEntry[];
  catalog: CatalogItem[];
  search: string;
  unlocked: boolean;
  collapsed: Set<string>;
  ghosts: Set<string>;
  tracker: PulseTracker;
  phantomRemoves: Set<string>;
}

export function renderList(
  container: HTMLElement, state: ListState, handlers: RowHandlers,
): void {
  container.innerHTML = "";
  const byId = new Map(state.catalog.map((c) => [c.id, c]));
  const search = state.search.trim().toLowerCase();

  // Build the working list: real items + synthetic [id,0] entries for phantom removes.
  const working: InventoryEntry[] = [...state.items];
  const realIds = new Set(state.items.map((e) => e[0]));
  for (const id of state.phantomRemoves) {
    if (!realIds.has(id)) working.push([id, 0]);
  }

  const byCat = new Map<string, Array<{ entry: InventoryEntry; item: CatalogItem | null }>>();
  for (const entry of working) {
    const item = byId.get(entry[0]) ?? null;
    const isPhantom = state.phantomRemoves.has(entry[0]);
    if (entry[1] === 0 && !state.ghosts.has(entry[0]) && !isPhantom) continue;
    if (search && !rowMatches(entry, item, search)) continue;
    const cat = item?.category ?? "Unknown";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push({ entry, item });
  }

  if (byCat.size === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = search ? `No items match "${state.search}"` : "Inventory is empty";
    container.appendChild(empty);
    return;
  }

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  const receivedRows: HTMLElement[] = [];

  for (const [cat, entries] of byCat.entries()) {
    const collapsed = state.collapsed.has(cat);

    const group = document.createElement("div");
    group.className = "cat-group";
    group.dataset.category = cat;
    group.dataset.collapsed = collapsed ? "true" : "false";

    const header = document.createElement("div");
    header.className = "cat-header";
    header.dataset.category = cat;
    header.innerHTML = `<span><span class="chev">▾</span> ${escape(cat)}</span><span>(${entries.length})</span>`;
    group.appendChild(header);

    const bodyEl = document.createElement("div");
    bodyEl.className = "cat-body";
    const inner = document.createElement("div");
    inner.className = "cat-body-inner";
    for (const { entry, item } of entries) {
      const row = renderRow(entry, item, state.unlocked, search, handlers, state.tracker);
      if (row.dataset.pulse === "received") receivedRows.push(row);
      inner.appendChild(row);
    }
    bodyEl.appendChild(inner);
    group.appendChild(bodyEl);

    container.appendChild(group);
  }

  // Side effect for received: scroll into view (after DOM attach).
  for (const row of receivedRows) {
    row.scrollIntoView({
      block: "center",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }
}

function rowMatches(
  entry: InventoryEntry, item: CatalogItem | null, search: string,
): boolean {
  const name = item?.name ?? entry[0];
  return name.toLowerCase().includes(search);
}

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${Math.abs(delta)}`;
  return "";
}

function renderRow(
  entry: InventoryEntry, item: CatalogItem | null, unlocked: boolean,
  search: string, h: RowHandlers, tracker: PulseTracker,
): HTMLElement {
  const [id, count] = entry;
  const row = document.createElement("div");
  row.className = "inv-row";
  if (item?.rarity) row.dataset.rarity = item.rarity as Rarity;
  row.dataset.itemId = id;

  const icon = document.createElement("div");
  icon.className = "inv-icon";
  if (item?.icon) icon.style.backgroundImage = `url("${item.icon}")`;
  else icon.textContent = "❓";
  row.appendChild(icon);

  const name = document.createElement("div");
  name.className = "inv-name";
  name.innerHTML = item ? highlight(item.name, search) : escape(`[${id}] (missing from catalog)`);
  row.appendChild(name);

  const cnt = document.createElement("div");
  cnt.className = "inv-count";
  cnt.textContent = `×${count}`;
  const delta = document.createElement("span");
  delta.className = "inv-delta";
  cnt.appendChild(delta);
  row.appendChild(cnt);

  const pulse: PulseEntry | null = tracker.consume(id);
  if (pulse) {
    row.dataset.pulse = pulse.kind;
    if (pulse.delta != null) delta.textContent = formatDelta(pulse.delta);
  }

  if (unlocked) {
    const dec = document.createElement("button");
    dec.className = "btn-step"; dec.textContent = "−"; dec.title = "Decrease";
    dec.dataset.action = "dec";
    dec.onclick = () => h.onDecrement(id);
    row.appendChild(dec);

    const inc = document.createElement("button");
    inc.className = "btn-step"; inc.textContent = "+"; inc.title = "Increase";
    inc.dataset.action = "inc";
    inc.onclick = () => h.onIncrement(id);
    row.appendChild(inc);

    const rm = document.createElement("button");
    rm.className = "btn-x"; rm.textContent = "✕"; rm.title = "Remove";
    rm.dataset.action = "remove";
    rm.onclick = () => h.onRemove(id);
    row.appendChild(rm);
  }

  // Right-click and shift+right-click open description / transfer.
  // Bound to the whole row so the entire visual element is hit-testable;
  // exempt the ± / × buttons so right-clicking those does nothing surprising.
  row.addEventListener("contextmenu", (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest(".btn-step, .btn-x")) return;
    ev.preventDefault();
    const me = ev as MouseEvent;
    if (me.shiftKey) h.onTransfer(id, { x: me.clientX, y: me.clientY });
    else h.onDescription(id, { x: me.clientX, y: me.clientY });
  });

  return row;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

function highlight(text: string, search: string): string {
  if (!search) return escape(text);
  const lower = text.toLowerCase();
  const idx = lower.indexOf(search);
  if (idx < 0) return escape(text);
  return escape(text.slice(0, idx))
    + `<mark>${escape(text.slice(idx, idx + search.length))}</mark>`
    + escape(text.slice(idx + search.length));
}
```

- [ ] **Step 2: Update `src/ui-shell.ts`**

Replace the file with:

```ts
import { renderList, type ListState, type RowHandlers } from "./ui-list";
import { totalWeight } from "./inventory";
import { createPulseTracker, type PulseTracker } from "./ui-feedback";
import type { CatalogItem, PlayerInventoryRecord } from "./types";

export interface ShellHandlers extends Omit<RowHandlers, "onIncrement" | "onDecrement" | "onRemove"> {
  onIncrement: (id: string) => Promise<void>;
  onDecrement: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onCurrencyChange: (
    field: "pp" | "gp" | "sp" | "cp", value: number,
  ) => Promise<void>;
  onAddClick: () => void;
}

export interface ShellRefs {
  rerender: (record: PlayerInventoryRecord, catalog: CatalogItem[]) => void;
  markReceived: (itemId: string, quantity: number) => void;
  destroy: () => void;
}

export function mountShell(
  root: HTMLElement,
  initialRecord: PlayerInventoryRecord,
  catalog: CatalogItem[],
  handlers: ShellHandlers,
): ShellRefs {
  root.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "shell";

  const header = document.createElement("div");
  header.className = "shell-header";
  const search = document.createElement("input");
  search.className = "shell-search";
  search.placeholder = "Search inventory...";
  header.appendChild(search);
  const lockBtn = document.createElement("button");
  lockBtn.className = "lock-toggle";
  lockBtn.textContent = "🔒";
  lockBtn.title = "Click to unlock editing";
  header.appendChild(lockBtn);
  wrap.appendChild(header);

  const body = document.createElement("div");
  body.className = "shell-body";
  wrap.appendChild(body);

  const footer = document.createElement("div");
  footer.className = "shell-footer";
  const weightEl = document.createElement("span");
  weightEl.textContent = "⚖ 0 lb";
  footer.appendChild(weightEl);
  const addBtn = document.createElement("button");
  addBtn.className = "btn-add";
  addBtn.textContent = "+ Add to inventory";
  addBtn.onclick = handlers.onAddClick;
  footer.appendChild(addBtn);
  wrap.appendChild(footer);

  const gold = document.createElement("div");
  gold.className = "gold-strip";
  const ccyInputs: Record<string, HTMLInputElement> = {} as any;
  const tip = "Type a number to set, +N to add, -N to subtract";
  for (const f of ["pp", "gp", "sp", "cp"] as const) {
    const cell = document.createElement("div");
    cell.className = "gold-cell";
    cell.dataset.ccy = f;
    cell.title = tip;
    const lbl = document.createElement("label");
    lbl.textContent = f;
    cell.appendChild(lbl);
    const inp = document.createElement("input");
    inp.type = "text";
    inp.inputMode = "numeric";
    inp.value = "0";
    inp.title = tip;
    const currentValue = () => currentRecord.currency[f] ?? 0;
    const commit = () => {
      const parsed = parseCurrencyInput(inp.value, currentValue());
      if (parsed === null) {
        inp.value = String(currentValue());
        return;
      }
      const clamped = Math.max(0, Math.floor(parsed));
      inp.value = String(clamped);
      void handlers.onCurrencyChange(f, clamped);
    };
    inp.onchange = commit;
    inp.onfocus = () => inp.select();
    inp.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
        inp.blur();
      } else if (e.key === "Escape") {
        inp.value = String(currentValue());
        inp.blur();
      }
    };
    cell.appendChild(inp);
    gold.appendChild(cell);
    ccyInputs[f] = inp;
  }
  wrap.appendChild(gold);

  root.appendChild(wrap);

  let unlocked = false;
  const collapsed = new Set<string>();
  const ghosts = new Set<string>();
  const tracker: PulseTracker = createPulseTracker();
  let prevRecord: PlayerInventoryRecord | null = null;
  let currentRecord = initialRecord;
  let currentCatalog = catalog;

  const updateLockUI = () => {
    lockBtn.textContent = unlocked ? "🔓" : "🔒";
    lockBtn.classList.toggle("unlocked", unlocked);
    lockBtn.title = unlocked ? "Click to lock editing" : "Click to unlock editing";
  };

  const rerender = (record: PlayerInventoryRecord, cat: CatalogItem[]) => {
    currentRecord = record;
    currentCatalog = cat;
    for (const f of ["pp","gp","sp","cp"] as const) {
      if (document.activeElement !== ccyInputs[f]) {
        ccyInputs[f].value = String(record.currency[f] ?? 0);
      }
    }
    weightEl.textContent = `⚖ ${formatWeight(totalWeight(record.items, cat))} lb`;

    // Diff vs. previous record (if any) and stamp pulses.
    const marks = tracker.diff(prevRecord, record);

    // Auto-expand any collapsed category that contains a `received` mark.
    if (marks.size > 0) {
      const byId = new Map(cat.map((c) => [c.id, c]));
      for (const [id, m] of marks) {
        if (m.kind === "received") {
          const category = byId.get(id)?.category ?? "Unknown";
          collapsed.delete(category);
        }
      }
    }

    // Ids removed this render get one frame as phantom rows.
    const phantomRemoves = new Set<string>();
    for (const [id, m] of marks) {
      if (m.kind === "remove") phantomRemoves.add(id);
    }

    tracker.mark(marks);
    prevRecord = record;

    const state: ListState = {
      items: record.items,
      catalog: cat,
      search: search.value,
      unlocked,
      collapsed,
      ghosts,
      tracker,
      phantomRemoves,
    };
    renderList(body, state, {
      onIncrement: (id) => {
        ghosts.add(id);
        void handlers.onIncrement(id);
      },
      onDecrement: (id) => {
        ghosts.add(id);
        void handlers.onDecrement(id);
      },
      onRemove: (id) => {
        ghosts.delete(id);
        void handlers.onRemove(id);
      },
      onDescription: handlers.onDescription,
      onTransfer: handlers.onTransfer,
    });
  };

  search.addEventListener("input", () => rerender(currentRecord, currentCatalog));
  search.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      search.value = "";
      rerender(currentRecord, currentCatalog);
    }
  });
  body.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const headerEl = t.closest<HTMLElement>(".cat-header");
    if (!headerEl) return;
    const cat = headerEl.dataset.category;
    if (!cat) return;
    const willCollapse = !collapsed.has(cat);
    if (willCollapse) collapsed.add(cat); else collapsed.delete(cat);
    // Toggle data-collapsed on the persistent .cat-group element so the
    // CSS grid-rows transition animates. A full rerender would replace
    // the DOM and skip the transition.
    const group = headerEl.closest<HTMLElement>(".cat-group");
    if (group) group.dataset.collapsed = willCollapse ? "true" : "false";
  });
  lockBtn.onclick = () => {
    unlocked = !unlocked;
    updateLockUI();
    rerender(currentRecord, currentCatalog);
  };

  updateLockUI();
  rerender(initialRecord, catalog);

  return {
    rerender,
    markReceived: (itemId, quantity) => {
      tracker.mark(new Map([[itemId, { kind: "received", delta: quantity }]]));
    },
    destroy: () => { root.innerHTML = ""; },
  };
}

function formatWeight(w: number): string {
  if (w === 0) return "0";
  if (Number.isInteger(w)) return String(w);
  return w.toFixed(1);
}

/**
 * Parse a currency input value:
 * - "123"   → set to 123
 * - "+45"   → current + 45
 * - "-20"   → current - 20  (caller clamps at 0)
 * - "" or junk → null (caller reverts)
 */
export function parseCurrencyInput(raw: string, current: number): number | null {
  const t = raw.trim();
  const m = /^([+-]?)(\d+)$/.exec(t);
  if (!m) return null;
  const n = parseInt(m[2], 10);
  if (m[1] === "+") return current + n;
  if (m[1] === "-") return current - n;
  return n;
}
```

- [ ] **Step 3: Run typecheck**

```
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 4: Run the DOM integration tests + full suite**

```
npm test
```
Expected: PASS — all tracker tests, all integration tests, and all pre-existing tests green.

If a pre-existing test fails because the initial-mount diff stamps pulses on every item: that should NOT happen because `tracker.diff(null, ...)` returns empty. If it does fail, debug; do not skip.

- [ ] **Step 5: Commit (Tasks 5 + 6 together)**

```
git add test/ui-feedback-dom.test.ts src/ui-list.ts src/ui-shell.ts
git commit -m "feat(ui): wire PulseTracker through list and shell rendering"
```

---

## Task 7: Mark received transfers in the player view

**Files:**
- Modify: `src/ui-player.ts:30, 101-111`

- [ ] **Step 1: Capture the shell ref and call markReceived**

In `src/ui-player.ts`, change:

```ts
const refs = mountShell(opts.root, current, opts.catalog, {
```

— it already captures `refs`, no rename needed.

In the broadcast handler block, change:

```ts
const unsubBroadcast = OBR.broadcast.onMessage(
  BROADCAST_CHANNEL, (ev) => {
    const msg = ev.data as BroadcastMessage;
    if (msg.type === "transfer-received" && msg.toPlayerId === opts.playerId) {
      OBR.notification?.show?.(
        `${msg.fromName} gave you ${msg.quantity}× ${msg.itemName}`,
        "INFO",
      )?.catch?.(() => console.warn("notification.show unavailable"));
    }
  },
);
```

to:

```ts
const unsubBroadcast = OBR.broadcast.onMessage(
  BROADCAST_CHANNEL, (ev) => {
    const msg = ev.data as BroadcastMessage;
    if (msg.type === "transfer-received" && msg.toPlayerId === opts.playerId) {
      refs.markReceived(msg.itemId, msg.quantity);
      // The metadata change that follows will diff to "inc"; precedence keeps "received".
      // Kick a render in case the broadcast outpaces the metadata event.
      refs.rerender(current, opts.catalog);
      OBR.notification?.show?.(
        `${msg.fromName} gave you ${msg.quantity}× ${msg.itemName}`,
        "INFO",
      )?.catch?.(() => console.warn("notification.show unavailable"));
    }
  },
);
```

- [ ] **Step 2: Run typecheck + full tests**

```
npx tsc --noEmit
npm test
```
Expected: PASS.

- [ ] **Step 3: Commit**

```
git add src/ui-player.ts
git commit -m "feat(ui-player): pulse transfer-received with the louder treatment"
```

---

## Task 8: Manual verification

**Files:** none (verification only).

- [ ] **Step 1: Build cleanly**

```
npm run build
```
Expected: PASS. Note that `npm run build` runs `tsc && vite build`.

- [ ] **Step 2: Walk the manual checklist (from §7.3 of the spec)**

The dev server is presumably already running on http://localhost:5173/. Open it in OBR's extension iframe (the project README explains how if the user hasn't done it yet) and:

1. Player view: tap +/− on a row. Confirm: count brightens + scales, `+1`/`−1` floats up, row glows.
2. Player view: tap × on a row with count > 0. Confirm: amber pulse, row collapses, then it's gone.
3. Player view: open Add dialog, add a new item. Confirm: row collapses in with glow.
4. Open a second OBR client as another player. Have player A transfer to B. On B's view confirm: louder glow, name flash, row scrolls into view, collapsed category auto-expands.
5. GM view: switch tabs. Edit on the active tab. Confirm: standard pulses fire.
6. Toggle OS reduced motion. Repeat #1. Confirm: color shift only, no scale or float; delta hidden.
7. Mash + button 5× quickly. Confirm: animation restarts cleanly, no pile-up.
8. Type a search filter that excludes the pulsing row. Confirm: no console errors.

- [ ] **Step 3: Stop here. No further commits unless verification reveals a defect.**

---

## Self-review notes (already applied)

- Spec coverage: every section of the spec maps to a task. §4.1 → Task 2; §4.2 → Task 3; §4.3 → Task 6 (ui-list); §4.4 → Task 6 (ui-shell); §4.5 → Task 7; §4.6 verified by running existing tests in Task 6; §4.7 → Task 3; §4.8 → Task 1; §6 (CSS) → Task 3; §7 (testing) → Tasks 2, 5; §7.3 (manual) → Task 8.
- Type consistency: `PulseTracker`, `PulseEntry`, `PulseMark`, `PulseKind`, `markReceived(itemId, quantity)` are used consistently across tasks 2, 5, 6, 7.
- No placeholders. Every code step shows the full text that ends up in the file (replacement-style edits show both before and after).

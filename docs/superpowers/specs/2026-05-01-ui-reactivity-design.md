# UI Reactivity — Feature Spec

**Status:** Draft, pending implementation
**Date:** 2026-05-01
**Author:** Adam (with Claude)
**Builds on:** [`2026-05-01-obr-inventory-design.md`](2026-05-01-obr-inventory-design.md)

## 1. Purpose

Add visual feedback to inventory state changes so users perceive what just happened — the row that changed, the kind of change, and the magnitude — without having to track which number ticked up or down. The highest-value case is **transfer-received**: a state change the user did not initiate, on a row that may not be on screen.

## 2. Goals and non-goals

### Goals

- Increment, decrement, add, remove, transfer-out, and transfer-in each produce a visible reaction on the affected row.
- The standard treatment is the same across actions, with positive (`inc` / `add`) using the accent color and negative (`dec`) using the warn color.
- Transfer-received uses a distinct, louder treatment because the user did not initiate the change.
- The same module serves both the player view and the GM view.
- Honor `prefers-reduced-motion` — feedback remains informative without transforms or float-ups.
- No regressions in existing rendering: search, ghosts, category collapse, lock toggle, currency strip.

### Non-goals

- Currency-change feedback (the feature isn't transferred between players yet — revisit when currency transfer ships).
- Optimistic UI: pulses still fire on the round-trip from OBR metadata, not on click. Matches the existing data flow; revisit only if perceived latency complaints arise.
- Source attribution beyond "is this a received transfer or not." We do not differentiate "GM did this to my tab" from "I did this myself" — both fire the standard pulse.
- Animating the count number itself counting up/down (e.g., 3 → 4 tween). The text snaps; the visual treatment around it is what signals the change.
- Sound.

## 3. Decisions

| Topic | Decision |
|---|---|
| Visual language (standard) | Count pulse (brighten + scale 1.18×) + floating delta ("+1" / "−1" up 18px) + row glow ring (~700ms). Composes the "B+C full strength" treatment from brainstorming. |
| Visual language (received) | Extended row glow with a soft secondary beat (~1500ms), `.inv-name` flash, plus standard count pulse and floating delta. Scrolls into view. Auto-expands a collapsed category. |
| Add row | Standard glow + `feedback-row-enter` (max-height/opacity/translateY) over 350ms. |
| Remove row | `feedback-row-leave` over 400ms — amber glow first, then collapse — with `forwards` so the row stays at opacity:0 until the next render drops it. |
| Color tokens | Reuse existing CSS vars: `--accent` for positive, `--warn` for negative. No new tokens. `--bad` is left to the existing remove-button hover. |
| Architecture | State-tracked pulse map (`PulseTracker`) with diff at metadata-event time and `data-pulse` attribute on rows at render time. No refactor of `renderList` to keyed/diff rendering. |
| Transfer-in detection | Existing `transfer-received` broadcast already arrives in `ui-player.ts`. The GM view sees received transfers as standard pulses on its active tab — the louder treatment applies only on the player view. |
| Precedence | `received > inc > add > dec > remove`. Lower-priority marks against an existing higher-priority entry are ignored. Same-priority re-marks refresh the timestamp. |
| Eviction | Time-based, not consume-based. `consume(id)` returns `null` and evicts when `now - startedAt >= duration[kind]`. Two consumes within the window both return the kind — needed because category collapse triggers an extra render. |
| Reduced motion | One `@media (prefers-reduced-motion: reduce)` block: drop transforms, hide `.inv-delta`, halve durations, replace smooth scroll with auto. Glow stays. |

## 4. Components

### 4.1 New module: `src/ui-feedback.ts`

The only place that knows about pulse kinds, durations, or precedence. Pure logic — no DOM, no I/O. Injectable clock for testing.

```ts
export type PulseKind = "inc" | "dec" | "add" | "remove" | "received";

export interface PulseEntry {
  kind: PulseKind;
  delta?: number;       // +1, -1, +5; absent for "remove"
  startedAt: number;    // ms epoch
}

export interface PulseTracker {
  /** Diff prev vs next records. Returns a map of id → entry (no timestamp yet). */
  diff(
    prev: PlayerInventoryRecord | null,
    next: PlayerInventoryRecord,
  ): Map<string, Omit<PulseEntry, "startedAt">>;

  /** Apply marks. Respects precedence; stamps timestamps via injected `now()`. */
  mark(marks: Map<string, Omit<PulseEntry, "startedAt">>): void;

  /** Returns the current pulse for an id, or null if expired/absent. Auto-evicts expired entries. */
  consume(id: string): PulseEntry | null;
}

export function createPulseTracker(now?: () => number): PulseTracker;
```

Constants:

```ts
const DURATIONS: Record<PulseKind, number> = {
  inc: 700, dec: 700, add: 700,
  remove: 400,
  received: 1500,
};

const PRIORITY: Record<PulseKind, number> = {
  remove: 1, dec: 2, add: 3, inc: 3, received: 4,
};
```

### 4.2 New module: `src/styles-feedback.ts`

Exports `FEEDBACK_CSS`. Injected once from `main.ts` as `obr-inv-feedback-styles`. Contains all keyframes, the `[data-pulse]` selectors, and the reduced-motion branch. No JS.

### 4.3 Changes to `src/ui-list.ts`

- Receive a `PulseTracker` in `RowHandlers` (or as a sibling param to `state`).
- In `renderRow`, after building the row, call `tracker.consume(id)`. If non-null:
  - Set `row.dataset.pulse = entry.kind`.
  - If `entry.delta != null`, render `<span class="inv-delta">±N</span>` inside `.inv-count`. Otherwise `<span class="inv-delta"></span>` (CSS hides empty).
- The `.inv-count` element gets `position: relative` (in `styles-list.ts`) so `.inv-delta` can absolute-position relative to it.
- For `received` entries: after the row is appended to its category body, queue (a) auto-expand if its `.cat-group[data-collapsed="true"]`, and (b) `row.scrollIntoView({ block: "center", behavior: motionAllowed ? "smooth" : "auto" })`. The "motionAllowed" check uses `window.matchMedia("(prefers-reduced-motion: reduce)").matches`.

### 4.4 Changes to `src/ui-shell.ts`

- Construct one `PulseTracker` per shell instance. The shell already tracks transient state (search, lock, collapsed, ghosts) — the tracker fits the same lifecycle. Destroyed when the shell is destroyed (GM tab switch).
- Hold `prevRecord: PlayerInventoryRecord | null = null`.
- In `rerender(record, cat)`: compute `marks = tracker.diff(prevRecord, record)`, call `tracker.mark(marks)`, then update `prevRecord = record`, then call `renderList`.
- For removes specifically: when `marks` contains a `remove` entry for id X, also add X to the `ghosts` set for this single render — so `renderList` still emits a row with `data-pulse="remove"`. After the render, remove X from `ghosts` again so the next rerender doesn't keep it. (The existing ghost logic was added for decrement→0 stickiness; this extends it to "carry one render past disappearance.")

### 4.5 Changes to `src/ui-player.ts`

- Add a broadcast handler branch: when `msg.type === "transfer-received"` and `msg.toPlayerId === opts.playerId`:
  ```ts
  shellTracker.mark(new Map([[msg.itemId, { kind: "received", delta: msg.quantity }]]));
  // The metadata change that follows will diff to "inc"; precedence keeps "received".
  refs.rerender(current, opts.catalog);  // optional kick, in case metadata is slow
  ```
  Where `shellTracker` is exposed by the shell (small new ref on `ShellRefs`).
- The existing `OBR.notification.show(...)` toast stays — the in-row pulse complements it for users who have the panel visible.

### 4.6 Changes to `src/ui-gm.ts`

- No special handling. Standard pulses apply via the diff path. The GM doesn't get player-targeted broadcasts, and the louder treatment is conceptually wrong for an observer view.

### 4.7 Changes to `src/main.ts`

- One additional `injectStyles(FEEDBACK_CSS, "obr-inv-feedback-styles")` after the existing list/dialog injections.

### 4.8 Changes to `src/types.ts`

- Add `itemId: string` to the `transfer-received` broadcast message variant if not already present (the player handler currently uses `msg.itemName` and `msg.quantity` but no item id — the louder pulse needs the id).

## 5. Data flow

```
[user click + on row id=X]
    │
    ▼
onIncrement(X) → writeRecord(player, incrementItem(current, X))
    │
    ▼ (OBR roundtrip)
onRoomMetadataChange(records)
    │
    ▼
shell.rerender(records[me])
    │
    ├─ marks = tracker.diff(prevRecord, nextRecord)
    │     // → Map { X: { kind: "inc", delta: +1 } }
    ├─ tracker.mark(marks)
    │     // stamps startedAt = now(); applies precedence
    ├─ prevRecord = nextRecord
    └─ renderList(body, state, ...)
            │
            ▼ (per row)
        entry = tracker.consume(X)
        if entry:
            row.dataset.pulse = entry.kind
            renderDelta(row, entry.delta)
            if entry.kind === "received":
                expandCategoryIfCollapsed(row)
                row.scrollIntoView(...)
```

**Precedence example.** Player B receives a transfer of 2× Healing Potion from player A.

1. Broadcast arrives first: `tracker.mark({ h1: { kind: "received", delta: 2 } })`. Map now has `h1 → received(+2)`.
2. ~50ms later, metadata diff runs: `tracker.diff` returns `{ h1: { kind: "inc", delta: 2 } }`. `tracker.mark` sees `received` is already there with higher priority — keeps it. Map still `h1 → received(+2)`.
3. Render fires (twice if the broadcast handler kicks one): row gets `data-pulse="received"`, louder glow + name flash + delta float + scroll-into-view.

If broadcast arrives second instead: step 1 marks `inc`; step 2 marks `received` which has higher priority and overwrites with the new timestamp. Same end state.

## 6. CSS

Single block in `src/styles-feedback.ts`. Sketch:

```css
.inv-count { position: relative; }
.inv-delta {
  position: absolute; right: 0; top: -2px;
  font-size: 11px; font-weight: 700; pointer-events: none;
  opacity: 0;
}
.inv-delta:empty { display: none; }

/* === Standard (inc / dec / add) === */
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

/* count pulse — pos for inc/add/received, neg for dec */
.inv-row[data-pulse="inc"] .inv-count,
.inv-row[data-pulse="add"] .inv-count,
.inv-row[data-pulse="received"] .inv-count { animation: feedback-count-pos 500ms ease-out; }
.inv-row[data-pulse="dec"] .inv-count { animation: feedback-count-neg 500ms ease-out; }

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

/* delta float */
.inv-row[data-pulse="inc"] .inv-delta,
.inv-row[data-pulse="add"] .inv-delta,
.inv-row[data-pulse="received"] .inv-delta { animation: feedback-float 800ms ease-out; color: var(--accent); }
.inv-row[data-pulse="dec"] .inv-delta { animation: feedback-float 800ms ease-out; color: var(--warn); }

@keyframes feedback-float {
  0%   { opacity: 0; transform: translateY(0); }
  20%  { opacity: 1; }
  100% { opacity: 0; transform: translateY(-18px); }
}

/* === Received (louder) === */
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

/* === Add (compose enter motion onto the standard glow) === */
.inv-row[data-pulse="add"] {
  animation:
    feedback-glow 700ms ease-out,
    feedback-row-enter 350ms ease-out;
}
@keyframes feedback-row-enter {
  0%   { max-height: 0; opacity: 0; padding-top: 0; padding-bottom: 0; margin-top: 0; margin-bottom: 0; transform: translateY(-4px); }
  100% { max-height: 60px; opacity: 1; transform: translateY(0); }
}

/* === Remove === */
.inv-row[data-pulse="remove"] {
  animation: feedback-row-leave 400ms ease-in forwards;
  overflow: hidden;
}
@keyframes feedback-row-leave {
  0%   { max-height: 60px; opacity: 1; box-shadow: 0 0 0 2px var(--warn), 0 0 14px rgba(252,211,77,0.3); }
  25%  { max-height: 60px; opacity: 1; }
  100% { max-height: 0; opacity: 0; padding-top: 0; padding-bottom: 0; margin-top: 0; margin-bottom: 0; box-shadow: none; }
}

/* === Reduced motion === */
@media (prefers-reduced-motion: reduce) {
  .inv-row[data-pulse] { animation-duration: 0ms !important; }
  .inv-row[data-pulse="received"] { animation: feedback-glow-louder 800ms ease-out !important; }
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
  0% { color: inherit; } 20% { color: var(--accent); } 100% { color: inherit; }
}
@keyframes feedback-color-neg {
  0% { color: inherit; } 20% { color: var(--warn); } 100% { color: inherit; }
}
```

## 7. Testing

### 7.1 `test/ui-feedback.test.ts` — pure unit

Inject a fake clock; advance manually.

- `diff()`:
  - `prev = null` returns empty map.
  - id added (absent → present, count > 0) → `add` with delta = next count.
  - id removed (present → absent) → `remove`, no delta.
  - id present in both, count up → `inc` with delta = next - prev.
  - id present in both, count down and > 0 → `dec` with delta = next - prev (negative).
  - id present in both, count went to 0 → `remove`.
  - id present in both, count unchanged → not in result.
  - Two ids changing simultaneously appear in the same map.
- `mark()`:
  - Empty tracker + mark `{X: inc}` → consume returns `inc`.
  - Tracker has `{X: received}`; mark `{X: inc}` → consume still returns `received`.
  - Tracker has `{X: inc}`; mark `{X: received}` → consume returns `received`, timestamp is the new one.
  - Tracker has `{X: inc, ts=100}`; clock advances to 200; mark `{X: inc}` → timestamp refreshes to 200.
- `consume()`:
  - Within duration → returns kind.
  - At/past duration → returns null and entry is gone (verify by a follow-up consume).
  - Two consumes within window both return the kind.

### 7.2 `test/ui-feedback-dom.test.ts` — DOM integration

Use `vi.useFakeTimers()`, the existing `__testHooks.reset()` mock pattern, and `mountShell`.

- Mount shell at record A. Trigger `rerender(record_B)` where B has `h1` count incremented by 1. Assert the row for `h1` has `data-pulse="inc"` and `.inv-delta` text is `"+1"`.
- Same for decrement: `data-pulse="dec"`, delta `"−1"`.
- Add: rerender to a record with a new id `x1`. Assert row exists, `data-pulse="add"`, delta = positive count.
- Remove (no ghost): rerender to a record where `h1` is gone. Assert row still rendered with `data-pulse="remove"`. Trigger one more rerender — row is gone.
- Precedence: simulate the player view path — call `tracker.mark({h1: received(+2)})` via the exposed shell ref, then trigger rerender from a metadata change with `h1` count + 2. Assert `data-pulse="received"`.
- Eviction: trigger an `inc` pulse. Advance fake timer past 700ms. Trigger an unrelated rerender. Assert row no longer has `data-pulse`.

### 7.3 Manual verification checklist

Run before merge:

1. Player view: tap +/−, see count pulse, glow, delta float.
2. Player view: tap × on a row, see amber pulse + collapse-out, then row gone.
3. Player view: open Add dialog, add a new item, see row collapse-in with glow.
4. Two-player session: A transfers to B; B sees the louder pulse, name flash, scroll-into-view. If B's category for that item was collapsed, it expands.
5. GM view: switch tabs; perform actions on the active player; standard pulses fire.
6. Toggle OS reduced motion. Repeat #1: no scaling/translate, no float, color pulse only.
7. Mash + button 5× quickly: visual restarts cleanly, no pile-up.
8. Search filter excluding the pulsing row: no console errors, no animation visible (expected).
9. Storage cap modal still triggers correctly under load (no regression).

## 8. Open questions

None blocking. Possible future work:

- Currency-change feedback once currency transfer is a feature.
- Source attribution (e.g., "GM modified this") via a small message bus, if it becomes a usability issue.
- A "history strip" showing the last few changes, if the in-place pulse turns out to be insufficient when many things change at once (mass loot drop).

## 9. Files changed

| File | Change |
|---|---|
| `src/ui-feedback.ts` | New: `PulseTracker` interface, `createPulseTracker`, `PulseKind` type, durations, priority. |
| `src/styles-feedback.ts` | New: `FEEDBACK_CSS` string with all keyframes and reduced-motion branch. |
| `src/ui-list.ts` | Read tracker on row build; set `data-pulse`; render `.inv-delta`; received-only side effects (auto-expand category, scroll into view). |
| `src/ui-shell.ts` | Construct tracker per shell; diff prev/next on rerender; mark before rendering; expose tracker on `ShellRefs` for the player view. |
| `src/ui-player.ts` | On `transfer-received` broadcast, mark the relevant id with `received` kind, then trigger rerender. |
| `src/ui-gm.ts` | No code changes (standard pulses apply via the shell). Verify nothing breaks across tab switches. |
| `src/main.ts` | One extra `injectStyles(FEEDBACK_CSS, ...)` call. |
| `src/types.ts` | Add `itemId: string` to `transfer-received` broadcast variant. |
| `src/styles-list.ts` | Add `position: relative` on `.inv-count` (so `.inv-delta` can absolute-position). |
| `test/ui-feedback.test.ts` | New: pure tracker tests. |
| `test/ui-feedback-dom.test.ts` | New: DOM integration tests. |

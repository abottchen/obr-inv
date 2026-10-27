# Stash View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give players a read-only window onto `npc-` inventory records (the party stash) via a "Stash" button in the player footer.

**Architecture:** A pure helper module picks stash records out of the room's inventory map. The shared shell gains an optional read-only mode plus title/close/stash-button hooks. A new modal module hosts a read-only shell for the selected stash and re-renders on live updates. The player view wires it all up; the GM view is untouched.

**Tech Stack:** Vanilla TypeScript, imperative DOM, CSS-in-JS strings, vitest + jsdom with the mocked OBR SDK at `test/_mocks/obr-sdk.ts`.

**Spec:** `docs/superpowers/specs/2026-10-26-stash-view-design.md`

## Global Constraints

- Work on branch `feat/stash-view` off `main`. One commit per task.
- Every string placed in `innerHTML` goes through `escapeHtml()`; prefer `textContent`.
- Tests import `./_mocks/obr-sdk` before any `src/` module.
- No real player names in code, tests, or commit messages (forbidden-name git hooks). Use "Mr. Stompy", "Alice", "Vex".
- `STASH_ID_PREFIX` is exactly `"npc-"`.
- Stash button label is exactly `Stash`; read-only subtitle is exactly `Read only`.
- Modal size: `width: min(500px, calc(100vw - 24px)); height: min(660px, calc(100vh - 24px))`.
- `.popover` z-index becomes `70`. No other z-index changes.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. A hand-written stash record missing `items` or `currency` must be ignored, not crash every player's metadata callback. (Task 1 test.)
2. A stash whose items reference ids absent from the catalog must still render, showing the existing missing-from-catalog row. (Task 3 test.)
3. Escape with text in the stash window's search box clears the search and leaves the window open; a second Escape closes it. (Task 3 test.)
4. A metadata event that lacks the player's own record must still update the stash button and window. (Task 4 test.)
5. The Stash button must appear right after mount, before any metadata event arrives, when a stash already exists in the room. (Task 4 test.)

---

### Task 1: Stash identification helpers

**Files:**
- Modify: `src/constants.ts` (after `CUSTOMS_KEY`, line 5)
- Create: `src/stash.ts`
- Modify: `CLAUDE.md:32` (room-metadata bullet)
- Test: `test/stash.test.ts`

**Interfaces:**
- Produces:
  - `export const STASH_ID_PREFIX = "npc-"` in `src/constants.ts`
  - `export interface StashEntry { id: string; record: PlayerInventoryRecord }` in `src/stash.ts`
  - `export function isStashId(id: string): boolean`
  - `export function selectStashes(records: Record<string, PlayerInventoryRecord>): StashEntry[]` — stash records only, malformed ones dropped, sorted by `record.name` with `localeCompare`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { isStashId, selectStashes } from "../src/stash";
import type { PlayerInventoryRecord } from "../src/types";

const rec = (name: string): PlayerInventoryRecord => ({
  w: "", name, color: "#000", items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
});

describe("isStashId", () => {
  it("accepts the npc- prefix", () => expect(isStashId("npc-mr-stompy")).toBe(true));
  it("rejects a UUID-shaped player id", () =>
    expect(isStashId("70e514a9-1dc6-4752-962c-614fe150b233")).toBe(false));
  it("rejects npc- appearing anywhere but the start", () =>
    expect(isStashId("x-npc-y")).toBe(false));
});

describe("selectStashes", () => {
  it("returns only stash records, sorted by name, carrying their ids", () => {
    const out = selectStashes({
      "npc-wagon": rec("Wagon"),
      "player-1": rec("Alice"),
      "npc-mr-stompy": rec("Mr. Stompy"),
    });
    expect(out.map((s) => s.id)).toEqual(["npc-mr-stompy", "npc-wagon"]);
    expect(out[0].record.name).toBe("Mr. Stompy");
  });
  it("drops malformed records instead of throwing", () => {
    const bad = { w: "", name: "Broken", color: "#000" } as unknown as PlayerInventoryRecord;
    const noCurrency = { w: "", name: "NoCoins", color: "#000", items: [] } as unknown as PlayerInventoryRecord;
    const out = selectStashes({ "npc-bad": bad, "npc-nocoins": noCurrency, "npc-ok": rec("Ok") });
    expect(out.map((s) => s.id)).toEqual(["npc-ok"]);
  });
  it("returns an empty array when there are no stash records", () =>
    expect(selectStashes({ "player-1": rec("Alice") })).toEqual([]));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/stash.test.ts`
Expected: FAIL, cannot resolve `../src/stash`.

- [ ] **Step 3: Add `STASH_ID_PREFIX` to `src/constants.ts` and implement `src/stash.ts`**

A record is well-formed when `typeof name === "string"`, `Array.isArray(items)`, and `currency` is a non-null object.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/stash.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Document the convention in `CLAUDE.md`**

Extend bullet 2 under "Data flow" with one sentence: records whose id starts with `npc-` are party stashes, created by hand, shown read-only to every player via the Stash button, and otherwise treated as ordinary records.

- [ ] **Step 6: Commit**

```bash
git add src/constants.ts src/stash.ts test/stash.test.ts CLAUDE.md
git commit -m "feat: identify npc- inventory records as party stashes"
```

---

### Task 2: Shell read-only mode, title overrides, close and Stash buttons

**Files:**
- Modify: `src/ui-shell.ts` (interfaces lines 37–58; brand row 81–88; footer actions 234–249; coin inputs 252–306; returned refs 459–474)
- Modify: `src/styles-list.ts` (`.btn-create` block at 349–364; `.brand-sub` at 34; coin input rule at 426)
- Test: `test/ui-shell-readonly.test.ts`

**Interfaces:**
- Produces, in `src/ui-shell.ts`:
  ```ts
  export interface ShellOptions {
    readOnly?: boolean;   // no Add/Create buttons, coin inputs non-editable
    title?: string;       // default "Tome of Holdings"
    subtitle?: string;    // default record.name
    onClose?: () => void; // renders button.brand-close at end of .brand
  }
  export interface ShellHandlers { /* existing */ onStashClick?: () => void; }
  export interface ShellRefs { /* existing */ setStashVisible: (visible: boolean) => void; }
  export function mountShell(root, initialRecord, catalog, handlers, options?: ShellOptions): ShellRefs;
  ```
- DOM contract: `button.btn-stash.font-display` with text `Stash`, inserted before `.btn-add`, `hidden` until `setStashVisible(true)`; `button.brand-close` using `icon("i-x")`; `.gold-strip` gets `data-readonly="true"` in read-only mode and each `.coin-input` has `readOnly` and `tabIndex = -1` and no `onchange`.

- [ ] **Step 1: Write the failing tests**

Use the `catalog`, `record`, and `noopHandlers()` fixtures from `test/ui-shell-view-toggle.test.ts` (copy them; do not import across test files). Tests:

```ts
it("read-only mode renders no Add or Create buttons", ...)
  // mountShell(root, record, catalog, { ...noopHandlers(), onCreateCustomClick: () => {} }, { readOnly: true })
  // expect(root.querySelector(".btn-add")).toBeNull(); expect(root.querySelector(".btn-create")).toBeNull();
it("read-only mode makes coin inputs non-editable", ...)
  // every .coin-input has readOnly === true and tabIndex === -1; .gold-strip dataset.readonly === "true"
  // changing a coin input and dispatching "change" does NOT call handlers.onCurrencyChange (vi.fn)
it("default mode leaves coin inputs editable and shows Add", ...)
  // regression: no options → .btn-add present, coin inputs readOnly === false
it("title and subtitle overrides land in the brand row", ...)
  // { title: "Mr. Stompy", subtitle: "Read only" } → .brand-title text "Mr. Stompy", .brand-sub text "Read only"
it("defaults title to Tome of Holdings and subtitle to the record name", ...)
it("onClose renders a close button that calls back", ...)
  // .brand-close exists; click → onClose called once; without onClose → no .brand-close
it("onStashClick renders a hidden Stash button that setStashVisible reveals", ...)
  // .btn-stash exists, textContent "Stash", hidden === true; refs.setStashVisible(true) → hidden false; click → handler called
  // .btn-stash precedes .btn-add in .shell-actions (compareDocumentPosition)
it("without onStashClick there is no Stash button and setStashVisible is a no-op", ...)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/ui-shell-readonly.test.ts`
Expected: FAIL on the options argument / missing elements.

- [ ] **Step 3: Implement `ShellOptions`, `onStashClick`, `setStashVisible` in `src/ui-shell.ts`**

- Brand row: `brandTitle.textContent = options?.title ?? "Tome of Holdings"`; `brandSub.textContent = options?.subtitle ?? initialRecord.name`; when `options?.onClose`, append `button.brand-close` (type button, title "Close", child `icon("i-x")`) after `brandSub`.
- Footer: when `readOnly`, skip both the Create and Add buttons. Otherwise, when `handlers.onStashClick`, create the Stash button and append it to `actions` before `addBtn`, with `hidden = true`.
- Coins: when `readOnly`, set `gold.dataset.readonly = "true"`, and on each input set `readOnly = true`, `tabIndex = -1`, and skip attaching `onchange`, `onfocus`, `onkeydown`.
- Refs: `setStashVisible: (v) => { if (stashBtn) stashBtn.hidden = !v; }`.

- [ ] **Step 4: Add styles in `src/styles-list.ts`**

- Change the `.btn-create` selector to `.btn-create, .btn-stash` for both the base and `:hover` rules.
- Add `.brand-close` after `.brand-sub`: transparent background, no border, `color: var(--text-dim)`, `width: 22px; height: 22px`, inline-flex centered, `cursor: pointer`, `margin-left: 8px`, `align-self: center`; svg `13px`; hover `color: var(--text)`.
- Add `.gold-strip[data-readonly="true"] .coin-input { color: var(--text-dim); cursor: default; }` after the `.coin-input` rule.

- [ ] **Step 5: Run the new tests and the full suite**

Run: `npx vitest run test/ui-shell-readonly.test.ts && npm test`
Expected: PASS; all existing suites unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/ui-shell.ts src/styles-list.ts test/ui-shell-readonly.test.ts
git commit -m "feat: add read-only mode and stash hooks to the inventory shell"
```

---

### Task 3: Stash window module

**Files:**
- Create: `src/ui-stash.ts`
- Modify: `src/styles-dialog.ts` (`.popover` at line 3–10; append `.stash-panel` rules after `.customs-panel-footer` block, ~line 795)
- Test: `test/ui-stash.test.ts`

**Interfaces:**
- Consumes: `mountShell(root, record, catalog, handlers, options)` and `ShellRefs` from Task 2; `StashEntry` from Task 1; `showDescription(anchor, item, id)` and `closeDescription()` from `src/ui-description.ts`.
- Produces, in `src/ui-stash.ts`:
  ```ts
  export interface OpenStashOpts { stashes: StashEntry[]; catalog: CatalogItem[]; }
  export function openStash(opts: OpenStashOpts): void;
  export function updateStash(stashes: StashEntry[], catalog: CatalogItem[]): void;
  export function closeStash(): void;
  ```
- DOM contract: `div.modal-backdrop > div.modal.stash-panel > [div.stash-tabs?, div.stash-shell-host]`. Pills are `button.stash-tab[data-stash-id]` with `.active` on the selected one. The shell inside is mounted with `{ readOnly: true, title: record.name, subtitle: "Read only", onClose: closeStash }` and an `onDescription` that calls `showDescription(anchor, catalogItem ?? null, id)` with no options.

- [ ] **Step 1: Write the failing tests**

Fixtures: a catalog with `Canoe` (id `c1`, category "Adventuring Gear - Camping & Travel", weight 100) and `Barrel` (id `b1`, weight 70); stash `npc-mr-stompy` named "Mr. Stompy" with items `[["c1",1],["b1",1]]` and currency `{ pp: 0, gp: 222, sp: 6, cp: 5 }`; a second stash `npc-wagon` named "Wagon" with items `[["c1",2]]`. `beforeEach`: `__testHooks.reset(); document.body.innerHTML = ""; closeStash(); localStorage.clear();`.

```ts
it("opens with one stash: title, no pills, rows, coins", ...)
  // .stash-panel present; .brand-title "Mr. Stompy"; .brand-sub "Read only"; .stash-tabs null
  // .inv-row count 2; .coin-input values ["0","222","6","5"] in pp,gp,sp,cp order
it("renders no edit affordances", ...)
  // .btn-add null; .btn-create null; .btn-stash null; every .coin-input readOnly
it("two stashes render pills and clicking swaps the shell", ...)
  // .stash-tab count 2; first has .active; click second → .brand-title "Wagon", .inv-row count 1, second .active
it("updateStash re-renders a changed count in place", ...)
  // open; updateStash with gp 200 and c1 count 3 → .coin-input gp "200"; row for c1 shows "×3"
it("updateStash falls back when the shown stash disappears", ...)
  // open with two, select Wagon; updateStash([mrStompy]) → title "Mr. Stompy", no pills
it("updateStash with an empty list closes the window", ...)
it("updateStash with a renamed stash updates the title", ...)
  // open Mr. Stompy; updateStash with name "Sir Stompy" → .brand-title "Sir Stompy"
it("updateStash is a no-op when closed", ...)
  // never opened; updateStash(...) → document has no .stash-panel, does not throw
it("close button, Escape, and backdrop mousedown each close", ...)
  // three sub-cases; after each, document.querySelector(".modal-backdrop") is null
it("Escape with search text clears the search instead of closing; second Escape closes", ...)
  // set .stash-panel .shell-search value "can", dispatch keydown Escape (bubbles) on the input
  // → panel still present, search value ""; dispatch again → panel gone
it("clicking a row opens a read-only description popover", ...)
  // click first .inv-row → .description-popover present; .btn-step null; .btn-x null; .desc-transfer null
it("closing the window also closes an open description popover", ...)
it("items missing from the catalog still render", ...)
  // stash with [["zzz",1]] → one .inv-row whose .inv-name text contains "missing from catalog"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/ui-stash.test.ts`
Expected: FAIL, cannot resolve `../src/ui-stash`.

- [ ] **Step 3: Implement `src/ui-stash.ts`**

Module state: `active: HTMLElement | null` (the backdrop), `stashes`, `catalog`, `selectedId`, `shell: ShellRefs | null`, `host`, `tabsEl`, and the keydown handler reference.

- `openStash`: `closeStash()` first; build backdrop/panel/host; `selectedId = stashes[0].id`; `renderTabs()`; `mountSelected()`; backdrop `mousedown` closes when `e.target === back`; register `document.addEventListener("keydown", onKey, true)`.
- `onKey`: ignore non-Escape. If `e.target` is the panel's `.shell-search` with non-empty `value`, return (the shell clears it). Otherwise `closeStash()`.
- `renderTabs`: remove the existing `.stash-tabs`; when `stashes.length > 1`, insert a `.stash-tabs` div before the host with one `button.stash-tab` per stash (`textContent = record.name`, `dataset.stashId = id`, `.active` on `selectedId`); click sets `selectedId` and calls `renderTabs(); mountSelected()`.
- `mountSelected`: `shell?.destroy()`, then `shell = mountShell(host, record, catalog, handlers, { readOnly: true, title: record.name, subtitle: "Read only", onClose: closeStash })`. Handlers: no-op async for the four mutators and `onAddClick`; `onDescription(id, anchor)` looks the item up in `catalog` and calls `showDescription(anchor, item ?? null, id)`.
- `updateStash(next, cat)`: return if `!active`; assign; if `next.length === 0` → `closeStash()`; else if `selectedId` not present → `selectedId = next[0].id`, `renderTabs(); mountSelected()`; else if the selected record's `name` differs from the name mounted last time → `renderTabs(); mountSelected()` (the shell sets its title once); else `renderTabs(); shell!.rerender(record, cat)`. Track the mounted name in module state.
- `closeStash`: `closeDescription()`, `shell?.destroy()`, remove backdrop, remove the keydown listener, null out state.

- [ ] **Step 4: Add styles in `src/styles-dialog.ts`**

- `.popover { z-index: 70 }` (edit the existing rule in place).
- Append:
  ```css
  .stash-panel {
    width: min(500px, calc(100vw - 24px));
    height: min(660px, calc(100vh - 24px));
    max-width: none; padding: 0;
    display: flex; flex-direction: column; overflow: hidden;
  }
  .stash-tabs { display: flex; gap: 6px; padding: 8px 12px 0; flex-wrap: wrap; }
  .stash-tab { /* pill: rgba(0,0,0,0.3) bg, 1px var(--border), radius 99px, 3px 10px padding, 11px, var(--text-dim); .active → var(--accent-soft) text and border */ }
  .stash-shell-host { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
  .stash-shell-host > .shell { flex: 1 1 auto; min-height: 0; height: auto; }
  ```

- [ ] **Step 5: Run the new tests and the full suite**

Run: `npx vitest run test/ui-stash.test.ts && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui-stash.ts src/styles-dialog.ts test/ui-stash.test.ts
git commit -m "feat: add read-only stash window"
```

---

### Task 4: Wire the Stash button into the player view

**Files:**
- Modify: `src/ui-player.ts` (imports 1–21; `records` declaration 109; `mountShell` call 111; `onRoomMetadataChange` 161–167; `onCustomsChange` 169–174; teardown 205)
- Test: `test/ui-player-stash.test.ts`

**Interfaces:**
- Consumes: `selectStashes` (Task 1); `openStash`, `updateStash`, `closeStash` (Task 3); `ShellRefs.setStashVisible` and `ShellHandlers.onStashClick` (Task 2); `listInventoryRecords` from `src/metadata.ts`.
- Produces: no new exports. Behavior only.

- [ ] **Step 1: Write the failing tests**

Setup: `__testHooks.reset(); document.body.innerHTML = ""; localStorage.clear(); closeStash();`. Seed the mock store directly: `__testHooks.store.set(recordKey("player-self"), selfRecord)` and, where needed, `__testHooks.store.set(recordKey("npc-mr-stompy"), stashRecord)`. Mount with `mountPlayerView({ root, catalog, initialCustoms: [], playerId: "player-self", initialRecord: selfRecord })`. Use `await vi.waitFor(() => expect(...))` for anything that depends on the async seed read. Trigger live metadata events with `await OBR.room.setMetadata({ [recordKey(id)]: value })` (the mock notifies listeners synchronously). `OBR` and `__testHooks` both come from `./_mocks/obr-sdk`; `recordKey` from `../src/metadata`; `mountPlayerView` from `../src/ui-player`; `closeStash` from `../src/ui-stash`.

```ts
it("shows the Stash button after mount when a stash record already exists", ...)
  // no setMetadata call after mount; await vi.waitFor → .btn-stash hidden === false
it("hides the Stash button when the room has no stash records", ...)
  // await the seed; .btn-stash hidden === true
it("reveals the button when a stash record appears, and hides it when it is deleted", ...)
  // setMetadata add → hidden false; setMetadata { key: undefined } → hidden true
it("clicking Stash opens the window for the stash", ...)
  // click .btn-stash → .stash-panel present; .brand-title "Mr. Stompy"
it("live changes to the stash re-render the open window", ...)
  // open; setMetadata with gp 300 → .stash-panel .coin-input (gp) value "300"
it("a metadata event without the player's own record still updates the stash UI", ...)
  // open; setMetadata({ [recordKey("player-self")]: undefined, [recordKey("npc-mr-stompy")]: { ...stash, currency: { ...gp: 1 } } })
  // → window still open and gp input "1"
it("deleting the last stash while the window is open closes it", ...)
it("teardown closes the window", ...)
  // const destroy = mountPlayerView(...); open; destroy(); → .stash-panel null
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/ui-player-stash.test.ts`
Expected: FAIL, no `.btn-stash` in the DOM.

- [ ] **Step 3: Implement the wiring in `src/ui-player.ts`**

- Import `selectStashes` from `./stash` and `openStash, updateStash, closeStash` from `./ui-stash`.
- Add `let metaSeen = false;` beside `records`.
- Define `const syncStash = () => { const stashes = selectStashes(records); refs.setStashVisible(stashes.length > 0); updateStash(stashes, merged); };` after `refs` is assigned.
- Add `onStashClick: () => { const stashes = selectStashes(records); if (stashes.length > 0) openStash({ stashes, catalog: merged }); }` to the `mountShell` handlers.
- In `onRoomMetadataChange`: set `records = incoming; metaSeen = true; syncStash();` before the `if (!me) return;` line.
- In `onCustomsChange`: call `syncStash()` after `merged` is recomputed.
- After the subscriptions: `void listInventoryRecords().then((all) => { if (!metaSeen) { records = all; syncStash(); } }).catch((e) => console.warn("[obr-inv] stash seed read failed", e));`
- Teardown: add `closeStash();` to the returned function.

- [ ] **Step 4: Run the new tests and the full suite, then build**

Run: `npx vitest run test/ui-player-stash.test.ts && npm test && npm run build`
Expected: PASS; `tsc` clean; `dist/` produced.

- [ ] **Step 5: Commit**

```bash
git add src/ui-player.ts test/ui-player-stash.test.ts
git commit -m "feat: show the party stash from the player view"
```

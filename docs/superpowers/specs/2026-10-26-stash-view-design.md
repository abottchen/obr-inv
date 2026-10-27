# Stash View — Design

**Date:** 2026-10-26
**Status:** Draft (brainstorming and builder check complete; pending approval)

## Summary

Give players a read-only window onto "stash" inventory records: party-shared
records that belong to no player, such as the pack animal Mr. Stompy, which
the table also uses to hold the party's pooled gold. A "Stash" button in the
player footer opens a modal that renders the stash with the familiar
inventory shell, minus every edit control.

## Background

Mr. Stompy already exists in room metadata as an ordinary inventory record at
`com.abottchen.obr-inv/v1/npc-mr-stompy`, created by hand. Because any key
under the v1 prefix counts as a record, the GM rail lists him, but the player
view loads only the player's own key, so players never see him. At the table,
players want two things from him: how much gold he carries and what items he
has. A read-only view answers both.

## Goals

- Any player can see a stash's items, counts, currency, and total weight in
  one click.
- The window updates live while open.
- No change to stored data. The existing `npc-mr-stompy` record works as-is.
- One button, one window. Nothing else added to the player UI.

## Non-Goals

- Editing a stash from the player view. No add, remove, ±, currency edits,
  or transfer-out. Players can already transfer items *to* a stash from their
  own inventory; that is unchanged and not part of this work.
- Moving gold between records.
- Hardening UI mutators against concurrent writes (they build from a
  click-time snapshot rather than the fresh value the retry loop supplies).
  Read-only means this feature does not make that worse. Tracked separately.
- A GM-side UI for creating or renaming stash records.
- Any change to the GM view. The rail already shows stash records.

## UX Decisions

| Decision | Choice |
|---|---|
| Entry point | A secondary "Stash" button in `.shell-actions`, before "Add to inventory". Same visual treatment as the GM's "Create item" button. Player view only. |
| Button visibility | Rendered only when the room has at least one stash record. Appears and disappears reactively as records change. |
| Window | Modal over the player view (`.modal-backdrop` + `.modal.stash-panel`), sized to nearly fill the popover: `width: min(500px, 100vw - 24px)`, `height: min(660px, 100vh - 24px)`. |
| Window contents | The existing shell, mounted in read-only mode. Search, collapse/expand, list/grid toggle, category groups, footer weight, coin strip all present. |
| Title bar | Brand title shows the stash's name instead of "Tome of Holdings". Brand subtitle reads "Read only". A ✕ close button sits at the end of the brand row. |
| Removed in read-only mode | "Add to inventory" and "Create item" buttons. Coin inputs are non-editable and dimmed. Clicking an item opens the description popover with no ± / trash / Transfer controls. |
| Multiple stashes | When more than one stash record exists, a row of name pills sits at the top of the panel, above the shell's title bar; clicking a pill swaps the record shown. With exactly one stash, no pills. Sorted by name. The pills belong to the stash module, not the shell, so the shell needs no header slot and can be remounted freely on switch. |
| Closing | ✕, Escape, or a click on the backdrop. Closing also dismisses any open description popover. |
| Live updates | Record and catalog changes re-render the open window in place. If the shown stash disappears, the window falls back to the first remaining stash, or closes if none remain. |
| View mode and collapse state | Shared with the main inventory (same `localStorage` keys). Both are read once per `mountShell`, so a toggle inside the stash window reaches the main view only when the popover is next reopened. Accepted for simplicity. |

## Identifying stash records

A record is a stash when its id (the part of the key after the v1 prefix)
starts with `npc-`.

- `STASH_ID_PREFIX = "npc-"` in `src/constants.ts`.
- Mr. Stompy's key already matches. No migration.
- Stash records are created by hand (any room-metadata write that produces a
  `PlayerInventoryRecord`-shaped value under `v1/npc-<slug>`). The convention
  is documented in `CLAUDE.md` so a future GM tool or script knows the rule.
- Stash records remain ordinary records everywhere else: the GM rail, export,
  the storage meter, transfer targets, and the merge dialog all treat them as
  they do today. Auto-heal and orphan detection match on player display names,
  so a stash is never mistaken for a reconnected player unless its name
  collides with a player's; that is the same risk any hand-named record
  carries today and is not addressed here.

## Architecture

### File layout

| File | Change | Purpose |
|---|---|---|
| `src/constants.ts` | extend | `STASH_ID_PREFIX`. |
| `src/stash.ts` | **new** | Pure helpers, no DOM, no OBR: `isStashId(id)`, `selectStashes(records)` returning `Array<{ id, record }>` sorted by name. |
| `src/ui-shell.ts` | extend | New optional fifth argument `ShellOptions`; read-only rendering; title/subtitle override; optional ✕; optional "Stash" button driven by a new handler and a visibility setter on `ShellRefs`. |
| `src/ui-stash.ts` | **new** | `openStash(opts)`, `updateStash(stashes, catalog)`, `closeStash()`. Owns the modal, the pill row, and the read-only shell inside it. Module-level `active` singleton like the other popover modules. |
| `src/ui-player.ts` | extend | Seeds `records` with an initial `listInventoryRecords()` read after mount, computes stashes on every records/customs change, toggles the button, calls `updateStash`, and wires `onStashClick` to `openStash`. |
| `src/styles-list.ts` | extend | `.btn-stash` (shares the `.btn-create` rule), `.brand-close`, read-only coin dimming via `.gold-strip[data-readonly="true"]`. |
| `src/styles-dialog.ts` | extend | `.stash-panel` sizing (must override `.modal`'s `max-width: 320px` and `padding: 16px`), `.stash-tabs` pill row, `.popover` z-index raise. |
| `CLAUDE.md` | extend | Document the `npc-` convention under the room-metadata bullet. |

### Shell changes

```ts
export interface ShellOptions {
  /** Read-only presentation: no Add/Create buttons, coin inputs
   *  non-editable, no edit affordances offered to onDescription callers. */
  readOnly?: boolean;
  /** Brand title override. Defaults to "Tome of Holdings". */
  title?: string;
  /** Brand subtitle override. Defaults to record.name. */
  subtitle?: string;
  /** When set, a ✕ renders at the end of the brand row and calls this. */
  onClose?: () => void;
}

export interface ShellHandlers {
  // ...existing...
  /** Player-view entry point for the stash window. Omit to suppress
   *  the button entirely (GM view). */
  onStashClick?: () => void;
}

export interface ShellRefs {
  // ...existing...
  /** Show or hide the Stash button. No-op when onStashClick was not given. */
  setStashVisible: (visible: boolean) => void;
}

export function mountShell(
  root, initialRecord, catalog, handlers, options?: ShellOptions,
): ShellRefs;
```

Read-only mode details:

- Coin `<input>` elements stay (so the rerender path and CSS are unchanged)
  but get `readOnly = true`, `tabIndex = -1`, and the strip gets
  `data-readonly="true"` for dimming. The `onchange` commit is not attached.
- The footer action cluster renders no buttons. The weight remains.
- `onDescription` is still called with a `DescriptionCtx`; the stash module
  ignores it and calls `showDescription(anchor, item, id)` with no options,
  which the popover already renders as read-only.
- The Stash button starts hidden; the view sets visibility once it knows the
  records.

### Stash window module

```ts
export interface StashEntry { id: string; record: PlayerInventoryRecord; }

export interface OpenStashOpts {
  stashes: StashEntry[];          // non-empty, sorted by name
  catalog: CatalogItem[];         // merged catalog + customs
}

export function openStash(opts: OpenStashOpts): void;
export function updateStash(stashes: StashEntry[], catalog: CatalogItem[]): void;
export function closeStash(): void;
```

- `openStash` builds backdrop + panel, renders the pill row when
  `stashes.length > 1`, mounts a read-only shell for the first stash, and
  installs Escape and backdrop-mousedown handlers.
- `updateStash` is a no-op when the window is closed. When open it replaces
  the stash list, re-renders the pills, and re-renders the shell with the
  currently selected id. If that id is gone it selects the first remaining
  stash; if the list is empty it closes the window.
- Switching pills remounts the shell with the new record (the same pattern
  the GM view uses when switching rail items).
- Escape: closes the window, except when the event target is the window's
  own search input and it holds text. In that case the shell's existing
  handler clears the search and the window stays open.
- Stacking: today `.popover` is `z-index: 50` and `.modal-backdrop` is
  `60`, so a description popover opened from inside the window would render
  behind the backdrop. Raise `.popover` to `70`. Nothing else occupies
  60–80 except `.transfer-popover` (60, unaffected: it sits above the
  dialog overlay at 40 and is never opened from a modal) and
  `.claim-banner` (80, which should stay on top).

### Player view wiring

- After `mountShell`, read `listInventoryRecords()` once to seed `records`
  (today the player view learns about other records only from the first
  metadata event).
- On every `records` or `customs` update: `const stashes =
  selectStashes(records)`; `refs.setStashVisible(stashes.length > 0)`;
  `updateStash(stashes, merged)`.
- `onStashClick: () => openStash({ stashes: selectStashes(records), catalog: merged })`.
- The GM view passes no `onStashClick`, so nothing changes there.

### Implementation notes

Small things a builder could get wrong on a first pass:

- In `ui-player.ts`, the `onRoomMetadataChange` callback returns early when
  the player's own record is missing (`if (!me) return;`). The stash update
  and button toggle must run before that early return.
- The one-time `listInventoryRecords()` seed must not overwrite a `records`
  value that an earlier metadata event has already populated.
- The stash window's Escape handler needs to observe the search input's text
  before the shell's own keydown handler clears it, so register it in the
  capture phase on the panel.
- `selectStashes` drops records that lack `name`, `items`, or `currency`
  rather than throwing. A malformed hand-written stash record must not break
  every player's metadata callback.
- The shell sets the brand title once at mount. A stash renamed while the
  window is open is handled by remounting the shell (the same path a pill
  switch uses), not by a title setter.

## Edge Cases

- **No stash records:** button absent. If the window is open when the last
  stash is deleted, it closes silently.
- **Stash item missing from the catalog:** the shell already renders
  `[id] (missing from catalog)` under "Unknown".
- **Customs change while open:** `updateStash` receives the new merged
  catalog and re-renders.
- **Pulse animations inside the window:** the read-only shell has its own
  pulse tracker, so a count that changes while a player is looking
  animates as it does in their own inventory. Intentional.
- **Stash button on a narrow popover:** the footer cluster already holds two
  buttons for the GM ("Create item" + "Add to inventory"), so the width is
  proven. If it wraps, the builder may let `.shell-actions` wrap.
- **Grid view inside the window:** the shell's tooltip layer positions
  relative to the shell wrapper, which now lives inside the modal. The
  builder verifies tooltips stay inside the panel.

## Testing

Mirrors existing patterns: vitest, jsdom, mocked OBR SDK (`test/_mocks/obr-sdk.ts`
imported first).

### `test/stash.test.ts` (pure)

- `isStashId("npc-mr-stompy")` is true; a UUID-shaped id is false; an id
  that merely contains `npc-` elsewhere is false.
- `selectStashes` returns only stash records, sorted by name, each carrying
  its id.

### `test/ui-shell-readonly.test.ts` (DOM)

- `mountShell(..., { readOnly: true })`: no `.btn-add`, no `.btn-create`,
  coin inputs have `readOnly`, strip has `data-readonly="true"`.
- `title` and `subtitle` overrides land in `.brand-title` / `.brand-sub`.
- `onClose` renders `.brand-close`; clicking it calls the handler.
- `onStashClick` renders `.btn-stash`, hidden until `setStashVisible(true)`;
  clicking calls the handler. Without `onStashClick`, no `.btn-stash` and
  `setStashVisible` is a safe no-op.

### `test/ui-stash.test.ts` (DOM)

- `openStash` with one stash: `.stash-panel` present, brand title is the
  stash name, no `.stash-tabs`, rows render the stash's items with counts,
  coin inputs show the stash's currency.
- With two stashes: `.stash-tabs` has two pills; clicking the second swaps
  the brand title and rows.
- `updateStash` with a changed count updates the row in place; with the
  shown stash removed falls back to the other; with an empty list closes.
- ✕, Escape, and backdrop mousedown each close the window and remove the
  backdrop from the DOM.
- Clicking a row opens `.description-popover` with no `.btn-step`, no
  trash, and no Transfer button.

### `test/ui-smoke.test.ts` (extend)

- Player view mounted with a `npc-` record in the mock store shows
  `.btn-stash`; clicking it opens `.stash-panel`.
- Player view with no stash records shows no `.btn-stash`.
- Deleting the stash record from the store hides the button.

### Regression

All existing suites pass unchanged. `mountShell`'s new fifth argument is
optional and defaults to current behavior.

## Out of Scope / Follow-ups

- GM UI to create, rename, or delete stash records.
- Deposit/withdraw gold between a player and a stash.
- Mutator snapshot fix in `ui-player.ts` / `ui-gm.ts`.
- A "stash" marker on rail items in the GM view.

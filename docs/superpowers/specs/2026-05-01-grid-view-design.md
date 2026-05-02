# Grid View — Design

**Date:** 2026-05-01
**Status:** Approved (brainstorming complete; ready for implementation planning)

## Summary

Add a "View" toggle to the inventory UI offering two modes:

1. **List view** — the existing rows-per-item-grouped-by-category layout.
2. **Grid view** — a Baldur's Gate-style grid of square cells (item images with overlaid count badges), still grouped by category with collapse chevrons.

The user's last-chosen view persists across sessions in `localStorage` and applies globally (player view, GM tabs, every room).

## Goals

- Provide a denser, more visual way to scan a player's inventory at a glance.
- Reuse the existing category-grouping, collapse, search, lock, and right-click-popover machinery without behavioral changes.
- Keep the implementation localized: one new renderer module + one extracted data helper + a small shell extension.

## Non-Goals

- Inline edit controls in grid cells. All quantity changes and removals continue to flow through the right-click description popover (which already gates them on the lock state).
- Fixed-slot inventories à la BG. Cells are emitted only for items the player actually has.
- Per-context view preferences (per role, per tab). One global preference applies everywhere.
- A custom JS-driven tooltip subsystem. Tooltips are pure CSS `:hover`.

## UX Decisions

| Decision | Choice |
|---|---|
| Edit controls in grid cells when unlocked | None. Right-click → popover only. Cells render identically locked/unlocked. |
| Tooltip contents | Item name only, rarity-tinted (mirrors `.inv-name` styling, including very-rare/legendary glow). |
| Tooltip mechanism | Pure CSS `:hover`, `pointer-events: none`. No JS. |
| Persistence scope | Single global `localStorage` key. |
| Count badge when count = 1 | Hidden (BG convention). |
| Cell size | CSS grid `repeat(auto-fill, minmax(64px, 1fr))`, `aspect-ratio: 1`. |
| Toggle glyph | Shows the *target* mode: `▦` when in list (click → grid), `☰` when in grid (click → list). |
| Toggle placement | Header, between expand-all (`⊞`) and lock (`🔒`). |

## Architecture

Two parallel renderers consuming a shared data helper. `ui-shell.ts` owns the view-mode state and dispatches.

### File layout

| File | Change | Purpose |
|---|---|---|
| `src/ui-items-data.ts` | **new** | Pure function `groupByCategory(state)` returning `Map<category, Array<{entry, item}>>`. Applies search filter, ghost/phantom-remove inclusion, alphabetical sort. No DOM. |
| `src/ui-list.ts` | refactor | `renderList` calls `groupByCategory` instead of inlining the grouping. Behavior unchanged. |
| `src/ui-grid.ts` | **new** | `renderGrid(container, state, handlers)`. Same signature as `renderList`. Emits `.cat-group`/`.cat-header`/`.cat-body` skeleton (preserves collapse) wrapping `.grid-cells > .inv-cell` instead of `.inv-row`. |
| `src/ui-shell.ts` | extend | Adds `viewMode: "list" \| "grid"` state, view-toggle button, localStorage read/write, dispatches to the right renderer at rerender time. |
| `src/styles-list.ts` | extend | Grid cell, count badge, tooltip, cell pulse animations. Single styles file keeps rarity vars co-located. |

### View-mode state & persistence

- localStorage key: `obr-inv:viewMode`, value `"list" | "grid"`.
- Read on `mountShell`; default to `"list"` for missing/invalid values.
- Read and write wrapped in try/catch — `localStorage` can throw in restricted contexts. Failure logs `console.warn` once per session and falls back to in-memory only.

### Toggle button

- Placed in `.shell-header` between `⊞` (expand-all) and `🔒` (lock).
- Glyph and `title` reflect target mode (where the click will take you).
- Click sequence: update in-memory `viewMode`, attempt localStorage write (best-effort), then call `rerender(currentRecord, currentCatalog)`. The renderer reads `viewMode` from shell closure state, not from localStorage.

## Grid Cell Anatomy

```html
<div class="inv-cell" data-rarity="rare" data-item-id="...">
  <div class="cell-image" style="background-image: url(...)"></div>
  <div class="cell-count">×3</div>
  <span class="cell-tooltip" data-rarity="rare">Healing Potion</span>
</div>
```

- **Image:** `background-image` from `item.icon` if `isSafeIconUrl()` passes (same gate as list view); otherwise centered `❓` glyph.
- **Count badge:** bottom-right, semi-transparent dark pill, white text. Hidden when `count === 1`.
- **Rarity tint:** `data-rarity` drives a 2px border using existing `--rarity-*` CSS vars. Very-rare and legendary get the same outer glow already used on names in list view (`box-shadow` instead of `text-shadow`).
- **Tooltip:** sibling `<span>` positioned above the cell via CSS `:hover`. `data-rarity` mirrors `.inv-name` rules for color/glow. `pointer-events: none` so right-click hits the cell.

### Layout

- Each `.cat-body-inner` becomes a CSS grid: `display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 6px;`. Cells are square via `aspect-ratio: 1`.
- Items inside each category sort alphabetically by `item.name` (missing-from-catalog items bucket under `"Unknown"`, sort by id).

### Tooltip clipping

- Pure CSS `:hover` tooltips can clip at the panel's top edge. Mitigation: position above by default; cells in the first row of the first category flip below via a CSS `:nth-child` rule.
- If clipping is worse in practice (sticky scrolled panels, etc.), revisit with a JS positioning helper. Documented as a known follow-up, not built upfront.

## Behavioral Parity

Every existing list-view behavior carries over. Mapping:

| Behavior | How it carries over |
|---|---|
| Search filter | `groupByCategory` already filters by name. Grid has no in-cell text, so no `<mark>` highlight; cells just appear/disappear. |
| Collapse / expand-all | Unchanged. Same `.cat-group`/`.cat-header`/`.cat-body` skeleton + `data-collapsed`. Existing click-delegation in shell works without modification. |
| Lock state | Affects only the right-click description popover (which already gates edit controls). Cells render identically locked vs unlocked. |
| Right-click → description popover | `cell.addEventListener("contextmenu", …)` calls `handlers.onDescription(id, {x, y})`. Same code path, same Transfer button. |
| Pulse / ghost / received-glow | `tracker.diff(...)` and `phantomRemoves` operate on item ids, not on rows. Grid stamps `dataset.pulse = pulse.kind` on cells. CSS keyframes get cell variants. |
| Auto-scroll on received | Same `scrollIntoView({block:"center"})` call, just on the cell. Reduced-motion check unchanged. |
| Phantom-remove | Synthetic `[id, 0]` entries get a one-render cell so the leave animation can play, mirroring list-view rows. |
| Missing-from-catalog item | Cell shows `❓`; tooltip shows `[id] (missing from catalog)`; sorts under `"Unknown"`. |
| Empty state | If `groupByCategory` returns empty, render the existing `.empty-state` element ("No items match…" / "Inventory is empty"). Single shared element. |
| GM tabs / shell reuse | `mountShell` is shared between player and GM. `viewMode` is global, applies everywhere on next render. Switching player tabs preserves view mode (it's shell-level state). |

## Error Handling & Edge Cases

- **localStorage unavailable / throws:** caught; falls back to in-memory `viewMode = "list"`. `console.warn` once per session.
- **localStorage value malformed** (`"banana"`, `null`, `""`): treated as missing, defaults to `"list"`. Next toggle writes a valid value.
- **Cell with no icon and no catalog match:** `❓` fallback. No throw, no broken layout.
- **Search yields zero matches:** existing `.empty-state` element.
- **Tooltip on fast cursor movement:** pure CSS `:hover`, no JS bookkeeping. No leak risk.
- **`renderGrid` called mid-animation:** `container.innerHTML = ""` blows away animations (same as list). Acceptable; pulses are short and the next render restamps `data-pulse` from the diff.
- **Switching view mode mid-pulse:** pulses live on `tracker`, not on DOM. They survive the renderer swap and stamp on whichever cells/rows render next. Auto-scroll fires once, on the new view.
- **GM viewing a player tab in grid mode while metadata updates land:** existing rerender path runs, just dispatches to `renderGrid`. No new race.

## Testing

Mirrors existing patterns (`vitest run`, jsdom, mocked OBR SDK).

### `test/ui-items-data.test.ts` — new pure-function unit tests

- Groups items by category, alphabetized within each group.
- Honors search filter (case-insensitive substring on item name).
- Includes ghost ids and phantom-remove ids as `[id, 0]` synthetic entries.
- Missing-from-catalog items bucket under `"Unknown"`, sort by id.
- Empty/whitespace search returns full set.

### `test/ui-grid.test.ts` — new DOM smoke tests

- `mountShell` with `localStorage["obr-inv:viewMode"] = "grid"` renders one `.inv-cell` per item.
- Each cell carries `data-item-id`, `data-rarity` (when applicable), and a `.cell-tooltip` with the item name.
- Count badge present when `count > 1`, absent when `count === 1`.
- Right-click on a cell calls `handlers.onDescription` with the cell's id and click coordinates.
- Cells are *not* affected by lock state (no inline edit controls appear in either lock state).
- Search input filters cells; clearing search restores them.
- Collapse-all / expand-all toggle `data-collapsed` on grid `.cat-group` elements.

### `test/ui-shell.test.ts` — new tests (or extension of existing smoke)

- View toggle button is present in header.
- Clicking it swaps the rendered view (`.inv-row` ↔ `.inv-cell`) and writes the new value to `localStorage["obr-inv:viewMode"]`.
- On mount, `localStorage["obr-inv:viewMode"] === "grid"` produces grid view immediately (no flash of list).
- Malformed/missing localStorage value falls back to list view, no throw.

### Regression check

`test/ui-smoke.test.ts` and other existing tests should continue to pass unchanged. The `ui-list.ts` refactor (extracting `groupByCategory`) is mechanical and behavior-preserving; existing assertions are the regression net.

## Out of Scope / Follow-ups

- JS-driven tooltip positioning (only if CSS clipping turns out worse than expected).
- Drag-and-drop reordering or fixed-slot grids.
- Per-category view-mode override.
- A "compact list" intermediate density.

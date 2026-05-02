# UI Improvements Backlog

Small UX maintenance items collected on the `maint/ui-improvements` branch. Each is independent of the in-flight reactivity work; address as separate tasks.

## Open

### 1. Add-to-inventory dialog should open with all categories collapsed
- **File:** `src/ui-add-dialog.ts:53`
- **Current:** `const collapsed = new Set<string>()` — every category renders expanded by default. With 305 catalog items + customs, the dialog is a long scroll on first open.
- **Desired:** populate `collapsed` with every category id before first render. User clicks the category they want, scans/searches inside it.
- **Open question:** should searching auto-expand the matching categories? Probably yes (otherwise the search results are hidden inside collapsed groups). Confirm before implementing.

### 2. Right-click on the description popover should close it
- **File:** `src/ui-description.ts:30-50` (popover construction), `:65-70` (existing close handlers).
- **Current:** Escape and click-outside close it; right-click does nothing.
- **Desired:** Add a `contextmenu` listener that calls `closeDescription()` and `preventDefault()`s. Fits the right-click-anywhere pattern the rest of the row already uses (right-click on a row opens this very popover; right-click again should dismiss).

## Done

(none yet)

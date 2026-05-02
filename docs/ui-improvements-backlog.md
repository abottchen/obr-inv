# UI Improvements Backlog

Small UX maintenance items collected on the `maint/ui-improvements` branch. Each is independent of the in-flight reactivity work; address as separate tasks.

## Open

(none)

## Done

### 1. Add-to-inventory dialog opens with all categories collapsed
Populated `collapsed` from the full catalog on first render; searching auto-expands matching groups; clearing the search restores the prior collapse state. Commit `8e713f8`.

### 2. Right-click on the description popover closes it
Added a `contextmenu` listener that calls `closeDescription()` and `preventDefault()`s. Commit `96f63e8`.

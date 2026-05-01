# OBR Inventory Extension — Design

**Status:** Draft, pending implementation plan
**Date:** 2026-05-01
**Author:** Adam (with Claude)

## 1. Purpose

A browser-based Owlbear Rodeo extension that lets each player at a tabletop RPG session view and edit their character's inventory directly in OBR. The GM sees every player's inventory through a tabbed view, can edit any of them, and can export a backup of all inventories on demand.

The extension is the moral cousin of `obr-quick-store` and reuses many of its patterns (Vite + TS, CSS-in-JS, per-player room-metadata keys, role-aware UI, GitHub Pages deploy via Actions). It is a separate codebase, not a fork.

## 2. Goals and non-goals

### Goals

- Each player clicks one toolbar button → popover shows their inventory.
- Inventory list: collapsible categories, name-only partial search, per-item icons, rarity-colored row borders, count display.
- Right-click any row → anchored description popover (icon, name, rarity, weight, description). Clamped to iframe bounds.
- Increase / decrease counts via per-row ± buttons. Buttons are gated behind a single global lock toggle so accidental clicks are not possible while the inventory is in "viewing" mode.
- "Add to inventory" dialog with the same search + collapsible categories, double-click and drag-to-add, plus a quantity input for bulk additions like "20 arrows."
- Shift+right-click on a row opens a small transfer popover listing other players (online or offline) with inventory records — click a name to transfer.
- Currency strip (pp/gp/sp/cp), always editable directly without the lock toggle.
- Total carried weight displayed subtly in the footer.
- GM view: tabbed shell (one tab per inventory record present in room metadata, plus the GM's own), storage usage meter, "download backup" icon. GM can edit any tab.
- All player inventory data lives in OBR room metadata under per-player keys, total never exceeding 5 KB across all players. Catalog itself lives in a separate public GitHub repo.
- 35–40 unit tests covering pure logic + smoke-level UI rendering, mocking the OBR SDK.
- GitHub Pages deployment via GitHub Actions (mirrors `obr-quick-store`).

### Non-goals

- Item *acquisition* mechanics beyond manual GM adds (no auto-loot from quick-store, no random tables).
- Equipped/unequipped state, attunement, charges, or any in-character mechanics beyond count.
- A second popover for a config panel — there is no separate config phase; the catalog URL field lives on the GM panel only.
- Cross-room inventory persistence. Each OBR room has its own metadata.
- E2E tests inside the OBR app.

## 3. Decisions

| Topic | Decision |
|---|---|
| Add-item workflow | Anyone with the panel open can use the "Add to inventory" dialog (button visible when unlocked). GM populates initially; players self-add only into their own. |
| Catalog schema | `id` (6-char NanoID, required) + `name`, `category`, `icon`, `description` (required) + `rarity`, `weight` (optional, app tolerates null/missing). Unknown extra fields preserved. |
| Currency | Full pp/gp/sp/cp split. Stored as a fixed object on each inventory record. |
| ± UX | Single global lock/unlock toggle for the panel. Locked = ± and × hidden, "Add" hidden. Unlocked = controls visible. Currency inputs always editable. |
| Search | Name-only across both inventory list and add dialog. |
| Right-click popover | Anchored to the row, clamped inside the iframe so it never clips. |
| Count → 0 | Stays visible in the UI as a ghost row while the popover is open. Persisted writes always strip zero-count entries. Closing the popover means zero rows are gone next open. |
| Item removal | Small × button on the row, only visible when unlocked. (Also implicit when count → 0 + popover closes.) |
| Transfer | Shift+right-click any row → popover listing other players with inventory records (online or offline). Quantity input. Click a name to transfer. No confirmation prompt. Players cannot transfer to the GM. GM can transfer to any player. Transfers are not gated by the lock toggle. |
| Storage cap | 5 KB across all `com.abottchen.obr-inv/v1/*` keys. Meter thresholds: 75% yellow, 90% red. |
| Over-cap behavior | Operation is rejected at the metadata-write boundary. Player-side action silently reverts (no player UI). GM gets a popup modal listing player + attempted action + current usage. |
| Storage format | Tuple-packed `[itemId, count][]` instead of `{id, count}[]` objects. Saves ~30% per entry. |
| GM tab | One tab per player inventory record found in metadata, plus a "GM" tab for the GM's own loot stash. GM is never a transfer target from a player. |
| GM export | Download icon → JSON file `obr-inv-backup-<iso8601>.json`. Each item entry hydrated with full catalog data. Wrapper includes `exportedAt`, catalog SHA-1, and per-player inventories. Unresolved IDs marked `_unresolved: true`. |
| Catalog source | Separate public GitHub repo (e.g., `obr-inv-catalog`) hosted via GitHub Pages. URL configurable via the GM panel, with a default. |
| Architecture | Single OBR popover, role-aware. One `index.html`, one bootstrap, role check at boot. |
| Token usage cap | (project process note) Stop and check in if conversation reaches 25% of weekly token budget. |

## 4. Architecture

### 4.1 OBR action registration

Single popover registered in `manifest.json`. Same default size as quick-store's storefront (380 × 500). Both PLAYER and GM open the same popover; the bootstrap dispatches by role.

### 4.2 Module layout

```
obr-inv/
├── .github/workflows/deploy.yml   ← test → build → publish to Pages
├── index.html                     ← single popover entry point
├── public/
│   ├── manifest.json              ← OBR extension manifest
│   └── icon.svg
├── src/
│   ├── main.ts                    ← bootstrap, role check, route to player|gm view
│   ├── catalog.ts                 ← fetch, validate, in-memory cache
│   ├── metadata.ts                ← read/write inventory keys; size accounting; write queue; cap guard
│   ├── inventory.ts               ← pure ops over PlayerInventoryRecord (add/inc/dec/remove/transfer/weight)
│   ├── transfer.ts                ← transfer orchestration + over-cap broadcast
│   ├── export.ts                  ← GM download: hydrate + wrap + blob
│   ├── ui-shell.ts                ← search, lock toggle, footer, gold strip, weight readout
│   ├── ui-player.ts               ← PLAYER view (own inventory only)
│   ├── ui-gm.ts                   ← GM view: tabs + storage meter + download icon + over-cap modal
│   ├── ui-list.ts                 ← collapsible category list + rows + ± + ×
│   ├── ui-add-dialog.ts           ← "Add to inventory" overlay (search + dbl-click + drag + qty)
│   ├── ui-description.ts          ← right-click anchored description popover
│   ├── ui-transfer.ts             ← shift+right-click transfer popover
│   ├── frame.ts                   ← clampToFrame(rect) helper used by all popovers
│   ├── styles.ts                  ← shared theme tokens (CSS variables)
│   ├── styles-list.ts
│   ├── styles-dialog.ts
│   ├── types.ts
│   └── constants.ts               ← extension ID, metadata key prefix, cap (5120), defaults, broadcast channels
├── test/
│   ├── _mocks/obr-sdk.ts          ← in-memory OBR SDK mock (metadata Map, broadcast log, role/id setters)
│   ├── inventory.test.ts
│   ├── metadata.test.ts
│   ├── catalog.test.ts
│   ├── transfer.test.ts
│   ├── export.test.ts
│   └── ui-smoke.test.ts
├── package.json                   ← scripts: dev, build, test, test:watch, preview
├── vite.config.ts
├── vitest.config.ts (or merged with vite.config)
└── tsconfig.json
```

### 4.3 Module boundaries

- `metadata.ts` is the **only** module that calls `OBR.room.getMetadata` / `setMetadata`. All other modules ask it.
- `inventory.ts` is pure — no OBR calls, no DOM. Exports take a `PlayerInventoryRecord` (or two for transfer) and return a new one. Tested in isolation.
- `catalog.ts` fetches and caches a `CatalogItem[]`. Tolerates missing/null optional fields. In-memory cache only; reset on every popover open is acceptable.
- UI modules consume state from `metadata.ts` and `catalog.ts`. UI never imports SDK directly.
- One broadcast channel: `com.abottchen.obr-inv/events`. Two message types: `transfer-received` (recipient toast) and `over-cap` (GM modal trigger).

### 4.4 Role-aware bootstrap

```
main.ts
  await OBR.ready
  role = await OBR.player.getRole()
  catalog = await catalog.load()
  await metadata.ensureRecord(self.id, self.name, self.color)
  if role === "GM"  → mount(ui-gm, { catalog })
  else              → mount(ui-player, { catalog, playerId: self.id })
```

`ensureRecord` is idempotent: creates an empty record if absent; updates cached `name`/`color` if they differ from what's in the SDK; leaves `items`/`currency` alone.

## 5. Data model

### 5.1 Catalog (remote JSON)

```ts
interface CatalogItem {
  id: string;            // 6-char NanoID, alphabet [A-Za-z0-9], stable, never reused
  name: string;
  category: string;      // single category for grouping
  icon: string;          // URL
  description: string;
  rarity?: Rarity | null;
  weight?: number | null;
}
type Rarity = "common" | "uncommon" | "rare" | "very rare" | "legendary";
```

The catalog file is `CatalogItem[]`. Validator drops items missing required fields with a console warn; tolerates null/missing optionals; preserves unknown extra fields (forward-compat); deduplicates on `id` (first wins, warn on dupes).

### 5.2 Inventory (per-player room metadata)

Key prefix: `com.abottchen.obr-inv/v1/<playerId>`. The `v1` is a forward-only version hook; future breaking changes bump to `/v2/` with a one-shot migration.

```ts
interface PlayerInventoryRecord {
  name: string;
  color: string;
  items: [string, number][];
  currency: { pp: number; gp: number; sp: number; cp: number };
}
```

`name` and `color` are cached on the record so transfers and GM tabs can render the player even when they are offline.

### 5.3 Storage cap and meter

- Cap: 5120 bytes total across all `com.abottchen.obr-inv/v1/*` keys, measured as `TextEncoder.encode(JSON.stringify(records)).byteLength`.
- Meter thresholds (GM panel only): green ≤ 75% (≤ 3840 B); yellow 75–90%; red > 90%.

### 5.4 Zero-prune-on-write

Every persistence write strips entries with `count <= 0` from the `items` array. UI keeps an ephemeral "ghost row at 0" while the popover is open; on close, those entries are already gone from storage and never re-render.

### 5.5 Over-cap rejection

`metadata.ts` write helper computes the prospective post-write size before persisting. If it exceeds the cap:
1. The write does **not** happen.
2. The helper throws `OverCapError(currentSize, cap, attemptedDelta)`.
3. Calling code catches, reverts optimistic UI, and emits a `over-cap` broadcast targeted at GM player IDs.
4. GM's popover (if open) renders a modal: which player, which action, current usage. Dismiss-only.

If the GM is the actor and hits cap (e.g., adding to a player's tab), no broadcast is emitted — the modal is shown directly in-place.

### 5.6 ID generation tooling

Catalog repo ships `scripts/add-item.mjs`: generates a 6-char NanoID (62-char alphabet), prints a JSON stub, and re-validates the entire catalog before commit. Collision odds for hand-curated catalogs are negligible (62⁶ ≈ 5.7 × 10¹⁰).

## 6. UI specification

### 6.1 Theme tokens (CSS variables)

| Token | Value | Use |
|---|---|---|
| `--bg-0` | `#15171f` | popover background |
| `--bg-1` | `#1c2030` | row background |
| `--bg-2` | `#252a3e` | hover / dialog background |
| `--border` | `#2a3046` | row borders, dividers |
| `--text` | `#e6e8ef` | primary text |
| `--text-dim` | `#8a8fa3` | category headers, weight readout, hints |
| `--accent` | `#7c4dff` | unlocked state, primary buttons, focused inputs |
| `--accent-soft` | `#a98bff` | armed/active accents |
| `--ok` | `#4caf50` | meter green |
| `--warn` | `#f0ad4e` | meter yellow |
| `--bad` | `#e95e5e` | meter red |

Rarity → row left-border 3 px stripe + colored item name (and faint left-to-right gradient on add-dialog rows):

| Rarity | Color |
|---|---|
| common | `#888` |
| uncommon | `#4caf50` |
| rare | `#2196f3` |
| very rare | `#9c27b0` |
| legendary | `#ff9800` |

Missing or unknown rarity → common color, no error.

### 6.2 Player view

Top-to-bottom layout:

1. Sticky header: name-only search input (left), lock toggle 🔒/🔓 (right).
2. Scrollable list: category header rows (chevron + name + count, click to collapse/expand) followed by item rows. Categories with zero matches under search are hidden entirely. Empty-search state shows the full structure.
3. Item row: `[icon 28 px] [name, flex] [×count, tabular-nums] [⊖ ⊕ ✕]`. The `⊖ ⊕ ✕` cluster only renders when unlocked.
4. Footer strip: total weight on the left (`⚖ 47.5 lb`, sums `weight × count` ignoring null/missing weights), "Add to inventory" button on the right (only when unlocked).
5. Gold strip: four labeled `<input type="number">` for pp/gp/sp/cp. Always editable. Commits on blur or Enter. Negative values rejected (input element minimum 0).

Per-popover-session (not persisted): which categories are collapsed, current search text. A reopen starts fresh.

### 6.3 GM view

Wraps the player-view shell with:

1. Tab strip across the top: one tab per player inventory record found in `com.abottchen.obr-inv/v1/*` plus the GM's own tab. Each tab uses the player's OBR color as a left-border accent; the active tab is filled with that color at low opacity. Tabs scroll horizontally with edge fades if overflowing.
2. Storage meter strip beneath the tabs: `█████████░ 4.1 KB / 5 KB ⚠`. Background fill colored by threshold. Hover tooltip lists the heaviest keys.
3. Download icon ⤓ at the right of the tab strip. Click → fetch fresh metadata, hydrate item IDs against the in-memory catalog, build wrapper `{ exportedAt, catalogVersion, catalogUrl, inventories }`, blob-download as `obr-inv-backup-<iso8601>.json`. Unresolved IDs in any inventory serialize as `{ id, count, _unresolved: true }`.
4. Below the meter: the player-view shell rendered for the selected tab. Fully editable.
5. Over-cap modal: triggered by the `over-cap` broadcast (or directly when the GM is the actor). Lists triggering player, attempted action, current bytes. Dismiss-only.

### 6.4 Add-to-inventory dialog

Triggered by the footer button when unlocked. Renders as a full-popover overlay (the popover is small, modal-in-modal would be cramped). Structure:

1. Header: title "Add to inventory" + ✕ close.
2. Search input (name-only).
3. Scrollable list: same collapsible category structure as the inventory list. Each row shows icon, rarity-colored name, optional weight (small dim), inline `qty` input (default 1), and a `+` button.
4. Double-click anywhere on a row adds `qty` items. The `+` button does the same.
5. Drag-and-drop: a "drop to add" zone appears as a sticky bar at the bottom of the dialog while a row is being dragged (the dialog itself is a full-popover overlay, so the inventory list is not a drop target). Dropping a row onto that zone adds `qty` items, same as double-click. If `drop` events are unreliable inside the OBR iframe (no drop event within 100 ms of `dragend`), the feature degrades silently — double-click remains the reliable path.
6. Dismiss on ✕, Esc, or click outside the dialog.

### 6.5 Right-click description popover

Anchored next to the row at the cursor position. Contents:

```
┌──────────────────────────────────┐
│ [icon] Item Name                  │
│        rarity · weight            │  ← line omitted if both absent
├──────────────────────────────────┤
│ Description text…                 │
└──────────────────────────────────┘
```

- Suppresses the browser's default `contextmenu`.
- Closes on click-outside, Esc, or another row's right-click.
- Position is clamped via `frame.ts: clampToFrame(rect)` so the popover always stays within `[0, 0, document.documentElement.clientWidth, document.documentElement.clientHeight]`. If the popover is taller than the iframe, its inner content scrolls rather than overflowing.
- Right-clicking the ± buttons or the lock toggle does nothing — the `contextmenu` handler is bound to the row content area only.

### 6.6 Shift+right-click transfer popover

Triggered by `shift+contextmenu` on a row body (works regardless of lock state). Anchored to the row, clamped to iframe.

```
┌──────────────────────────────────┐
│ Transfer  [icon] Item Name        │
│ qty: [ 1 ]   (max <count>)        │
├──────────────────────────────────┤
│   ● → Bob                         │
│   ● → Carla                       │
│   ● → Dan                         │
└──────────────────────────────────┘
```

- Quantity defaults to 1, capped at the row's current count.
- Player list = all inventory records in metadata except the current owner. The GM tab is never a target. From the GM panel, when viewing a player tab, the list excludes that player and the GM tab.
- Each player button: small color dot (their cached color) + cached name.
- Click a name → transfer commits, popover closes. No confirmation.
- Recipient sees a notification via `OBR.notification.show(message, "INFO")`. If the SDK call throws or is missing, falls back to no toast — the recipient sees the new item appear via `onMetadataChange`. `console.warn` on fallback so it's visible in dev tools.
- If the transfer would push recipient over the 5 KB cap: source untouched, recipient untouched, `over-cap` broadcast emitted to GMs.

### 6.7 Search behavior

- Name-only, case-insensitive partial match.
- Categories with zero matches hide their header.
- No results: empty state "No items match 'xxx'" + clear-search button. Esc clears.
- Search applies the same way in the inventory list and the add dialog (separate search states; closing the dialog doesn't carry its search to the list).

### 6.8 Lock toggle interactions

- Single toggle in the inventory header (always visible to the inventory's owner / GM viewing a tab).
- Locked: ± and × buttons hidden from rows; "Add to inventory" footer button hidden.
- Currency inputs and shift+right-click transfers always work regardless of lock state.
- Toggling the lock while the add dialog or transfer popover is open closes them.

## 7. Error handling

| Situation | Behavior |
|---|---|
| Catalog fetch fails | Retry once after 1 s. On second failure, show error banner; lock toggle and gold inputs still work; add dialog disabled. No stale-cache fallback. |
| Item ID in metadata not found in catalog | Row renders with ❓ icon, raw ID as name, no rarity color, "Item missing from catalog" line. ± / × / transfer still work. Export marks `_unresolved: true`. |
| Duplicate ID in catalog | First occurrence wins; warn on dupes. |
| Add-dialog adds an item already in inventory | Counts merge (existing entry's count += dialog qty). |
| Transfer when item already in recipient's inventory | Counts merge by ID. |
| Concurrent metadata writes (same key, two clients) | Last-write-wins per OBR semantics. Per-key serialized write queue prevents same-client races. Cross-client races resolve naturally on the next `onMetadataChange`. |
| Over-cap when adding / incrementing / transferring | Reject at write boundary. Optimistic UI reverts. GM sees modal; player sees nothing. |
| First-time popover open with no record | `ensureRecord` creates empty record. Counts toward cap (~80 B). If cap is already exceeded, the empty record is still created — refusing would lock the player out. |
| OBR notification API unavailable | Fall back silently (recipient sees update via `onMetadataChange`). `console.warn`. |
| Drag-and-drop fails inside iframe | No drop event within 100 ms of dragend → no-op. Double-click remains the reliable path. |
| User toggles lock while dialog/popover open | Dialog/popover closes. |

## 8. Testing

Vitest + JSDOM. Module-level mock of `@owlbear-rodeo/sdk` in `test/_mocks/obr-sdk.ts` exposes an in-memory `Map` for metadata, a broadcasts log, and helpers to set role/id/party for the test under cursor. `beforeEach` resets all state.

### Coverage targets

- **`inventory.ts`** — full coverage of pure ops: add new, add merging, decrement to 0, prune zeros, transfer happy path + validation rejections (qty > count, no recipient record, qty ≤ 0), weight totaling with null/missing weights.
- **`metadata.ts`** — `inventoryByteSize` matches `TextEncoder` byte length on seeded states; write-guard rejects when projected size > cap (state unchanged); accepts at exactly cap; `ensureRecord` idempotent; per-key write queue serializes concurrent writes.
- **`catalog.ts`** — valid item passes; missing required field dropped with warn; unknown rarity tolerated; null/missing optional fields tolerated; duplicate ID (first wins); unknown extra fields preserved.
- **`transfer.ts`** — happy path (source decrements, recipient increments/creates, recipient broadcast emitted); over-cap path (no state change, `over-cap` broadcast targeted at GMs).
- **`export.ts`** — known IDs hydrate; unknown IDs marked `_unresolved`; wrapper has `exportedAt`, `catalogVersion`, `catalogUrl`, `inventories`.
- **`ui-smoke.test.ts`** — player view mounts without throwing; GM view mounts and lists tabs; lock state hides ± and × buttons; search filters by name only (description match doesn't show row).

### Not tested

- Pixel-level layout, exact CSS values, animations.
- HTML5 drag-and-drop interactions (JSDOM support is poor; manual fallback is double-click).
- The OBR notification toast appearing (already mocked).
- Storage meter rendering at exact threshold boundaries (covered indirectly via the threshold helper).

Total: ~35–40 cases. Should run under one second.

## 9. Build and deployment

- `package.json`: same shape as quick-store. Scripts: `dev`, `build` (tsc + vite), `test`, `test:watch`, `preview`.
- `vite.config.ts`: `base: "./"` for relative paths (works under any GitHub Pages subpath); CORS configured for `https://www.owlbear.rodeo`; vitest globals enabled.
- `.github/workflows/deploy.yml`: mirror quick-store, with `npm test` inserted before `npm run build`. Deploys `dist/` to GitHub Pages on push to `main`.
- Catalog lives in a separate repo (e.g., `obr-inv-catalog`) and is Pages-hosted independently. Its URL is the default for the catalog config field on the GM panel.

## 10. Open questions

None at design time. The remaining choices (exact icon for the lock toggle, exact phrasing of error banners, the precise width of the inventory popover) are implementation details that will be worked out during build with simple visual judgment.

## 11. Out of scope (revisit later if needed)

- Equipped/attuned status, item charges, or any in-character mechanics.
- Auto-loot from `obr-quick-store` purchases.
- Per-room catalog overrides or homebrew item editing through the UI.
- Cross-room inventory persistence.
- Multi-language catalog support.
- Mobile-tuned layout (OBR popover sizing handles this acceptably for now).

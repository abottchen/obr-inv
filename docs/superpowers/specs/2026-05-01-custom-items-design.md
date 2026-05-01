# Custom Items — Feature Spec

**Status:** Draft, pending implementation
**Date:** 2026-05-01
**Author:** Adam (with Claude)
**Builds on:** [`2026-05-01-obr-inventory-design.md`](2026-05-01-obr-inventory-design.md)

## 1. Purpose

Let the GM create one-off items mid-session that don't exist in the published catalog ("you pick up a flower"), have those items behave like normal catalog items in every consumer (inventory rows, search, descriptions, transfers, export), and provide a clean post-session promotion path to fold them into the canonical catalog repo.

## 2. Goals and non-goals

### Goals

- GM can create a custom item from a small dialog with name, category, description (required) plus rarity, weight, and image URL (optional).
- Custom items are stored in OBR room metadata so all clients can resolve their IDs and so they survive client refresh.
- Custom items appear in the add-to-inventory dialog (searchable, categorized) and can be added to any player's inventory exactly like a catalog item.
- Custom items can be transferred between players using the existing transfer flow.
- The GM can edit or delete a custom item. Deleting one warns the GM about inventories that still reference it.
- The GM JSON export contains a `customItems` array so the GM has everything needed to promote them into the catalog repo.
- Storage cap accounting is honest: the meter on the GM panel reflects inventories + customs, not just inventories.

### Non-goals

- Player-side creation/edit/delete (v1 is GM-only). The data model leaves room to enable this later behind a config flag with no schema changes.
- An automated promotion pipeline that pushes customs to the catalog repo. Promotion stays a manual workflow: export → paste → deploy → delete from metadata.
- A custom-item template/macro system (rolling tables, generated names, etc.).
- Mid-session image upload. The image field accepts a URL only; placeholder icon shown if absent.
- Cross-room sharing of customs. Each room maintains its own list.

## 3. Decisions

| Topic | Decision |
|---|---|
| Storage key | New single key `com.abottchen.obr-inv/v1/customs`, value is `CustomItem[]`. |
| Schema | Same as `CatalogItem` (id, name, category, icon, description, optional rarity, optional weight). No additional fields in v1 — keeps merged-lookup logic dead-simple. |
| Storage cap | Bump from 5120 → 8192 bytes (8 KB). Meter on the GM panel counts both inventory keys and the customs key against this cap. |
| ID generation | 6-char NanoID, same alphabet as catalog. Generated client-side at create time. Regenerate on collision (probabilistically near-zero). |
| Lookup precedence | When an ID exists in both the remote catalog and the local customs, the catalog wins. Custom is treated as inert until the GM deletes it. |
| Image fallback | If `icon` is empty/missing, the row icon shows `❓` (same fallback as the missing-from-catalog state in existing UI). |
| Player access | GM-only for create/edit/delete. Players see customs in lists/popovers like any other item, can add to their own inventory and transfer. |
| Edit | In-place via the same dialog as create, prefilled. |
| Delete | Confirmation modal listing affected inventories (player name + count). Confirm deletes the custom; affected inventory rows become unresolved (existing fallback). |
| Export | Existing export wrapper gains a `customItems: CatalogItem[]` field. Promoted by hand into the catalog repo's `items.json`. |
| Reconciliation after promotion | None automatic. GM deletes promoted customs from metadata via the same delete UI. The "shadowed by catalog" indicator (see §6.5) surfaces which customs are safe to delete. |
| Concurrency | Customs writes go through the same per-key `enqueue` queue used elsewhere. Cross-client races on the customs key are last-write-wins on OBR's side, which is acceptable for an admin-only concern. |

## 4. Data model

### 4.1 Storage

```ts
// Room metadata key: com.abottchen.obr-inv/v1/customs
type CustomItemsRecord = CustomItem[];
```

`CustomItem` is structurally identical to `CatalogItem`:

```ts
interface CustomItem {
  id: string;            // 6-char NanoID, generated at create time
  name: string;
  category: string;
  icon: string;          // URL or empty
  description: string;
  rarity?: Rarity | null;
  weight?: number | null;
}
```

Empty `icon` resolves to the placeholder at render time; we never substitute a URL into stored data.

### 4.2 Cap

`STORAGE_CAP_BYTES` becomes **8192**. The GM-side meter computes:

```
total = sum(byteLen(metadata[k])) for k in {
  com.abottchen.obr-inv/v1/<playerId>...,
  com.abottchen.obr-inv/v1/customs,
}
```

Yellow at 75%, red at 90% — same thresholds, scaled to the new cap.

### 4.3 Merged catalog lookup

A new module function returns the resolved set used by every UI consumer:

```ts
function resolvedCatalog(
  remote: CatalogItem[], customs: CustomItem[],
): CatalogItem[]
```

Implementation: build a `Map<id, CatalogItem>` from `remote` first, then add customs only if the ID is not already present (catalog wins). Returns `Array.from(map.values())`. This is the array passed wherever the existing code expects `catalog`.

### 4.4 ID collision at creation

At create time the dialog calls a helper:

```ts
function generateUnusedItemId(existing: Set<string>): string {
  while (true) {
    const id = nanoId6();
    if (!existing.has(id)) return id;
  }
}
```

`existing` is built from `remote IDs ∪ custom IDs`. With ~62⁶ ≈ 5.7×10¹⁰ possibilities and at most a few thousand IDs in play, this is a one-iteration loop in practice.

## 5. UI

### 5.1 Entry points

- **Primary**: a "+ Create item" button in the GM-only header of the add-to-inventory dialog (next to the close button). Hidden for players.
- **Secondary**: when search in the add dialog yields no results AND the user is the GM, the empty state shows a "Create '<query>' as custom item" affordance with the name pre-filled. Reduces clicks for the common "I want X, X doesn't exist, make X" path.

### 5.2 Create / edit dialog

Modal overlay, fixed width ~360 px:

```
┌───────────────────────────────────────────┐
│ Create custom item                     ✕  │
├───────────────────────────────────────────┤
│ Name *                                    │
│ [ flower                              ]   │
│                                            │
│ Category *                                │
│ [ Misc                          ▾ ]   ⊕   │  ← typeable; ⊕ creates new
│                                            │
│ Description *                              │
│ ┌────────────────────────────────────┐    │
│ │ A small purple bloom you found by   │    │
│ │ the side of the road.               │    │
│ └────────────────────────────────────┘    │
│                                            │
│ Image URL (optional)                       │
│ [ https://...                         ]   │
│                                            │
│ Rarity (optional)    Weight (optional)    │
│ [ common         ▾]  [ 0          ]       │
│                                            │
│             [ Cancel ]  [ Save ]           │
└───────────────────────────────────────────┘
```

Field rules:

- Name: required, trimmed, ≤120 chars.
- Category: required, trimmed, ≤60 chars. Combobox seeded with categories drawn from `resolvedCatalog()` (catalog + existing customs). User can pick or type a new category.
- Description: required, trimmed, ≤2000 chars (preserves multi-line; renders the same as catalog descriptions).
- Image URL: optional. Light validation (must start with `http://` or `https://` if present). No fetch — we don't validate that it actually returns an image.
- Rarity: optional dropdown of the five rarities + "(none)".
- Weight: optional, non-negative number.

Save is disabled until required fields validate. Save writes through `metadata.ts.writeCustoms(updated)` (which respects the cap guard, same as `writeRecord`).

### 5.3 GM custom-items panel

A small button on the GM tab strip (alongside the download icon) opens a modal listing the room's custom items. For each row:

- Item icon (or placeholder), name, category, count of references in inventories.
- Edit pencil → opens the create/edit dialog prefilled.
- Delete trash → confirmation modal.
- "Shadowed by catalog" pill if the ID also exists in the remote catalog (meaning the catalog version wins on lookup; safe to delete).

Footer of the modal: total count, total bytes, current usage band (green/yellow/red).

### 5.4 Delete confirmation

```
┌───────────────────────────────────────────┐
│ Delete "flower"?                          │
├───────────────────────────────────────────┤
│ This item is currently in:                │
│   • Alice — 1                             │
│   • Carla — 2                             │
│                                            │
│ Their inventory rows will become           │
│ "missing from catalog" until you re-create │
│ the item or promote it to the catalog.     │
│                                            │
│      [ Cancel ]   [ Delete anyway ]        │
└───────────────────────────────────────────┘
```

If the item is in zero inventories, skip the body and show a one-line confirmation.

### 5.5 Player view

No new UI on the player side. Players see customs as ordinary rows. Right-click description and shift+right-click transfer work normally.

## 6. Export behavior

The download wrapper gains a `customItems` field:

```json
{
  "exportedAt": "2026-05-01T19:30:00.000Z",
  "catalogUrl": "https://abottchen.github.io/obr-inv-catalog/items.json",
  "catalogVersion": "<sha1>",
  "customItems": [
    {
      "id": "qZx91A",
      "name": "flower",
      "category": "Misc",
      "icon": "",
      "description": "A small purple bloom...",
      "rarity": null,
      "weight": null
    }
  ],
  "inventories": { /* unchanged */ }
}
```

Inventory hydration uses the merged catalog (catalog + customs) so a custom item's row in a player's inventory still hydrates to a full record at export time. If a custom is missing from the customs array AND the catalog (shouldn't happen if we export both fresh), it falls through to `_unresolved: true` as before.

## 7. Promotion workflow

After the session, the GM:

1. Clicks the download icon on the GM panel. The exported JSON contains `customItems`.
2. Opens `obr-inv-catalog/items.json` and pastes the entries (or a subset — they may want to discard one-offs like "flower" that were narrative beats). The IDs already exist; no regeneration needed.
3. `node scripts/add-item.mjs --validate` to sanity-check.
4. Commits to the catalog repo. Pages redeploys.
5. Back in OBR (next session or sooner), the GM opens the custom-items panel. Items they promoted now show "Shadowed by catalog". GM bulk-deletes those.

This is fully manual but explicit. We're not automating the promotion because the GM should curate which customs become canonical (some are session-specific narrative beats; others are reusable).

## 8. Error handling

| Situation | Behavior |
|---|---|
| Save would push total metadata over 8 KB | `OverCapError` thrown; dialog stays open; an inline error row appears at the top of the dialog: "Storage full — remove items or another player's gear before saving." (GM is the actor; no broadcast needed.) |
| User submits with required field blank | Save button stays disabled. No submission. |
| Image URL fails to load at render time | Browser native fallback (broken image). Row falls back to placeholder via the existing `if (item?.icon)` check (we explicitly check for non-empty string before setting `background-image`). |
| Two GMs simultaneously edit the customs key | Last-write-wins on OBR's side. Per-key write queue protects against same-client races. Cross-client conflicts are rare (typically one GM per room) and recoverable via the next `onMetadataChange` event. |
| GM deletes a custom that's in an active player's inventory | Player's row becomes `❓` "missing from catalog" on next `onMetadataChange`. No data loss in their inventory record (the ID + count remain). Re-creating the item with the same ID restores resolution. |
| Network blip during save | The write is rejected; dialog shows a toast "Couldn't save — try again." Form state is preserved. |

## 9. Module changes (high-level)

- `src/types.ts` — add `CustomItem = CatalogItem` (alias for clarity), `CustomItemsRecord = CustomItem[]`.
- `src/constants.ts` — bump `STORAGE_CAP_BYTES` to 8192. Add `CUSTOMS_KEY`.
- `src/metadata.ts` — add `getCustoms()`, `writeCustoms(items)`, both going through the existing write queue and cap guard. Update `inventoryByteSize()` → rename to `roomDataByteSize()` so it reflects what it actually measures (or keep the name and document the broadened scope).
- `src/catalog.ts` — add `resolvedCatalog(remote, customs)` and use it everywhere a catalog array is consumed by UI/export. Update consumers accordingly.
- `src/customs.ts` *(new)* — pure helpers: `addCustom`, `updateCustom`, `removeCustom`, `findReferences(id, allRecords)` for the delete confirmation.
- `src/ui-customs-dialog.ts` *(new)* — create/edit form.
- `src/ui-customs-panel.ts` *(new)* — GM custom-items list with edit/delete affordances.
- `src/ui-add-dialog.ts` — GM-only "+ Create item" button + empty-state CTA.
- `src/ui-gm.ts` — wire up the customs panel button on the tab strip; subscribe to customs metadata; pass merged catalog to `mountShell`.
- `src/ui-player.ts` — subscribe to customs metadata; pass merged catalog to `mountShell` on each rerender.
- `src/export.ts` — include `customItems` in the export wrapper.
- `src/main.ts` — load customs at boot alongside the remote catalog.

Total new files: 3. Total touched files: ~7. Comparable to a single subsystem in the original spec.

## 10. Tests

- **`customs.test.ts`** — pure ops on `CustomItem[]`: add, update (id-stable), remove, `findReferences` (counts entries across a fake records map).
- **`catalog.test.ts`** — extend with `resolvedCatalog` cases: catalog wins on collision, customs added when absent from catalog, identity (no aliasing of the catalog array).
- **`metadata.test.ts`** — `writeCustoms` cap-guarded same as `writeRecord`; `roomDataByteSize` (or renamed equivalent) includes the customs key.
- **`export.test.ts`** — `customItems` populated from metadata; inventory hydration uses merged catalog (custom item resolves to full hydrated row in `inventories.<pid>.items`).
- **`ui-customs-dialog.test.ts`** *(smoke)* — form mounts, validation disables save until required fields filled, save calls the metadata writer.

Approximately 8–12 new test cases.

## 11. Open questions

None blocking. A couple of items worth a follow-up conversation if/when we do v2:

- Player-side custom creation. Trivial to enable; the gating concern is whether customs should be marked with their creator (audit trail) or stay anonymous. Probably anonymous — match the existing transfer model.
- Custom item edit history / undo. Not in scope.
- A "categories" management UI (rename, merge, reorder). Not in scope; the combobox handles 95% of the need.

## 12. Out of scope

- Automated promotion to the catalog repo (PR-creation flow, pushed to a remote git).
- Image upload to a hosting service.
- Custom-item templates / generators / macros.
- Per-room or per-campaign branching of customs.
- Cross-room sync.

---
name: promote-custom-items
description: >-
  Promote per-room custom inventory items into the published catalog
  (public/data/items.json) for the obr-inv extension. Use this whenever the
  user wants to "promote", "convert", "graduate", "move", or "bake in" one or
  more custom items so they become part of the shared catalog — e.g. "convert
  these custom items to the standard item db", "promote the Amulet of Torm to
  the catalog", "make my custom items permanent". Reads the live OBR scene's
  customs metadata via the obr-mcp-server, adds the chosen items to the catalog
  reusing their existing ids (so player inventories don't break), validates, and
  opens a draft PR. Stops at the draft PR — the metadata cleanup happens
  automatically on the next GM boot.
---

# Promote custom items into the catalog

## What this does and why it's shaped this way

In the obr-inv extension, inventory items come from two places:

- **The catalog** (`public/data/items.json`) — static, shared across every room,
  baked into the deployed build.
- **Customs** — per-room items the GM created on the fly, stored in room
  metadata at `com.abottchen.obr-inv/v1/customs`. They only exist in that one
  room and count against the room's storage cap.

"Promotion" means moving a custom into the catalog so it's shared everywhere and
no longer burns room storage. The codebase has a designed path for this (called
"§6.1 promotion" in `src/catalog.ts` / `src/customs.ts`):

1. `resolvedCatalog()` builds an in-memory union of catalog ∪ customs, where the
   **catalog wins on id collision**. So once a custom's id appears in the
   published catalog, the catalog entry takes over.
2. On the next GM boot, `reconcileCustoms()` notices that id is now in the
   catalog and **automatically deletes it from the room's customs metadata**.

The single most important consequence: **promote each item under the id it
already has, never a fresh nano-id.** Player and NPC inventory records reference
items by id (e.g. a player record holds `["q1lrxl", 1]`). Reuse the id and every
existing holding keeps resolving — now against the catalog instead of customs.
Mint a new id and you orphan every reference to that item. This is the whole
reason `scripts/add-item.mjs "<name>"` is the *wrong* tool here — it generates a
fresh id and pulls from 5etools. You add these by hand, keeping the id.

This skill stops once a draft PR is open. You do **not** touch the customs
metadata — reconciliation removes it for you after the PR merges and Pages
redeploys. Editing customs by hand before deploy would just race the catalog and
risk orphaning holdings during the gap.

## Steps

### 1. Read the live customs from the scene

Use the obr-mcp-server to read room metadata and pull out
`com.abottchen.obr-inv/v1/customs`:

```
mcp__obr-mcp-server__get_room_metadata
```

The value looks like `{ "w": "<writer-nonce>", "items": [ ...custom items... ] }`.
Each item has `id`, `name`, `category`, `icon`, `description`, and usually
`rarity` and `weight`. If `items` is empty, there's nothing to promote — tell the
user and stop.

If the MCP server isn't connected (no live scene), ask the user to paste the
customs block or name the items + ids instead. Don't invent items.

### 2. Confirm which items to promote

List the custom items you found (name + id) and confirm the selection. Default
to **all of them** unless the user named specific ones. Promoting a subset is
fine — leave the rest in customs.

### 3. Check for id collisions

Before adding anything, make sure each id you're about to promote isn't *already*
in the catalog (these ids share the catalog's nano-id alphabet, so a pre-existing
collision is rare but possible and would mean you'd be silently shadowing a
different item):

```bash
grep -nE '"(<id1>|<id2>|<id3>)"' public/data/items.json
```

Expect no matches. If an id *does* already exist in the catalog, stop and surface
it — that item may already be promoted, or it's a genuine collision that needs a
human decision.

### 4. Add the items to the catalog, reusing their ids

`public/data/items.json` is a flat JSON array. Append one object per promoted
item to the end of the array (before the closing `]`), keeping the existing id.

Catalog field rules (from `parseCatalog` in `src/catalog.ts`):

- **Required, non-empty strings:** `id`, `name`, `category`, `icon`,
  `description`.
- **`rarity`:** keep it if present; it must be one of the values in `RARITIES`
  (`src/constants.ts`). `null` is tolerated but the convention is to use a real
  rarity or omit.
- **`weight`:** the catalog only keeps it when it's a finite number. Customs often
  carry `"weight": null` — **drop the field entirely** in that case rather than
  writing `null`. Keep it when it's a real number.

Example — a custom carrying `"weight": null` becomes a catalog entry with no
`weight` field:

```json
{
  "id": "q1lrxl",
  "name": "Amulet of Torm",
  "category": "Other",
  "icon": "https://images.owlbear.rodeo/.../d6d9a6c1-....webp",
  "description": "An amulet worth 25gp",
  "rarity": "common"
}
```

Match the file's existing indentation (2 spaces) so the diff stays clean.

### 5. Validate

```bash
node scripts/add-item.mjs --validate
```

This checks every entry has the required string fields and that there are no
duplicate ids. It must print `OK: N items, no problems.` before you proceed. If
it reports a duplicate id, that's almost certainly a collision from step 3 that
slipped through — fix it before opening a PR.

### 6. Open a draft PR

Hand off to the **push-pr** skill to branch, stage **only**
`public/data/items.json`, commit, push, and open the draft PR. Don't reinvent the
git steps here.

Give push-pr (or whoever writes the commit) this context so the message explains
the *why*:

- These items were per-room customs being promoted into the shared catalog.
- They were added **reusing their existing ids** so inventory references survive.
- `weight: null` fields were dropped.
- After deploy, the next GM boot's `reconcileCustoms` sweeps the now-duplicate
  ids out of the room's customs metadata automatically — no manual cleanup.

Commit-message constraint for this repo: **never reference Claude** in the commit
message (per the repo's commit convention). Use a `feat:` conventional-commit
prefix to match recent history.

### 7. Report back and note the follow-up

Give the user the PR URL and a one-line summary. Then remind them of the part
this skill deliberately does *not* do:

> After this merges and Pages redeploys, the three ids will live in the catalog.
> The next time a GM opens the extension in that room, `reconcileCustoms` will
> remove them from the room's customs metadata automatically. Existing holdings
> keep working throughout because the ids are unchanged.

## Quick checklist

- [ ] Read customs from live scene (or got them from the user)
- [ ] Confirmed which items to promote
- [ ] Verified no id collisions in the existing catalog
- [ ] Added entries to `items.json` **with original ids**, dropped `weight: null`
- [ ] `add-item.mjs --validate` prints OK
- [ ] Draft PR opened via push-pr (only `items.json` staged, no Claude in message)
- [ ] Told the user the PR URL + the auto-reconcile follow-up

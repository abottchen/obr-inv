---
name: add-catalog-item
description: >-
  Author a brand-new item in the obr-inv published catalog
  (public/data/items.json), minting a fresh id. Use this whenever the user wants
  to "add", "create", or "make" a new inventory/catalog item that does not
  already exist — e.g. "add a Command Amulet to the catalog", "grab the image
  from the Vorn Amulet prop and add it as an item", "add the Flame Tongue from
  the DMG", "make a new item for this homebrew ring". Pulls stats from the local
  5etools data (../5etools-src) or from details the user provides, takes the icon
  from a live OBR scene prop or 5e.tools art, cleans 5etools {@...} markup, and
  maps rarity/category to the catalog's rules — interviewing the user for
  anything it cannot determine rather than guessing. Then validates, tests, and
  builds, and hands off to push-pr. Do NOT use this to promote existing room
  customs (that is promote-custom-items, which reuses ids) or to edit an item
  that is already in the catalog.
---

# Add a brand-new catalog item

## What this does, and how it differs from the neighbors

This authors a **new** entry in `public/data/items.json` — the static, shared
item catalog baked into the deployed build. It mints a **fresh nano-id**, because
nothing references this item yet.

Know the two adjacent tools so you don't reach for the wrong one:

- **`promote-custom-items`** moves an *existing* per-room custom into the catalog
  and deliberately **reuses that item's id** so player holdings keep resolving.
  If the item already lives in the room's customs, use that skill, not this one.
- **`scripts/add-item.mjs "<name>"`** looks an item up in 5etools and appends it,
  but it writes a 5e.tools icon, leaves `{@creature …}` markup in the text, passes
  through rarities the catalog rejects (like `unknown (magic)`), and mis-maps some
  categories. This skill's `lookup.mjs` does the read-only version of that lookup
  *with those problems already fixed*, then lets you review before writing.

## The core principle: interview, don't invent

An item entry has fields the sources can pin down (name, the rules text of a real
D&D item, its weight) and fields they often can't (which artwork to use, what
rarity a "magic (unknown rarity)" item should be, whether an "Other"-typed item
reads better as a Wondrous Item, the whole description of a homebrew item). D&D
stats and campaign details are the user's to supply — a plausible-looking
invented stat is worse than a question.

So whenever a field is missing or ambiguous, **ask**. Prefer a short structured
question when the choices are discrete (rarity, category, which of several
matched sources), and a plain ask when it's free text (a homebrew description, an
image URL). `lookup.mjs` prints `NOTES:` to stderr calling out exactly which
fields need your judgment — treat each note as a prompt to confirm with the user.

## Steps

### 1. Get the stats

**If it's a published D&D item**, look it up (read-only, writes nothing):

```bash
node .claude/skills/add-catalog-item/scripts/lookup.mjs "<item name>" [SOURCE_CODE]
```

`SOURCE_CODE` is optional (e.g. `XMM`, `XPHB`, `XDMG`) and only matters when the
same name exists in several books. stdout is a candidate entry (no id); stderr is
the `NOTES:` list of things to confirm. If it prints "Not found", that's normal —
fall through to the next paragraph. Two common reasons for a miss: it's homebrew,
or it's a magic **weapon/armor** (Flame Tongue, +1 Longsword, Armor of
Resistance), which 5etools stores as *generic variants* rather than flat named
items, so an exact-name lookup won't hit. Either way, get the details from the
user instead.

**If it's homebrew / campaign-specific** (not in 5etools), don't invent anything.
Ask the user for the description text and rarity, and build the entry from that.
Normalize pasted text to straight ASCII apostrophes (`'`), which is the catalog's
convention — curly `’` would be the only one in the file.

### 2. Get the icon

Two normal sources; pick based on what the user said:

- **A live scene prop** (the common reason to use this skill). Read the prop and
  take its image URL:
  ```
  mcp__obr-mcp-server__get_items   (name: "<prop name>")
  ```
  Use the returned `image.url` as the `icon`. If several props match, or the MCP
  server isn't connected, ask the user which prop / paste the URL.
- **5e.tools art** — the default `lookup.mjs` fills in. Fine when the user didn't
  reference a scene prop and just wants the book's artwork.

If neither is clearly indicated, ask which the user wants.

### 3. Finalize the entry (interview the gaps)

Reconcile the candidate against these field rules, asking the user wherever a
note flagged ambiguity:

| Field | Rule | When to ask the user |
| --- | --- | --- |
| `rarity` | Must be one of `RARITIES` in `src/constants.ts` (`common`, `uncommon`, `rare`, `very rare`, `legendary`) or omitted. 5etools values like `unknown (magic)`, `artifact`, `varies` are **not** valid. | Whenever the source rarity isn't one of the valid five — ask which to use, or to leave it off. |
| `category` | A free string, but match an existing one (see the catalog for the set: `Armor`, `Weapon`, `Wondrous Item`, `Other`, `Consumable`, `Tool`, …). | When the type is `OTH`/ambiguous — confirm e.g. Wondrous Item vs Other. |
| `icon` / `description` | Required, non-empty. | When there's no clear image source, or a homebrew item has no description yet. |
| `weight` | Keep only if it's a real number; otherwise omit (never write `null`). | Rarely — ask only if the user cares about encumbrance and it's unknown. |

Read the finished `description` back to yourself: strip any leftover `{@...}`
markup the cleaner missed, and sanity-check that a table or bulleted ability
didn't flatten into an unreadable run-on.

### 4. Append it

Write the finalized entry (an object with `name`, `category`, `icon`,
`description`, and `rarity`/`weight` as applicable — no `id` needed) to a temp
file, then:

```bash
node .claude/skills/add-catalog-item/scripts/append.mjs <path-to-entry.json>
```

It mints a fresh unique id, drops null rarity/weight, blocks a duplicate name,
rejects an invalid rarity, and writes with the catalog's exact formatting so the
diff is just the one new object. It refuses if the name already exists — if you
hit that, the item is already in the catalog and this is the wrong skill.

### 5. Verify

Run all three; each must pass before you call it done:

```bash
node scripts/add-item.mjs --validate    # required fields + no dup ids
npm test                                 # nothing else broke
npm run build                            # catalog still builds into dist/
```

### 6. Report and hand off

Show the user the final entry and the validation/test/build results. This skill
**stops at the validated edit** — it does not open a PR. Tell the user the change
is a working edit to `public/data/items.json` and that they can run **`/push-pr`**
(the push-pr skill) to branch, commit, and open a draft PR when they're ready.

## Quick checklist

- [ ] Stats from `lookup.mjs` (published) or from the user (homebrew) — nothing invented
- [ ] Icon set from the named scene prop's `image.url`, from 5e.tools, or from a URL the user gave
- [ ] Every ambiguous field (rarity, category, missing image/description) confirmed with the user
- [ ] Description cleaned of `{@...}` markup, straight apostrophes
- [ ] Appended with `append.mjs` (fresh id, clean diff)
- [ ] `add-item.mjs --validate`, `npm test`, and `npm run build` all pass
- [ ] Told the user it's a working edit and pointed them at `/push-pr`

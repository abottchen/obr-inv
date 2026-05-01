# OBR Inventory

Per-player inventory tracker for Owlbear Rodeo.

## Features

- Each player sees their own inventory; the GM sees all of them via tabs.
- Collapsible categories with animated expand/collapse, name-only search.
- Right-click any row → description popover (rarity-tinted, with icon, weight, description).
- Shift+right-click any row → transfer popover (other players, including offline ones via cached name + color).
- Single global lock toggle gates ± / × on rows; currency is always editable and accepts `+45` / `-20` deltas.
- Color-coded denominations on the gold strip (pp/gp/sp/cp).
- GM-only "Create custom item" for one-off items not in the catalog (e.g., "you find a flower"); they live in room metadata, behave like normal items, and auto-clean up after promotion to the canonical catalog.
- 5 KB room-metadata cap shared between inventories and customs, with a GM-side meter and over-cap modal.
- GM-only JSON backup download — fully hydrated against the catalog, includes custom items.

## How it works

The extension is a single popover, role-aware: one bundle, one boot path, the UI it mounts depends on whether the local user is a GM or a player. State lives in three places — a JSON catalog served from the same origin as the extension, OBR's room metadata for per-player gear and shared customs, and an ephemeral in-memory merge of the two:

```mermaid
flowchart LR
  subgraph repo["public/data (served by Pages)"]
    JSON["items.json<br/>CatalogItem[]"]
  end
  subgraph room["OBR Room metadata"]
    P1["v1/&lt;playerId-A&gt;<br/>PlayerInventoryRecord"]
    P2["v1/&lt;playerId-B&gt;<br/>PlayerInventoryRecord"]
    Customs["v1/customs<br/>CustomItem[]"]
  end
  subgraph runtime["In-memory at runtime"]
    Resolved["resolvedCatalog<br/>= JSON ∪ customs<br/>(catalog wins on id collision)"]
  end
  JSON --> Resolved
  Customs --> Resolved
  Resolved --> UI["UI render<br/>(player or GM view)"]
  P1 --> UI
  P2 --> UI
```

A player's view only mounts their own inventory record. The GM's view mounts a tab strip over every record in the room plus their own, with a storage-cap meter, a JSON download icon, and a customs management panel.

## Dev

```bash
npm install
npm run dev      # vite dev server (CORS configured for owlbear.rodeo)
npm test         # vitest run (85 tests)
npm run build    # tsc + vite build → dist/
```

### Testing in OBR locally (without deploying)

1. `npm run dev` (vite serves on `http://localhost:5173`). The catalog ships in `public/data/items.json` and is served by the same origin — no separate hosting is needed.
2. In OBR, Settings → Extensions → Add Custom Extension, paste `http://localhost:5173/manifest.dev.json`. That manifest points the icon and popover URLs at localhost; edits to source and to `public/data/items.json` both hot-reload.
3. The production `manifest.json` (pointing at Pages) stays unchanged for real deploys.

### Item catalog

Items live in `public/data/items.json`. Each entry follows the schema documented in `docs/superpowers/specs/2026-05-01-obr-inventory-design.md` §5.1. Add a new item:

```bash
node scripts/add-item.mjs              # prints a stub with a fresh nano-id
node scripts/add-item.mjs --validate   # checks required fields, dupes
```

The relative `DEFAULT_CATALOG_URL` (`./data/items.json` in `src/constants.ts`) resolves against whatever URL loaded the extension, so the same code works in dev (localhost) and prod (GitHub Pages).

### Custom items (GM)

The GM can spin up an item mid-session without touching the catalog repo. Click "+ Create item" in the inventory shell footer (visible only to GMs), fill in a name + category + description (rarity / weight / image URL are optional), and save. The item is stored under `com.abottchen.obr-inv/v1/customs` in room metadata and resolved into a unified catalog at runtime, so it shows up in search, descriptions, transfers, and the export.

Promotion to the canonical catalog is a deliberately manual workflow, but the cleanup is automatic:

```mermaid
flowchart LR
  Create["GM creates custom<br/>(shell footer button)"] --> Stored["v1/customs<br/>in room metadata"]
  Stored --> Used["Players use it<br/>like any other item"]
  Used --> Export["GM downloads<br/>JSON backup"]
  Export --> Paste["GM pastes into<br/>public/data/items.json"]
  Paste --> Deploy["Push to main<br/>→ Pages redeploys"]
  Deploy --> Reconcile["Next GM boot:<br/>auto-removes promoted<br/>customs from metadata"]
```

Spec: `docs/superpowers/specs/2026-05-01-custom-items-design.md`.

## Deploy

GitHub Actions deploys `dist/` to Pages on push to `main`. Manifest URL:

```
https://abottchen.github.io/obr-inv/manifest.json
```

Add the manifest URL to OBR via Settings → Extensions → Add Custom Extension.

CI for PRs and feature branches runs `npm test` + `npm run build` (see `.github/workflows/test.yml`).

## Known limitations

- No in-app override for `DEFAULT_CATALOG_URL`. The spec calls for a GM-panel field to point at a different catalog per room; that UI hasn't been built yet. Until then, the only way to use a non-default catalog is to write the override directly to room metadata under `com.abottchen.obr-inv/config = { catalogUrl: "..." }`.
- Drag-and-drop in the Add dialog is best-effort — if OBR's iframe drops the drop event, double-click is the reliable fallback.

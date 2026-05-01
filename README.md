# OBR Inventory

Per-player inventory tracker for Owlbear Rodeo.

## Features

- Each player sees their own inventory; the GM sees all of them via tabs.
- Collapsible categories, name-only search.
- Right-click any row → description popover (icon, rarity, weight, description).
- Shift+right-click any row → transfer popover (other players, including offline).
- Single global lock toggle gates ± / × editing; gold (pp/gp/sp/cp) is always editable.
- 5 KB room-metadata cap with a GM-side meter and over-cap modal.
- GM-only download icon exports a hydrated JSON backup.

## Dev

```bash
npm install
npm run dev      # vite dev server (CORS configured for owlbear.rodeo)
npm test         # vitest run
npm run build    # tsc + vite build → dist/
```

### Testing in OBR locally (without deploying)

The extension can be loaded into OBR straight off the vite dev server:

1. `npm run dev` (vite serves on `http://localhost:5173`). The catalog
   ships in `public/data/items.json` and is served by the same origin —
   no separate hosting is needed.
2. In OBR, Settings → Extensions → Add Custom Extension, paste
   `http://localhost:5173/manifest.dev.json`. That manifest points the
   icon and popover URLs at localhost; edits to source and to
   `public/data/items.json` both hot-reload.
3. The production `manifest.json` (pointing at Pages) stays unchanged for
   real deploys.

### Item catalog

Items live in `public/data/items.json`. Each entry follows the schema
documented in `docs/superpowers/specs/2026-05-01-obr-inventory-design.md`
§5.1. Add a new item:

```bash
node scripts/add-item.mjs              # prints a stub with a fresh nano-id
node scripts/add-item.mjs --validate   # checks required fields, dupes
```

The relative `DEFAULT_CATALOG_URL` (`./data/items.json` in
`src/constants.ts`) resolves against whatever URL the extension was
loaded from, so the same code works in dev (localhost) and prod
(GitHub Pages).

## Deploy

GitHub Actions deploys `dist/` to Pages on push to `main`. Manifest URL:

`https://abottchen.github.io/obr-inv/manifest.json`

Add the manifest URL to OBR via Settings → Extensions → Add Custom Extension.

## Known limitations (v0.1)

- No in-app override for `DEFAULT_CATALOG_URL`. The spec calls for a GM-panel
  field to point at a different catalog per room; that UI hasn't been built
  yet. Until then, the only way to use a non-default catalog is to write the
  override directly to room metadata under
  `com.abottchen.obr-inv/config = { catalogUrl: "..." }`.
- Drag-and-drop in the Add dialog is best-effort — if OBR's iframe drops the
  drop event, double-click is the reliable fallback.

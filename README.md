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

Catalog repo: <https://github.com/abottchen/obr-inv-catalog> (Pages-hosted JSON).

## Deploy

GitHub Actions deploys `dist/` to Pages on push to `main`. Manifest URL:

`https://abottchen.github.io/obr-inv/manifest.json`

Add the manifest URL to OBR via Settings → Extensions → Add Custom Extension.

## Known limitations (v0.1)

- The catalog URL is currently configured via the default in `src/constants.ts`
  (`DEFAULT_CATALOG_URL`). The spec calls for a GM-panel UI to override it per
  room; that UI hasn't been built yet. Until then, point the constant at your
  catalog repo and rebuild, or write the override directly to room metadata
  under `com.abottchen.obr-inv/config = { catalogUrl: "..." }`.
- Drag-and-drop in the Add dialog is best-effort — if OBR's iframe drops the
  drop event, double-click is the reliable fallback.

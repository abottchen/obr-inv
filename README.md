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

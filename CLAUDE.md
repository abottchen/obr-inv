# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # vite dev server (CORS configured for owlbear.rodeo)
npm test             # vitest run (all tests)
npm run test:watch   # vitest in watch mode
npx vitest run test/atomic.test.ts   # single test file
npm run build        # tsc + vite build → dist/
node scripts/add-item.mjs              # print a catalog stub with a fresh nano-id
node scripts/add-item.mjs --validate   # check required fields and dupes
```

### Local OBR testing

1. `npm run dev` — vite serves on localhost:5173, including `public/data/items.json`.
2. In OBR: Settings → Extensions → Add Custom Extension → paste `http://localhost:5173/manifest.dev.json`.
3. Source and catalog edits hot-reload. The production `manifest.json` is unchanged.

## Architecture

Owlbear Rodeo (OBR) extension — a single popover that renders a role-aware inventory UI (player vs GM) inside OBR's iframe. No framework; vanilla TypeScript with imperative DOM construction.

### Data flow

Three data sources merge at runtime:

1. **Catalog** (`public/data/items.json`) — static item definitions served from the same origin. Loaded once at boot via `fetchCatalog()`.
2. **Room metadata** (OBR API) — per-player inventory records at `com.abottchen.obr-inv/v1/<playerId>` and shared custom items at `com.abottchen.obr-inv/v1/customs`. This is the only mutable state.
3. **Resolved catalog** — in-memory union of catalog + customs (catalog wins on ID collision). Built at boot, updated when customs change.

### Atomic writes (`src/atomic.ts`)

All metadata writes go through `atomicUpdate` / `atomicMultiUpdate`. These stamp a writer nonce, wait for an echo via `onMetadataChange`, and retry with backoff on conflict. A per-tab serial queue prevents concurrent writes from the same client. Transfers use `atomicMultiUpdate` to update sender + recipient in a single operation.

A 5 KB cap (`STORAGE_CAP_BYTES`) is enforced pre-write by projecting the post-write metadata size.

### Source organization

- **Data layer**: `types.ts`, `constants.ts`, `catalog.ts`, `inventory.ts` (pure mutation functions), `metadata.ts` (OBR read/write helpers), `atomic.ts`, `transfer.ts`, `customs.ts`
- **UI layer**: `ui-player.ts` / `ui-gm.ts` mount the role-specific view. `ui-shell.ts` is the shared chrome (header, search, view toggle). `ui-list.ts` and `ui-grid.ts` render the two view modes. `ui-description.ts`, `ui-add-dialog.ts`, `ui-transfer.ts`, `ui-customs-*.ts` are modal surfaces. `ui-mutate.ts` wraps writes in an overlay. `ui-feedback.ts` / `ui-overlay.ts` handle visual feedback.
- **Styles**: `styles.ts` (base), `styles-list.ts`, `styles-dialog.ts`, `styles-feedback.ts`, `styles-overlay.ts` — CSS-in-JS strings injected at boot.
- **Entry**: `main.ts` — `OBR.onReady` boot, role detection, catalog fetch, customs reconciliation, view mount.

## Testing

Tests in `test/` use vitest + jsdom. The OBR SDK is mocked via `test/_mocks/obr-sdk.ts`, which provides an in-memory metadata store with synchronous change notifications.

**Mock import ordering matters**: `test/_mocks/obr-sdk.ts` calls `vi.mock("@owlbear-rodeo/sdk", ...)`, so it must be imported before any `src/` module that transitively imports the SDK. Tests that exercise atomic writes must call `__atomicTestHooks.reset()` in `beforeEach` to clear the echo tracker and serial queue.

Use `__testHooks` (from the mock) to set role, player identity, party, and to reset the metadata store between tests.

## Gotchas

- **`escapeHtml()` for all `innerHTML`**: every string interpolated into `innerHTML` must go through `escapeHtml()` from `src/escape.ts`. Item names and descriptions come from user-authored JSON / GM custom items and are not pre-sanitized.
- **`withOverlay` for user-facing writes**: mutations triggered by user interaction should use `withOverlay()` (`src/ui-mutate.ts`), which shows a spinner, wires up abort/cancel, and translates `ConflictError` / `AbortError` into OBR notifications. Boot-time or background writes skip it.
- **`pruneZeros` on write**: `writeRecord` in `metadata.ts` automatically prunes zero-count entries before persisting. Decrementing to 0 is intentional (ghost row), but the zero is stripped on the next write that touches that record.

## Git hooks (forbidden-name guard)

Player inventory records in the OBR room metadata carry real player names. This
is a public repo, so those names must never land in a commit message, the
catalog, or any tracked file. `.githooks/` holds versioned hooks that enforce
this:

- `pre-commit` — rejects staged changes that introduce a forbidden name.
- `commit-msg` — rejects a commit message containing one.
- `pre-push` — rejects any pushed commit whose message or content matches
  (backstop for commits made before the hooks, or with `--no-verify`).

The pattern lives in `.githooks/_forbidden-names.sh` as a regex over the
players' first names: `\b(Simon|Steve|Quinn|Mike|David)[[:space:]]+[A-Z]...`.
Bare first names are allowed; a first name followed by a capitalized word (a
likely full name) is refused. Update the alternation when a new player joins.

`core.hooksPath` is per-clone and not checked in — **activate the hooks after
cloning**:

```bash
git config core.hooksPath .githooks
```

Bypass for a single commit/push (use sparingly): `--no-verify`.

## Deploy

GitHub Actions deploys `dist/` to Pages on push to `main`. CI on PRs runs `npm test` + `npm run build`.

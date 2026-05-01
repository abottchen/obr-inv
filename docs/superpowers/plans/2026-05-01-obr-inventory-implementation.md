# OBR Inventory Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-popover Owlbear Rodeo extension that lets players view and edit their own inventory and lets the GM view, edit, and back up everyone's inventories — with name-only search, collapsible categories, lock-gated ± editing, right-click descriptions, shift+right-click transfers, gold strip, weight readout, and a 5 KB room-metadata cap.

**Architecture:** Vite + TypeScript, single popover with role-aware bootstrap. All persistent state lives in OBR room metadata under per-player keys (`com.abottchen.obr-inv/v1/<playerId>`) as `[itemId, count][]` tuple-packed records plus a `{pp,gp,sp,cp}` currency object. The catalog (with optional rarity/weight) is fetched as a JSON file from a separate public GitHub repo. CSS-in-JS injected at runtime (no preprocessor). Vitest with a JSDOM environment and an in-memory mock of `@owlbear-rodeo/sdk` covers the pure logic and a smoke layer for the UI.

**Tech Stack:** TypeScript 5.8, Vite 6, Vitest 4, `@owlbear-rodeo/sdk` 3.1, GitHub Pages via Actions.

**Spec:** [`docs/superpowers/specs/2026-05-01-obr-inventory-design.md`](../specs/2026-05-01-obr-inventory-design.md)

---

## File map

```
obr-inv/
├── .github/workflows/deploy.yml
├── index.html
├── public/
│   ├── manifest.json
│   └── icon.svg
├── src/
│   ├── main.ts                ← role-aware bootstrap
│   ├── catalog.ts             ← fetch + validate + cache
│   ├── metadata.ts            ← OBR room-metadata IO + write queue + cap guard + ensureRecord
│   ├── inventory.ts           ← pure ops on PlayerInventoryRecord
│   ├── transfer.ts            ← transfer orchestration + over-cap broadcast
│   ├── export.ts              ← GM JSON download (hydrated)
│   ├── frame.ts               ← clampToFrame helper for popovers
│   ├── ui-shell.ts            ← search + lock + footer + gold strip
│   ├── ui-list.ts             ← collapsible categories + rows + ± + ×
│   ├── ui-description.ts      ← right-click popover
│   ├── ui-add-dialog.ts       ← Add to inventory overlay
│   ├── ui-transfer.ts         ← shift+right-click transfer popover
│   ├── ui-player.ts           ← player view assembly
│   ├── ui-gm.ts               ← tabs + meter + download + over-cap modal
│   ├── styles.ts
│   ├── styles-list.ts
│   ├── styles-dialog.ts
│   ├── types.ts
│   └── constants.ts
├── test/
│   ├── _mocks/obr-sdk.ts
│   ├── catalog.test.ts
│   ├── inventory.test.ts
│   ├── metadata.test.ts
│   ├── transfer.test.ts
│   ├── export.test.ts
│   └── ui-smoke.test.ts
├── package.json
├── vite.config.ts
└── tsconfig.json
```

The catalog (separate `obr-inv-catalog` repo) is bootstrapped at the very end of the plan with a small seed JSON. During development, the extension defaults to that URL via `constants.ts` and is configurable via the GM panel later.

---

## Task 1: Scaffold the project (package, tsconfig, vite, vitest)

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `public/icon.svg`
- Create: `public/manifest.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "obr-inv",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "preview": "vite preview"
  },
  "dependencies": {
    "@owlbear-rodeo/sdk": "^3.1.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "jsdom": "^25.0.0",
    "typescript": "~5.8.0",
    "vite": "^6.3.0",
    "vitest": "^4.1.1"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "outDir": "dist"
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, "index.html") },
    },
  },
  server: {
    cors: { origin: "https://www.owlbear.rodeo" },
  },
  test: {
    globals: true,
    environment: "jsdom",
  },
});
```

- [ ] **Step 4: Create `index.html` shell**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>OBR Inventory</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `public/icon.svg`** (any simple inventory-ish glyph; placeholder OK)

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="3" y="6" width="18" height="14" rx="2"/>
  <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
  <path d="M3 12h18"/>
</svg>
```

- [ ] **Step 6: Create `public/manifest.json`**

```json
{
  "name": "Inventory",
  "description": "Per-player inventory tracker for tabletop RPG sessions",
  "version": "0.1.0",
  "manifest_version": 1,
  "author": "abottchen",
  "icon": "https://abottchen.github.io/obr-inv/icon.svg",
  "action": {
    "title": "Inventory",
    "icon": "https://abottchen.github.io/obr-inv/icon.svg",
    "popover": "https://abottchen.github.io/obr-inv/index.html",
    "height": 520,
    "width": 380
  }
}
```

- [ ] **Step 7: Install dependencies and verify build**

Run: `npm install && npm run build`
Expected: build succeeds (TS may complain about empty `src/main.ts` until Task 2 — if so, create an empty `src/main.ts` with `export {};` as a stub for now).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html public/
git commit -m "chore: scaffold vite+ts+vitest project with OBR manifest"
```

---

## Task 2: SDK mock and first smoke test

**Files:**
- Create: `test/_mocks/obr-sdk.ts`
- Create: `test/sanity.test.ts`

- [ ] **Step 1: Write the SDK mock**

```ts
// test/_mocks/obr-sdk.ts
import { vi } from "vitest";

const store = new Map<string, unknown>();
const broadcasts: Array<{ channel: string; data: unknown; targets?: string[] }> = [];
let role: "PLAYER" | "GM" = "PLAYER";
let selfId = "player-self";
let selfName = "Self";
let selfColor = "#888888";
let players: Array<{ id: string; name: string; color: string; role: "PLAYER" | "GM" }> = [];
const metadataListeners: Array<(m: Record<string, unknown>) => void> = [];

export const OBR = {
  isAvailable: true,
  ready: vi.fn(async (cb: () => void) => cb()),
  room: {
    getMetadata: vi.fn(async () => Object.fromEntries(store)),
    setMetadata: vi.fn(async (patch: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) store.delete(k);
        else store.set(k, v);
      }
      const snapshot = Object.fromEntries(store);
      metadataListeners.forEach((l) => l(snapshot));
    }),
    onMetadataChange: vi.fn((cb: (m: Record<string, unknown>) => void) => {
      metadataListeners.push(cb);
      return () => {
        const i = metadataListeners.indexOf(cb);
        if (i >= 0) metadataListeners.splice(i, 1);
      };
    }),
  },
  player: {
    getRole: vi.fn(async () => role),
    getName: vi.fn(async () => selfName),
    getColor: vi.fn(async () => selfColor),
    get id() { return selfId; },
    onChange: vi.fn(() => () => {}),
  },
  party: { getPlayers: vi.fn(async () => players) },
  broadcast: {
    sendMessage: vi.fn(
      async (channel: string, data: unknown, opts?: { destination?: string[] }) => {
        broadcasts.push({ channel, data, targets: opts?.destination });
      },
    ),
  },
  notification: { show: vi.fn(async (_msg: string, _level: string) => {}) },
};

export const __testHooks = {
  reset() {
    store.clear();
    broadcasts.length = 0;
    players = [];
    role = "PLAYER";
    selfId = "player-self";
    selfName = "Self";
    selfColor = "#888888";
    metadataListeners.length = 0;
    Object.values(OBR.room).forEach((fn: any) => fn.mockClear?.());
    Object.values(OBR.player).forEach((fn: any) => fn?.mockClear?.());
    OBR.party.getPlayers.mockClear();
    OBR.broadcast.sendMessage.mockClear();
    OBR.notification.show.mockClear();
  },
  setRole(r: "PLAYER" | "GM") { role = r; },
  setSelf(id: string, name: string, color: string) {
    selfId = id; selfName = name; selfColor = color;
  },
  setParty(p: typeof players) { players = p; },
  store,
  broadcasts,
};

vi.mock("@owlbear-rodeo/sdk", () => ({ default: OBR, OBR }));
```

- [ ] **Step 2: Write a sanity test**

```ts
// test/sanity.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { OBR, __testHooks } from "./_mocks/obr-sdk";

describe("sdk mock sanity", () => {
  beforeEach(() => __testHooks.reset());

  it("stores and retrieves metadata", async () => {
    await OBR.room.setMetadata({ "test/key": { hello: "world" } });
    const md = await OBR.room.getMetadata();
    expect(md["test/key"]).toEqual({ hello: "world" });
  });

  it("notifies metadata listeners on write", async () => {
    let received: Record<string, unknown> | null = null;
    OBR.room.onMetadataChange((m) => { received = m; });
    await OBR.room.setMetadata({ "k": 1 });
    expect(received).not.toBeNull();
    expect((received as any)["k"]).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: 2 passing tests.

- [ ] **Step 4: Commit**

```bash
git add test/
git commit -m "test: add OBR SDK in-memory mock and sanity tests"
```

---

## Task 3: Constants and types

**Files:**
- Create: `src/constants.ts`
- Create: `src/types.ts`

- [ ] **Step 1: Write `src/constants.ts`**

```ts
export const EXTENSION_ID = "com.abottchen.obr-inv";
export const METADATA_KEY_PREFIX = `${EXTENSION_ID}/v1/`;
export const CONFIG_KEY = `${EXTENSION_ID}/config`;
export const BROADCAST_CHANNEL = `${EXTENSION_ID}/events`;

export const STORAGE_CAP_BYTES = 5120;
export const METER_YELLOW_RATIO = 0.75;
export const METER_RED_RATIO = 0.90;

export const DEFAULT_CATALOG_URL =
  "https://abottchen.github.io/obr-inv-catalog/items.json";

export const RARITIES = [
  "common",
  "uncommon",
  "rare",
  "very rare",
  "legendary",
] as const;

export const RARITY_COLORS: Record<string, string> = {
  common: "#888",
  uncommon: "#4caf50",
  rare: "#2196f3",
  "very rare": "#9c27b0",
  legendary: "#ff9800",
};

export const THEME = {
  bg0: "#15171f",
  bg1: "#1c2030",
  bg2: "#252a3e",
  border: "#2a3046",
  text: "#e6e8ef",
  textDim: "#8a8fa3",
  accent: "#7c4dff",
  accentSoft: "#a98bff",
  ok: "#4caf50",
  warn: "#f0ad4e",
  bad: "#e95e5e",
} as const;
```

- [ ] **Step 2: Write `src/types.ts`**

```ts
import { RARITIES } from "./constants";

export type Rarity = typeof RARITIES[number];

export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  rarity?: Rarity | null;
  weight?: number | null;
  [extra: string]: unknown;
}

export type InventoryEntry = [itemId: string, count: number];

export interface Currency { pp: number; gp: number; sp: number; cp: number; }

export interface PlayerInventoryRecord {
  name: string;
  color: string;
  items: InventoryEntry[];
  currency: Currency;
}

export interface ExtensionConfig {
  catalogUrl: string;
}

export interface TransferReceivedMessage {
  type: "transfer-received";
  fromName: string;
  toPlayerId: string;
  itemName: string;
  quantity: number;
}

export interface OverCapMessage {
  type: "over-cap";
  triggeringPlayerId: string;
  triggeringPlayerName: string;
  attempted: string;
  currentBytes: number;
  cap: number;
}

export type BroadcastMessage = TransferReceivedMessage | OverCapMessage;

export class OverCapError extends Error {
  constructor(
    public readonly currentBytes: number,
    public readonly cap: number,
    public readonly attempted: string,
  ) {
    super(`Inventory write would exceed cap (${currentBytes}/${cap}): ${attempted}`);
    this.name = "OverCapError";
  }
}
```

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/constants.ts src/types.ts
git commit -m "feat: define constants and shared types"
```

---

## Task 4: Catalog loader and validator

**Files:**
- Create: `src/catalog.ts`
- Create: `test/catalog.test.ts`

- [ ] **Step 1: Write tests in `test/catalog.test.ts`**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseCatalog, fetchCatalog, __resetCatalogCache } from "../src/catalog";

describe("parseCatalog", () => {
  it("accepts a fully-specified item", () => {
    const items = parseCatalog([
      { id: "h7p2Xy", name: "Healing Potion", category: "Consumables",
        icon: "u", description: "d", rarity: "uncommon", weight: 0.5 },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].rarity).toBe("uncommon");
  });

  it("tolerates null/missing rarity and weight", () => {
    const items = parseCatalog([
      { id: "a1", name: "X", category: "C", icon: "u", description: "d" },
      { id: "a2", name: "Y", category: "C", icon: "u", description: "d", rarity: null, weight: null },
    ]);
    expect(items).toHaveLength(2);
  });

  it("drops items missing required fields with a warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const items = parseCatalog([
      { id: "ok", name: "n", category: "c", icon: "u", description: "d" },
      { id: "bad", name: "n" },
    ]);
    expect(items).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("preserves unknown extra fields", () => {
    const items = parseCatalog([
      { id: "ok", name: "n", category: "c", icon: "u", description: "d", futureField: 42 },
    ]);
    expect(items[0].futureField).toBe(42);
  });

  it("deduplicates by id (first wins)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const items = parseCatalog([
      { id: "dup", name: "first", category: "c", icon: "u", description: "d" },
      { id: "dup", name: "second", category: "c", icon: "u", description: "d" },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("first");
    warn.mockRestore();
  });

  it("treats unknown rarity strings as undefined (renders as common at UI layer)", () => {
    const items = parseCatalog([
      { id: "ok", name: "n", category: "c", icon: "u", description: "d", rarity: "mythic" },
    ]);
    expect(items[0].rarity).toBeUndefined();
  });
});

describe("fetchCatalog", () => {
  const url = "https://example.test/items.json";

  beforeEach(() => {
    __resetCatalogCache();
    (globalThis as any).fetch = vi.fn();
  });

  it("retries once after a failed fetch", async () => {
    const f = (globalThis as any).fetch as ReturnType<typeof vi.fn>;
    f.mockRejectedValueOnce(new Error("net"))
     .mockResolvedValueOnce(new Response(JSON.stringify([
       { id: "a1", name: "N", category: "C", icon: "u", description: "d" },
     ]), { status: 200 }));
    const items = await fetchCatalog(url);
    expect(items).toHaveLength(1);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("throws after second failure", async () => {
    const f = (globalThis as any).fetch as ReturnType<typeof vi.fn>;
    f.mockRejectedValue(new Error("net"));
    await expect(fetchCatalog(url)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test -- catalog`
Expected: FAIL — `parseCatalog` and `fetchCatalog` not defined.

- [ ] **Step 3: Implement `src/catalog.ts`**

```ts
import { RARITIES } from "./constants";
import type { CatalogItem, Rarity } from "./types";

const REQUIRED: ReadonlyArray<keyof CatalogItem> = [
  "id", "name", "category", "icon", "description",
];

let cache: { url: string; items: CatalogItem[] } | null = null;

export function __resetCatalogCache() { cache = null; }

export function parseCatalog(raw: unknown): CatalogItem[] {
  if (!Array.isArray(raw)) {
    console.warn("[catalog] root is not an array; returning empty");
    return [];
  }
  const seen = new Set<string>();
  const out: CatalogItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") {
      console.warn("[catalog] dropped non-object entry");
      continue;
    }
    const obj = r as Record<string, unknown>;
    let ok = true;
    for (const key of REQUIRED) {
      if (typeof obj[key] !== "string" || (obj[key] as string).length === 0) {
        console.warn(`[catalog] dropped item missing field: ${key}`, obj);
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (seen.has(obj.id as string)) {
      console.warn(`[catalog] duplicate id ignored: ${obj.id}`);
      continue;
    }
    seen.add(obj.id as string);

    const rarity = typeof obj.rarity === "string"
      && (RARITIES as ReadonlyArray<string>).includes(obj.rarity)
        ? (obj.rarity as Rarity) : undefined;
    const weight = typeof obj.weight === "number" && Number.isFinite(obj.weight)
      ? obj.weight : undefined;

    const item: CatalogItem = {
      ...obj,
      id: obj.id as string,
      name: obj.name as string,
      category: obj.category as string,
      icon: obj.icon as string,
      description: obj.description as string,
      rarity,
      weight,
    };
    out.push(item);
  }
  return out;
}

export async function fetchCatalog(url: string): Promise<CatalogItem[]> {
  if (cache?.url === url) return cache.items;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const items = parseCatalog(json);
      cache = { url, items };
      return items;
    } catch (err) {
      lastErr = err;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastErr;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- catalog`
Expected: all catalog tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/catalog.ts test/catalog.test.ts
git commit -m "feat(catalog): fetch + validate with retry; tolerate optional fields"
```

---

## Task 5: Inventory pure operations

**Files:**
- Create: `src/inventory.ts`
- Create: `test/inventory.test.ts`

- [ ] **Step 1: Write tests in `test/inventory.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  emptyRecord, addItem, incrementItem, decrementItem, removeItem,
  pruneZeros, totalWeight, applyTransfer,
} from "../src/inventory";
import type { CatalogItem, PlayerInventoryRecord } from "../src/types";

const cat = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id: "a1", name: "Item", category: "C", icon: "u", description: "d", ...overrides,
});

const rec = (items: [string, number][] = []): PlayerInventoryRecord => ({
  name: "Alice", color: "#fff", items,
  currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
});

describe("inventory", () => {
  it("emptyRecord seeds correctly", () => {
    const r = emptyRecord("Alice", "#fff");
    expect(r.items).toEqual([]);
    expect(r.currency).toEqual({ pp: 0, gp: 0, sp: 0, cp: 0 });
  });

  it("addItem creates a new entry when absent", () => {
    const r = addItem(rec(), "a1", 3);
    expect(r.items).toEqual([["a1", 3]]);
  });

  it("addItem merges with existing entry", () => {
    const r = addItem(rec([["a1", 2]]), "a1", 5);
    expect(r.items).toEqual([["a1", 7]]);
  });

  it("addItem rejects qty <= 0", () => {
    expect(() => addItem(rec(), "a1", 0)).toThrow();
    expect(() => addItem(rec(), "a1", -1)).toThrow();
  });

  it("incrementItem adds 1", () => {
    expect(incrementItem(rec([["a1", 2]]), "a1").items).toEqual([["a1", 3]]);
  });

  it("decrementItem reduces by 1; allows reaching 0", () => {
    const r = decrementItem(rec([["a1", 1]]), "a1");
    expect(r.items).toEqual([["a1", 0]]);
  });

  it("decrementItem clamps at 0", () => {
    const r = decrementItem(rec([["a1", 0]]), "a1");
    expect(r.items).toEqual([["a1", 0]]);
  });

  it("removeItem drops the entry", () => {
    expect(removeItem(rec([["a1", 5], ["b2", 1]]), "a1").items).toEqual([["b2", 1]]);
  });

  it("pruneZeros strips zero-count entries", () => {
    expect(pruneZeros(rec([["a1", 0], ["b2", 3]])).items).toEqual([["b2", 3]]);
  });

  it("totalWeight sums weight × count, ignoring null/missing", () => {
    const items = [["a1", 2] as [string, number], ["b2", 4]];
    const catalog: CatalogItem[] = [
      cat({ id: "a1", weight: 1.5 }),
      cat({ id: "b2", weight: null as any }),
    ];
    expect(totalWeight(items, catalog)).toBe(3);
  });

  it("totalWeight ignores ids missing from catalog", () => {
    const items = [["unknown", 5] as [string, number]];
    expect(totalWeight(items, [])).toBe(0);
  });

  it("applyTransfer moves qty from sender to recipient", () => {
    const sender = rec([["a1", 5]]);
    const recipient = rec();
    const [s2, r2] = applyTransfer(sender, recipient, "a1", 3);
    expect(s2.items).toEqual([["a1", 2]]);
    expect(r2.items).toEqual([["a1", 3]]);
  });

  it("applyTransfer merges into recipient's existing entry", () => {
    const sender = rec([["a1", 5]]);
    const recipient = rec([["a1", 2]]);
    const [s2, r2] = applyTransfer(sender, recipient, "a1", 3);
    expect(s2.items).toEqual([["a1", 2]]);
    expect(r2.items).toEqual([["a1", 5]]);
  });

  it("applyTransfer rejects qty > sender count", () => {
    expect(() => applyTransfer(rec([["a1", 2]]), rec(), "a1", 3)).toThrow();
  });

  it("applyTransfer rejects qty <= 0", () => {
    expect(() => applyTransfer(rec([["a1", 2]]), rec(), "a1", 0)).toThrow();
  });

  it("applyTransfer rejects when sender doesn't have the item", () => {
    expect(() => applyTransfer(rec(), rec(), "a1", 1)).toThrow();
  });
});
```

- [ ] **Step 2: Run to confirm failures**

Run: `npm test -- inventory`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/inventory.ts`**

```ts
import type {
  CatalogItem, InventoryEntry, PlayerInventoryRecord,
} from "./types";

export function emptyRecord(name: string, color: string): PlayerInventoryRecord {
  return { name, color, items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 } };
}

function withItems(r: PlayerInventoryRecord, items: InventoryEntry[]): PlayerInventoryRecord {
  return { ...r, items };
}

function findIndex(items: InventoryEntry[], id: string): number {
  return items.findIndex(([eid]) => eid === id);
}

export function addItem(
  r: PlayerInventoryRecord, id: string, qty: number,
): PlayerInventoryRecord {
  if (qty <= 0) throw new Error(`addItem: qty must be > 0 (got ${qty})`);
  const items = r.items.map((e) => [...e] as InventoryEntry);
  const i = findIndex(items, id);
  if (i >= 0) items[i][1] += qty;
  else items.push([id, qty]);
  return withItems(r, items);
}

export function incrementItem(r: PlayerInventoryRecord, id: string): PlayerInventoryRecord {
  return addItem(r, id, 1);
}

export function decrementItem(r: PlayerInventoryRecord, id: string): PlayerInventoryRecord {
  const items = r.items.map((e) => [...e] as InventoryEntry);
  const i = findIndex(items, id);
  if (i < 0) return r;
  items[i][1] = Math.max(0, items[i][1] - 1);
  return withItems(r, items);
}

export function removeItem(r: PlayerInventoryRecord, id: string): PlayerInventoryRecord {
  return withItems(r, r.items.filter(([eid]) => eid !== id));
}

export function pruneZeros(r: PlayerInventoryRecord): PlayerInventoryRecord {
  return withItems(r, r.items.filter(([, count]) => count > 0));
}

export function totalWeight(
  items: InventoryEntry[], catalog: CatalogItem[],
): number {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  let total = 0;
  for (const [id, count] of items) {
    const ci = byId.get(id);
    if (!ci || typeof ci.weight !== "number") continue;
    total += ci.weight * count;
  }
  return total;
}

export function applyTransfer(
  sender: PlayerInventoryRecord,
  recipient: PlayerInventoryRecord,
  id: string,
  qty: number,
): [PlayerInventoryRecord, PlayerInventoryRecord] {
  if (qty <= 0) throw new Error(`applyTransfer: qty must be > 0 (got ${qty})`);
  const senderItems = sender.items.map((e) => [...e] as InventoryEntry);
  const i = findIndex(senderItems, id);
  if (i < 0) throw new Error(`applyTransfer: sender has no item ${id}`);
  if (senderItems[i][1] < qty) {
    throw new Error(`applyTransfer: qty ${qty} exceeds sender count ${senderItems[i][1]}`);
  }
  senderItems[i][1] -= qty;
  const newSender = withItems(sender, senderItems);

  const newRecipient = addItem(recipient, id, qty);
  return [newSender, newRecipient];
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- inventory`
Expected: all inventory tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/inventory.ts test/inventory.test.ts
git commit -m "feat(inventory): pure ops for add/increment/decrement/remove/prune/transfer/weight"
```

---

## Task 6: Metadata IO with size guard, write queue, and ensureRecord

**Files:**
- Create: `src/metadata.ts`
- Create: `test/metadata.test.ts`

- [ ] **Step 1: Write tests in `test/metadata.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import {
  inventoryByteSize, listInventoryRecords, getRecord, writeRecord,
  ensureRecord, deleteRecord, recordKey,
} from "../src/metadata";
import { OverCapError } from "../src/types";
import { STORAGE_CAP_BYTES } from "../src/constants";

describe("metadata", () => {
  beforeEach(() => __testHooks.reset());

  it("recordKey is namespaced", () => {
    expect(recordKey("p1")).toBe("com.abottchen.obr-inv/v1/p1");
  });

  it("inventoryByteSize matches TextEncoder length", async () => {
    await writeRecord("p1", {
      name: "A", color: "#fff",
      items: [["a1", 2]], currency: { pp: 0, gp: 5, sp: 0, cp: 0 },
    });
    const all = await listInventoryRecords();
    const expected = new TextEncoder().encode(JSON.stringify(all)).byteLength;
    expect(await inventoryByteSize()).toBe(expected);
  });

  it("listInventoryRecords filters to inventory keys only", async () => {
    await writeRecord("p1", {
      name: "A", color: "#fff",
      items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    });
    __testHooks.store.set("other.extension/key", { junk: true });
    const recs = await listInventoryRecords();
    expect(Object.keys(recs)).toEqual(["p1"]);
  });

  it("ensureRecord creates an empty record when absent", async () => {
    await ensureRecord("p1", "Alice", "#abc");
    const r = await getRecord("p1");
    expect(r?.name).toBe("Alice");
    expect(r?.items).toEqual([]);
  });

  it("ensureRecord updates name/color, leaves items/currency", async () => {
    await writeRecord("p1", {
      name: "Old", color: "#000",
      items: [["a1", 3]], currency: { pp: 1, gp: 2, sp: 3, cp: 4 },
    });
    await ensureRecord("p1", "New", "#fff");
    const r = await getRecord("p1");
    expect(r).toEqual({
      name: "New", color: "#fff",
      items: [["a1", 3]], currency: { pp: 1, gp: 2, sp: 3, cp: 4 },
    });
  });

  it("writeRecord prunes zero-count entries before persisting", async () => {
    await writeRecord("p1", {
      name: "A", color: "#fff",
      items: [["a1", 0], ["b2", 2]],
      currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    });
    const r = await getRecord("p1");
    expect(r?.items).toEqual([["b2", 2]]);
  });

  it("writeRecord rejects when projected size > cap", async () => {
    const big = "x".repeat(STORAGE_CAP_BYTES + 100);
    await expect(writeRecord("p1", {
      name: big, color: "#fff",
      items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    })).rejects.toThrow(OverCapError);
    expect(await getRecord("p1")).toBeNull();
  });

  it("deleteRecord removes the key", async () => {
    await writeRecord("p1", {
      name: "A", color: "#fff",
      items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    });
    await deleteRecord("p1");
    expect(await getRecord("p1")).toBeNull();
  });

  it("serializes concurrent writes to the same key", async () => {
    const writes = Array.from({ length: 5 }, (_, i) =>
      writeRecord("p1", {
        name: `n${i}`, color: "#fff",
        items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
      })
    );
    await Promise.all(writes);
    const r = await getRecord("p1");
    expect(r?.name).toBe("n4");
  });
});
```

- [ ] **Step 2: Run to confirm failures**

Run: `npm test -- metadata`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/metadata.ts`**

```ts
import OBR from "@owlbear-rodeo/sdk";
import {
  METADATA_KEY_PREFIX, STORAGE_CAP_BYTES,
} from "./constants";
import type { PlayerInventoryRecord } from "./types";
import { OverCapError } from "./types";
import { pruneZeros } from "./inventory";

export function recordKey(playerId: string): string {
  return `${METADATA_KEY_PREFIX}${playerId}`;
}

export function isRecordKey(key: string): boolean {
  return key.startsWith(METADATA_KEY_PREFIX);
}

export function playerIdFromKey(key: string): string {
  return key.slice(METADATA_KEY_PREFIX.length);
}

export async function listInventoryRecords(): Promise<Record<string, PlayerInventoryRecord>> {
  const md = await OBR.room.getMetadata();
  const out: Record<string, PlayerInventoryRecord> = {};
  for (const [k, v] of Object.entries(md)) {
    if (!isRecordKey(k)) continue;
    out[playerIdFromKey(k)] = v as PlayerInventoryRecord;
  }
  return out;
}

export async function getRecord(playerId: string): Promise<PlayerInventoryRecord | null> {
  const md = await OBR.room.getMetadata();
  const v = md[recordKey(playerId)];
  return (v as PlayerInventoryRecord | undefined) ?? null;
}

export async function inventoryByteSize(): Promise<number> {
  const all = await listInventoryRecords();
  return new TextEncoder().encode(JSON.stringify(all)).byteLength;
}

const queues = new Map<string, Promise<unknown>>();

function enqueue<T>(key: string, op: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.then(op, op);
  queues.set(key, next.catch(() => {}));
  return next;
}

export function writeRecord(
  playerId: string, record: PlayerInventoryRecord,
): Promise<void> {
  return enqueue(recordKey(playerId), async () => {
    const pruned = pruneZeros(record);
    const md = await OBR.room.getMetadata();
    const projected: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(md)) {
      if (k.startsWith(METADATA_KEY_PREFIX)) projected[k] = v;
    }
    projected[recordKey(playerId)] = pruned;
    const projectedBytes = new TextEncoder()
      .encode(JSON.stringify(projected)).byteLength;
    if (projectedBytes > STORAGE_CAP_BYTES) {
      const currentBytes = await inventoryByteSize();
      throw new OverCapError(
        currentBytes,
        STORAGE_CAP_BYTES,
        `write record ${playerId}`,
      );
    }
    await OBR.room.setMetadata({ [recordKey(playerId)]: pruned });
  });
}

export async function deleteRecord(playerId: string): Promise<void> {
  return enqueue(recordKey(playerId), async () => {
    await OBR.room.setMetadata({ [recordKey(playerId)]: undefined });
  });
}

export async function ensureRecord(
  playerId: string, name: string, color: string,
): Promise<PlayerInventoryRecord> {
  const existing = await getRecord(playerId);
  if (!existing) {
    const fresh: PlayerInventoryRecord = {
      name, color, items: [],
      currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    };
    await writeRecord(playerId, fresh);
    return fresh;
  }
  if (existing.name !== name || existing.color !== color) {
    const updated: PlayerInventoryRecord = { ...existing, name, color };
    await writeRecord(playerId, updated);
    return updated;
  }
  return existing;
}

export function onRoomMetadataChange(
  cb: (records: Record<string, PlayerInventoryRecord>) => void,
): () => void {
  return OBR.room.onMetadataChange((md) => {
    const out: Record<string, PlayerInventoryRecord> = {};
    for (const [k, v] of Object.entries(md)) {
      if (isRecordKey(k)) out[playerIdFromKey(k)] = v as PlayerInventoryRecord;
    }
    cb(out);
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- metadata`
Expected: all metadata tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/metadata.ts test/metadata.test.ts
git commit -m "feat(metadata): IO + ensureRecord + zero-prune + size cap guard + write queue"
```

---

## Task 7: Transfer orchestration with over-cap broadcast

**Files:**
- Create: `src/transfer.ts`
- Create: `test/transfer.test.ts`

- [ ] **Step 1: Write tests**

```ts
// test/transfer.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import { writeRecord, getRecord } from "../src/metadata";
import { transferItem } from "../src/transfer";
import { BROADCAST_CHANNEL, STORAGE_CAP_BYTES } from "../src/constants";

const seedRecord = async (
  pid: string, name: string, items: [string, number][] = [],
) => {
  await writeRecord(pid, {
    name, color: "#fff", items,
    currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
  });
};

describe("transferItem", () => {
  beforeEach(() => __testHooks.reset());

  it("moves qty from sender to recipient and emits a transfer-received broadcast", async () => {
    await seedRecord("alice", "Alice", [["a1", 5]]);
    await seedRecord("bob", "Bob");
    __testHooks.setParty([
      { id: "alice", name: "Alice", color: "#fff", role: "PLAYER" },
      { id: "bob", name: "Bob", color: "#fff", role: "PLAYER" },
    ]);

    await transferItem({
      fromPlayerId: "alice", toPlayerId: "bob",
      itemId: "a1", itemName: "Sword", qty: 3,
    });

    expect((await getRecord("alice"))?.items).toEqual([["a1", 2]]);
    expect((await getRecord("bob"))?.items).toEqual([["a1", 3]]);
    const transferMsg = __testHooks.broadcasts.find(
      (b) => b.channel === BROADCAST_CHANNEL
        && (b.data as any).type === "transfer-received",
    );
    expect(transferMsg).toBeTruthy();
    expect(transferMsg?.targets).toEqual(["bob"]);
  });

  it("rejects and emits over-cap broadcast when recipient would overflow", async () => {
    const big = "x".repeat(STORAGE_CAP_BYTES - 200);
    __testHooks.store.set(
      "com.abottchen.obr-inv/v1/bob",
      { name: big, color: "#fff", items: [], currency: { pp:0, gp:0, sp:0, cp:0 } },
    );
    await seedRecord("alice", "Alice", [["a1", 5]]);
    __testHooks.setParty([
      { id: "gm", name: "GM", color: "#fff", role: "GM" },
      { id: "alice", name: "Alice", color: "#fff", role: "PLAYER" },
      { id: "bob", name: "Bob", color: "#fff", role: "PLAYER" },
    ]);

    await expect(transferItem({
      fromPlayerId: "alice", toPlayerId: "bob",
      itemId: "a1", itemName: "Sword", qty: 3,
    })).rejects.toThrow();

    expect((await getRecord("alice"))?.items).toEqual([["a1", 5]]);
    const overCapMsg = __testHooks.broadcasts.find(
      (b) => (b.data as any).type === "over-cap",
    );
    expect(overCapMsg).toBeTruthy();
    expect(overCapMsg?.targets).toEqual(["gm"]);
  });

  it("rejects when recipient has no inventory record", async () => {
    await seedRecord("alice", "Alice", [["a1", 1]]);
    await expect(transferItem({
      fromPlayerId: "alice", toPlayerId: "ghost",
      itemId: "a1", itemName: "X", qty: 1,
    })).rejects.toThrow(/no inventory record/i);
  });
});
```

- [ ] **Step 2: Run to confirm failures**

Run: `npm test -- transfer`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/transfer.ts`**

```ts
import OBR from "@owlbear-rodeo/sdk";
import { BROADCAST_CHANNEL } from "./constants";
import { applyTransfer } from "./inventory";
import {
  getRecord, writeRecord,
} from "./metadata";
import {
  OverCapError,
} from "./types";
import type {
  OverCapMessage, TransferReceivedMessage,
} from "./types";

interface TransferRequest {
  fromPlayerId: string;
  toPlayerId: string;
  itemId: string;
  itemName: string;
  qty: number;
}

async function gmPlayerIds(): Promise<string[]> {
  const players = await OBR.party.getPlayers();
  return players.filter((p) => p.role === "GM").map((p) => p.id);
}

export async function transferItem(req: TransferRequest): Promise<void> {
  const sender = await getRecord(req.fromPlayerId);
  const recipient = await getRecord(req.toPlayerId);
  if (!sender) throw new Error(`Sender ${req.fromPlayerId} has no inventory record`);
  if (!recipient) throw new Error(`Recipient ${req.toPlayerId} has no inventory record`);

  const [newSender, newRecipient] = applyTransfer(
    sender, recipient, req.itemId, req.qty,
  );

  try {
    await writeRecord(req.toPlayerId, newRecipient);
  } catch (err) {
    if (err instanceof OverCapError) {
      const senderName = sender.name;
      const msg: OverCapMessage = {
        type: "over-cap",
        triggeringPlayerId: req.fromPlayerId,
        triggeringPlayerName: senderName,
        attempted: `transfer ${req.qty}× ${req.itemName} to ${recipient.name}`,
        currentBytes: err.currentBytes,
        cap: err.cap,
      };
      const targets = await gmPlayerIds();
      await OBR.broadcast.sendMessage(BROADCAST_CHANNEL, msg, { destination: targets });
    }
    throw err;
  }

  try {
    await writeRecord(req.fromPlayerId, newSender);
  } catch (err) {
    await writeRecord(req.toPlayerId, recipient).catch(() => {});
    throw err;
  }

  const note: TransferReceivedMessage = {
    type: "transfer-received",
    fromName: sender.name,
    toPlayerId: req.toPlayerId,
    itemName: req.itemName,
    quantity: req.qty,
  };
  await OBR.broadcast.sendMessage(BROADCAST_CHANNEL, note, {
    destination: [req.toPlayerId],
  });
}
```

Note: SDK's `broadcast.sendMessage` accepts a destination filter. The mock supports the same shape.

- [ ] **Step 4: Run tests**

Run: `npm test -- transfer`
Expected: all transfer tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/transfer.ts test/transfer.test.ts
git commit -m "feat(transfer): orchestrate transfer with over-cap broadcast and rollback"
```

---

## Task 8: Hydrated GM JSON export

**Files:**
- Create: `src/export.ts`
- Create: `test/export.test.ts`

- [ ] **Step 1: Write tests**

```ts
// test/export.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import { writeRecord } from "../src/metadata";
import { buildExport } from "../src/export";
import type { CatalogItem } from "../src/types";

const cat: CatalogItem[] = [
  { id: "a1", name: "Item A", category: "C", icon: "u", description: "d",
    rarity: "uncommon", weight: 0.5 },
];

describe("buildExport", () => {
  beforeEach(() => __testHooks.reset());

  it("hydrates known IDs and marks unknown ones as _unresolved", async () => {
    await writeRecord("p1", {
      name: "Alice", color: "#fff",
      items: [["a1", 3], ["zz", 7]],
      currency: { pp: 0, gp: 5, sp: 0, cp: 0 },
    });
    const exp = await buildExport(cat, "https://example.test/items.json");
    expect(exp.exportedAt).toMatch(/T.*Z/);
    expect(exp.catalogUrl).toBe("https://example.test/items.json");
    expect(exp.catalogVersion).toMatch(/^[0-9a-f]{40}$/);
    expect(exp.inventories.p1.items).toEqual([
      { id: "a1", count: 3, name: "Item A", category: "C", icon: "u",
        description: "d", rarity: "uncommon", weight: 0.5 },
      { id: "zz", count: 7, _unresolved: true },
    ]);
    expect(exp.inventories.p1.currency).toEqual({ pp: 0, gp: 5, sp: 0, cp: 0 });
    expect(exp.inventories.p1.name).toBe("Alice");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- export`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/export.ts`**

```ts
import { listInventoryRecords } from "./metadata";
import type { CatalogItem } from "./types";

export interface ExportEntryHydrated {
  id: string;
  count: number;
  name: string;
  category: string;
  icon: string;
  description: string;
  rarity?: string | null;
  weight?: number | null;
}
export interface ExportEntryUnresolved {
  id: string;
  count: number;
  _unresolved: true;
}
export type ExportEntry = ExportEntryHydrated | ExportEntryUnresolved;

export interface ExportInventory {
  name: string;
  color: string;
  items: ExportEntry[];
  currency: { pp: number; gp: number; sp: number; cp: number };
}

export interface ExportFile {
  exportedAt: string;
  catalogUrl: string;
  catalogVersion: string;
  inventories: Record<string, ExportInventory>;
}

async function sha1(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildExport(
  catalog: CatalogItem[], catalogUrl: string,
): Promise<ExportFile> {
  const records = await listInventoryRecords();
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const inventories: Record<string, ExportInventory> = {};
  for (const [pid, rec] of Object.entries(records)) {
    const items: ExportEntry[] = rec.items.map(([id, count]) => {
      const ci = byId.get(id);
      if (!ci) return { id, count, _unresolved: true as const };
      return {
        id, count,
        name: ci.name, category: ci.category,
        icon: ci.icon, description: ci.description,
        rarity: ci.rarity ?? null, weight: ci.weight ?? null,
      };
    });
    inventories[pid] = {
      name: rec.name, color: rec.color, items, currency: rec.currency,
    };
  }
  return {
    exportedAt: new Date().toISOString(),
    catalogUrl,
    catalogVersion: await sha1(JSON.stringify(catalog)),
    inventories,
  };
}

export function downloadExport(exp: ExportFile): void {
  const blob = new Blob([JSON.stringify(exp, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `obr-inv-backup-${exp.exportedAt.replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- export`
Expected: all export tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/export.ts test/export.test.ts
git commit -m "feat(export): hydrate inventory backup JSON with catalog data + SHA-1 catalog version"
```

---

## Task 9: Theme styles and frame-clamp helper

**Files:**
- Create: `src/styles.ts`
- Create: `src/styles-list.ts`
- Create: `src/styles-dialog.ts`
- Create: `src/frame.ts`

- [ ] **Step 1: Write `src/styles.ts`**

```ts
import { THEME, RARITY_COLORS } from "./constants";

const BASE_CSS = `
:root {
  --bg-0: ${THEME.bg0}; --bg-1: ${THEME.bg1}; --bg-2: ${THEME.bg2};
  --border: ${THEME.border}; --text: ${THEME.text}; --text-dim: ${THEME.textDim};
  --accent: ${THEME.accent}; --accent-soft: ${THEME.accentSoft};
  --ok: ${THEME.ok}; --warn: ${THEME.warn}; --bad: ${THEME.bad};
  --rarity-common: ${RARITY_COLORS.common};
  --rarity-uncommon: ${RARITY_COLORS.uncommon};
  --rarity-rare: ${RARITY_COLORS.rare};
  --rarity-very-rare: ${RARITY_COLORS["very rare"]};
  --rarity-legendary: ${RARITY_COLORS.legendary};
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
body {
  background: var(--bg-0); color: var(--text);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 13px; line-height: 1.4;
}
button { font-family: inherit; }
input { font-family: inherit; }
`;

export function injectStyles(css: string, id: string): void {
  if (document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

export function injectBaseStyles(): void {
  injectStyles(BASE_CSS, "obr-inv-base-styles");
}
```

- [ ] **Step 2: Write `src/styles-list.ts`**

```ts
export const LIST_CSS = `
.shell { display: flex; flex-direction: column; height: 100%; }
.shell-header {
  position: sticky; top: 0;
  display: flex; align-items: center; gap: 8px;
  padding: 8px; background: var(--bg-0);
  border-bottom: 1px solid var(--border);
}
.shell-search {
  flex: 1;
  background: var(--bg-1); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px;
  padding: 6px 10px; outline: none;
}
.shell-search:focus { border-color: var(--accent); }
.lock-toggle {
  background: var(--bg-1); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px;
  padding: 6px 10px; cursor: pointer;
}
.lock-toggle.unlocked { background: var(--accent); color: #fff; border-color: var(--accent-soft); }

.shell-body { flex: 1; overflow-y: auto; padding: 4px 8px; }
.cat-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 4px; color: var(--text-dim);
  cursor: pointer; user-select: none;
  text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;
}
.cat-header .chev { width: 10px; display: inline-block; }
.inv-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; margin-bottom: 4px;
  background: var(--bg-1); border: 1px solid var(--border);
  border-radius: 6px;
}
.inv-row[data-rarity="uncommon"] { border-left: 3px solid var(--rarity-uncommon); }
.inv-row[data-rarity="rare"] { border-left: 3px solid var(--rarity-rare); }
.inv-row[data-rarity="very rare"] { border-left: 3px solid var(--rarity-very-rare); }
.inv-row[data-rarity="legendary"] { border-left: 3px solid var(--rarity-legendary); }
.inv-row[data-rarity="common"], .inv-row:not([data-rarity]) { border-left: 3px solid var(--rarity-common); }

.inv-icon {
  width: 26px; height: 26px; flex-shrink: 0;
  background: var(--bg-2); border-radius: 4px;
  background-size: cover; background-position: center;
}
.inv-name { flex: 1; }
.inv-name mark { background: rgba(124,77,255,0.25); color: inherit; padding: 0 1px; }
.inv-count { font-variant-numeric: tabular-nums; min-width: 26px; text-align: right; color: var(--text-dim); }

.btn-step, .btn-x {
  width: 24px; height: 24px;
  background: var(--bg-2); border: 1px solid var(--border);
  border-radius: 4px; color: var(--text); cursor: pointer;
}
.btn-step:hover, .btn-x:hover { background: var(--accent); border-color: var(--accent-soft); }
.btn-x:hover { background: var(--bad); border-color: var(--bad); }

.shell-footer {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 6px 8px;
  border-top: 1px solid var(--border); background: var(--bg-0);
  color: var(--text-dim); font-size: 12px;
}
.btn-add {
  background: var(--accent); color: #fff;
  border: none; border-radius: 6px;
  padding: 6px 12px; cursor: pointer;
}
.gold-strip {
  display: flex; gap: 6px; padding: 6px 8px;
  border-top: 1px solid var(--border); background: var(--bg-0);
}
.gold-cell { flex: 1; display: flex; align-items: center; gap: 4px; }
.gold-cell label { color: var(--text-dim); text-transform: uppercase; font-size: 10px; }
.gold-cell input {
  width: 100%; background: var(--bg-1); color: var(--text);
  border: 1px solid var(--border); border-radius: 4px;
  padding: 4px 6px; outline: none;
}
.gold-cell input:focus { border-color: var(--accent); }

.empty-state { padding: 24px 8px; text-align: center; color: var(--text-dim); }
`;
```

- [ ] **Step 3: Write `src/styles-dialog.ts`**

```ts
export const DIALOG_CSS = `
.popover {
  position: absolute; z-index: 50;
  background: var(--bg-2); color: var(--text);
  border: 1px solid var(--border); border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.45);
  padding: 8px 10px; min-width: 180px; max-width: 320px;
}
.popover h4 { margin: 0 0 4px 0; font-size: 13px; display: flex; align-items: center; gap: 6px; }
.popover .meta { color: var(--text-dim); font-size: 11px; margin-bottom: 6px; }
.popover .desc { font-size: 12px; max-height: 240px; overflow-y: auto; }

.transfer-list { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.transfer-list button {
  display: flex; align-items: center; gap: 6px;
  background: var(--bg-1); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px;
  padding: 5px 8px; cursor: pointer; text-align: left;
}
.transfer-list button:hover { background: var(--accent); border-color: var(--accent-soft); }
.transfer-qty {
  background: var(--bg-1); color: var(--text);
  border: 1px solid var(--border); border-radius: 4px;
  padding: 3px 6px; width: 60px; outline: none;
}

.dialog-overlay {
  position: fixed; inset: 0; z-index: 40;
  background: var(--bg-0); display: flex; flex-direction: column;
}
.dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px; border-bottom: 1px solid var(--border);
}
.dialog-close {
  background: transparent; border: none; color: var(--text-dim);
  cursor: pointer; font-size: 18px;
}
.dialog-body { flex: 1; overflow-y: auto; padding: 4px 8px; }
.add-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; margin-bottom: 4px;
  background: var(--bg-1); border-radius: 6px;
  border-left: 3px solid var(--rarity-common);
}
.add-row[data-rarity="uncommon"] { border-left-color: var(--rarity-uncommon);
  background: linear-gradient(90deg, rgba(76,175,80,0.10), var(--bg-1) 60%); }
.add-row[data-rarity="rare"] { border-left-color: var(--rarity-rare);
  background: linear-gradient(90deg, rgba(33,150,243,0.10), var(--bg-1) 60%); }
.add-row[data-rarity="very rare"] { border-left-color: var(--rarity-very-rare);
  background: linear-gradient(90deg, rgba(156,39,176,0.10), var(--bg-1) 60%); }
.add-row[data-rarity="legendary"] { border-left-color: var(--rarity-legendary);
  background: linear-gradient(90deg, rgba(255,152,0,0.10), var(--bg-1) 60%); }
.add-row .item-name[data-rarity="uncommon"] { color: var(--rarity-uncommon); }
.add-row .item-name[data-rarity="rare"] { color: var(--rarity-rare); }
.add-row .item-name[data-rarity="very rare"] { color: var(--rarity-very-rare); }
.add-row .item-name[data-rarity="legendary"] { color: var(--rarity-legendary); }
.add-qty { width: 56px; }
.btn-plus {
  background: var(--accent); color: #fff;
  border: none; border-radius: 4px;
  padding: 4px 10px; cursor: pointer;
}

.drop-zone {
  position: sticky; bottom: 0;
  margin: 8px; padding: 12px;
  border: 2px dashed var(--accent-soft); border-radius: 6px;
  text-align: center; color: var(--text-dim); background: var(--bg-1);
  display: none;
}
.drop-zone.active { display: block; }
.drop-zone.over { background: var(--bg-2); border-color: var(--accent); color: var(--text); }

.tabs {
  display: flex; gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  background: var(--bg-0);
}
.tab {
  flex-shrink: 0;
  background: var(--bg-1); color: var(--text);
  border: 1px solid var(--border);
  border-left: 3px solid var(--text-dim);
  border-radius: 4px;
  padding: 4px 10px; cursor: pointer;
}
.tab.active { background: var(--accent); border-color: var(--accent-soft); color: #fff; }
.tab-download {
  margin-left: auto; flex-shrink: 0;
  background: var(--bg-1); color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px; padding: 4px 8px; cursor: pointer;
}

.meter-strip { padding: 6px 8px; border-bottom: 1px solid var(--border); }
.meter-bar { height: 8px; background: var(--bg-1); border-radius: 4px; overflow: hidden; }
.meter-fill { height: 100%; background: var(--ok); transition: width 0.2s, background 0.2s; }
.meter-fill[data-state="yellow"] { background: var(--warn); }
.meter-fill[data-state="red"] { background: var(--bad); }
.meter-text { font-size: 11px; color: var(--text-dim); margin-top: 2px; }

.modal-backdrop {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
}
.modal {
  background: var(--bg-2); border: 1px solid var(--border); border-radius: 8px;
  padding: 16px; max-width: 320px;
}
.modal h3 { margin: 0 0 8px 0; }
.modal .ok-btn {
  background: var(--accent); color: #fff;
  border: none; border-radius: 6px; padding: 6px 14px;
  cursor: pointer; margin-top: 12px;
}
`;
```

- [ ] **Step 4: Write `src/frame.ts`**

```ts
export interface Rect { x: number; y: number; width: number; height: number; }

/**
 * Returns x,y so the rect is fully inside the iframe viewport.
 * Falls back to (0,0) if the rect is larger than the viewport.
 */
export function clampToFrame(target: Rect, padding = 4): { x: number; y: number } {
  const W = document.documentElement.clientWidth;
  const H = document.documentElement.clientHeight;
  let { x, y } = target;
  const { width, height } = target;
  if (x + width + padding > W) x = Math.max(padding, W - width - padding);
  if (y + height + padding > H) y = Math.max(padding, H - height - padding);
  if (x < padding) x = padding;
  if (y < padding) y = padding;
  return { x, y };
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/styles.ts src/styles-list.ts src/styles-dialog.ts src/frame.ts
git commit -m "feat(ui): theme tokens, list/dialog CSS, iframe-clamp helper"
```

---

## Task 10: Inventory list view with categories + ± + ×

**Files:**
- Create: `src/ui-list.ts`

This module renders the scrollable list area inside the shell. Pure DOM construction; no SDK. It exposes a `renderList` that accepts state + handlers and re-renders.

- [ ] **Step 1: Implement `src/ui-list.ts`**

```ts
import type { CatalogItem, InventoryEntry, Rarity } from "./types";

export interface RowHandlers {
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onDescription: (id: string, anchor: { x: number; y: number }) => void;
  onTransfer: (id: string, anchor: { x: number; y: number }) => void;
}

export interface ListState {
  items: InventoryEntry[];
  catalog: CatalogItem[];
  search: string;
  unlocked: boolean;
  collapsed: Set<string>;
  ghosts: Set<string>;        // IDs whose count is 0 but should still render
}

export function renderList(
  container: HTMLElement, state: ListState, handlers: RowHandlers,
): void {
  container.innerHTML = "";
  const byId = new Map(state.catalog.map((c) => [c.id, c]));
  const search = state.search.trim().toLowerCase();

  // Group by category, but include ghosts and the originating order.
  const byCat = new Map<string, Array<{ entry: InventoryEntry; item: CatalogItem | null }>>();
  for (const entry of state.items) {
    const item = byId.get(entry[0]) ?? null;
    if (entry[1] === 0 && !state.ghosts.has(entry[0])) continue;
    if (search && !rowMatches(entry, item, search)) continue;
    const cat = item?.category ?? "Unknown";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push({ entry, item });
  }

  if (byCat.size === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = search ? `No items match "${state.search}"` : "Inventory is empty";
    container.appendChild(empty);
    return;
  }

  for (const [cat, entries] of byCat.entries()) {
    const collapsed = state.collapsed.has(cat);
    const header = document.createElement("div");
    header.className = "cat-header";
    header.dataset.category = cat;
    header.innerHTML = `<span><span class="chev">${collapsed ? "▸" : "▾"}</span> ${escape(cat)}</span><span>(${entries.length})</span>`;
    container.appendChild(header);
    if (collapsed) continue;
    for (const { entry, item } of entries) {
      container.appendChild(renderRow(entry, item, state.unlocked, search, handlers));
    }
  }
}

function rowMatches(
  entry: InventoryEntry, item: CatalogItem | null, search: string,
): boolean {
  const name = item?.name ?? entry[0];
  return name.toLowerCase().includes(search);
}

function renderRow(
  entry: InventoryEntry, item: CatalogItem | null, unlocked: boolean,
  search: string, h: RowHandlers,
): HTMLElement {
  const [id, count] = entry;
  const row = document.createElement("div");
  row.className = "inv-row";
  if (item?.rarity) row.dataset.rarity = item.rarity as Rarity;
  row.dataset.itemId = id;

  const icon = document.createElement("div");
  icon.className = "inv-icon";
  if (item?.icon) icon.style.backgroundImage = `url("${item.icon}")`;
  else icon.textContent = "❓";
  row.appendChild(icon);

  const name = document.createElement("div");
  name.className = "inv-name";
  name.innerHTML = item ? highlight(item.name, search) : escape(`[${id}] (missing from catalog)`);
  row.appendChild(name);

  const cnt = document.createElement("div");
  cnt.className = "inv-count";
  cnt.textContent = `×${count}`;
  row.appendChild(cnt);

  if (unlocked) {
    const dec = document.createElement("button");
    dec.className = "btn-step"; dec.textContent = "−"; dec.title = "Decrease";
    dec.dataset.action = "dec";
    dec.onclick = () => h.onDecrement(id);
    row.appendChild(dec);

    const inc = document.createElement("button");
    inc.className = "btn-step"; inc.textContent = "+"; inc.title = "Increase";
    inc.dataset.action = "inc";
    inc.onclick = () => h.onIncrement(id);
    row.appendChild(inc);

    const rm = document.createElement("button");
    rm.className = "btn-x"; rm.textContent = "✕"; rm.title = "Remove";
    rm.dataset.action = "remove";
    rm.onclick = () => h.onRemove(id);
    row.appendChild(rm);
  }

  // Right-click and shift+right-click open description / transfer.
  // Bound to the icon+name+count area only — not the buttons.
  const interactiveZone = [icon, name, cnt];
  for (const el of interactiveZone) {
    el.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      const me = ev as MouseEvent;
      if (me.shiftKey) h.onTransfer(id, { x: me.clientX, y: me.clientY });
      else h.onDescription(id, { x: me.clientX, y: me.clientY });
    });
  }

  return row;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

function highlight(text: string, search: string): string {
  if (!search) return escape(text);
  const lower = text.toLowerCase();
  const idx = lower.indexOf(search);
  if (idx < 0) return escape(text);
  return escape(text.slice(0, idx))
    + `<mark>${escape(text.slice(idx, idx + search.length))}</mark>`
    + escape(text.slice(idx + search.length));
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui-list.ts
git commit -m "feat(ui): inventory list with collapsible categories, search highlight, +/-/x"
```

---

## Task 11: Right-click description popover

**Files:**
- Create: `src/ui-description.ts`

- [ ] **Step 1: Implement**

```ts
import { clampToFrame } from "./frame";
import type { CatalogItem } from "./types";

let active: HTMLElement | null = null;
let outsideHandler: ((e: MouseEvent) => void) | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;

export function showDescription(
  anchor: { x: number; y: number }, item: CatalogItem | null, fallbackId?: string,
): void {
  closeDescription();
  const pop = document.createElement("div");
  pop.className = "popover description-popover";

  const title = document.createElement("h4");
  if (item?.icon) {
    const i = document.createElement("div");
    i.className = "inv-icon";
    i.style.backgroundImage = `url("${item.icon}")`;
    title.appendChild(i);
  }
  const span = document.createElement("span");
  span.textContent = item?.name ?? `[${fallbackId ?? "?"}] (missing from catalog)`;
  if (item?.rarity) span.style.color = `var(--rarity-${(item.rarity as string).replace(" ", "-")})`;
  title.appendChild(span);
  pop.appendChild(title);

  if (item && (item.rarity || typeof item.weight === "number")) {
    const meta = document.createElement("div");
    meta.className = "meta";
    const parts: string[] = [];
    if (item.rarity) parts.push(item.rarity);
    if (typeof item.weight === "number") parts.push(`${item.weight} lb`);
    meta.textContent = parts.join(" · ");
    pop.appendChild(meta);
  }

  const desc = document.createElement("div");
  desc.className = "desc";
  desc.textContent = item?.description ?? "Item missing from catalog.";
  pop.appendChild(desc);

  document.body.appendChild(pop);
  const r = pop.getBoundingClientRect();
  const { x, y } = clampToFrame({
    x: anchor.x, y: anchor.y, width: r.width, height: r.height,
  });
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;

  active = pop;
  outsideHandler = (e: MouseEvent) => {
    if (active && !active.contains(e.target as Node)) closeDescription();
  };
  escHandler = (e: KeyboardEvent) => { if (e.key === "Escape") closeDescription(); };
  setTimeout(() => {
    document.addEventListener("mousedown", outsideHandler!);
    document.addEventListener("keydown", escHandler!);
  }, 0);
}

export function closeDescription(): void {
  if (active) active.remove();
  active = null;
  if (outsideHandler) document.removeEventListener("mousedown", outsideHandler);
  if (escHandler) document.removeEventListener("keydown", escHandler);
  outsideHandler = null;
  escHandler = null;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui-description.ts
git commit -m "feat(ui): right-click description popover with iframe clamp"
```

---

## Task 12: Transfer popover

**Files:**
- Create: `src/ui-transfer.ts`

- [ ] **Step 1: Implement**

```ts
import { clampToFrame } from "./frame";
import type { CatalogItem, PlayerInventoryRecord } from "./types";

let active: HTMLElement | null = null;
let outsideHandler: ((e: MouseEvent) => void) | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;

export interface TransferTarget { id: string; name: string; color: string; }

export interface ShowTransferOpts {
  anchor: { x: number; y: number };
  itemId: string;
  itemName: string;
  itemIcon?: string;
  maxQty: number;
  targets: TransferTarget[];
  onConfirm: (toPlayerId: string, qty: number) => Promise<void> | void;
}

export function showTransfer(opts: ShowTransferOpts): void {
  closeTransfer();
  if (opts.targets.length === 0 || opts.maxQty <= 0) return;

  const pop = document.createElement("div");
  pop.className = "popover transfer-popover";

  const h = document.createElement("h4");
  h.textContent = `Transfer ${opts.itemName}`;
  pop.appendChild(h);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `qty: <input class="transfer-qty" type="number" min="1" max="${opts.maxQty}" value="1" /> (max ${opts.maxQty})`;
  pop.appendChild(meta);

  const list = document.createElement("div");
  list.className = "transfer-list";
  for (const t of opts.targets) {
    const b = document.createElement("button");
    b.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${escapeAttr(t.color)}"></span> → ${escape(t.name)}`;
    b.onclick = async () => {
      const q = parseInt(
        (pop.querySelector(".transfer-qty") as HTMLInputElement).value, 10,
      );
      const qty = Math.max(1, Math.min(opts.maxQty, isNaN(q) ? 1 : q));
      const target = t.id;
      closeTransfer();
      await opts.onConfirm(target, qty);
    };
    list.appendChild(b);
  }
  pop.appendChild(list);

  document.body.appendChild(pop);
  const r = pop.getBoundingClientRect();
  const { x, y } = clampToFrame({
    x: opts.anchor.x, y: opts.anchor.y, width: r.width, height: r.height,
  });
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;

  active = pop;
  outsideHandler = (e: MouseEvent) => {
    if (active && !active.contains(e.target as Node)) closeTransfer();
  };
  escHandler = (e: KeyboardEvent) => { if (e.key === "Escape") closeTransfer(); };
  setTimeout(() => {
    document.addEventListener("mousedown", outsideHandler!);
    document.addEventListener("keydown", escHandler!);
  }, 0);
}

export function closeTransfer(): void {
  if (active) active.remove();
  active = null;
  if (outsideHandler) document.removeEventListener("mousedown", outsideHandler);
  if (escHandler) document.removeEventListener("keydown", escHandler);
  outsideHandler = null;
  escHandler = null;
}

export function buildTargets(
  fromPlayerId: string,
  records: Record<string, PlayerInventoryRecord>,
  excludeGmId?: string,
): TransferTarget[] {
  return Object.entries(records)
    .filter(([id]) => id !== fromPlayerId && id !== excludeGmId)
    .map(([id, rec]) => ({ id, name: rec.name, color: rec.color }));
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}
function escapeAttr(s: string): string { return escape(s); }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui-transfer.ts
git commit -m "feat(ui): shift+right-click transfer popover with qty + target list"
```

---

## Task 13: Add-to-inventory dialog

**Files:**
- Create: `src/ui-add-dialog.ts`

- [ ] **Step 1: Implement**

```ts
import type { CatalogItem } from "./types";

export interface AddDialogOpts {
  catalog: CatalogItem[];
  onAdd: (itemId: string, qty: number) => Promise<void> | void;
}

let active: HTMLElement | null = null;

export function openAddDialog(opts: AddDialogOpts): void {
  closeAddDialog();

  const overlay = document.createElement("div");
  overlay.className = "dialog-overlay";

  const header = document.createElement("div");
  header.className = "dialog-header";
  const h = document.createElement("h3");
  h.textContent = "Add to inventory";
  h.style.margin = "0";
  header.appendChild(h);
  const close = document.createElement("button");
  close.className = "dialog-close"; close.textContent = "✕";
  close.onclick = closeAddDialog;
  header.appendChild(close);
  overlay.appendChild(header);

  const search = document.createElement("input");
  search.className = "shell-search";
  search.placeholder = "Search items by name...";
  search.style.margin = "8px";
  overlay.appendChild(search);

  const body = document.createElement("div");
  body.className = "dialog-body";
  overlay.appendChild(body);

  const dropZone = document.createElement("div");
  dropZone.className = "drop-zone";
  dropZone.textContent = "Drop here to add";
  overlay.appendChild(dropZone);

  document.body.appendChild(overlay);

  const collapsed = new Set<string>();
  let dragId: string | null = null;
  let dropTimer: number | undefined;

  const render = () => {
    body.innerHTML = "";
    const q = search.value.trim().toLowerCase();
    const groups = new Map<string, CatalogItem[]>();
    for (const item of opts.catalog) {
      if (q && !item.name.toLowerCase().includes(q)) continue;
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category)!.push(item);
    }
    if (groups.size === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = q ? `No items match "${search.value}"` : "Catalog is empty";
      body.appendChild(empty);
      return;
    }
    for (const [cat, entries] of groups.entries()) {
      const ch = document.createElement("div");
      ch.className = "cat-header";
      ch.dataset.category = cat;
      const isCollapsed = collapsed.has(cat);
      ch.innerHTML = `<span><span class="chev">${isCollapsed ? "▸" : "▾"}</span> ${escapeHtml(cat)}</span><span>(${entries.length})</span>`;
      ch.onclick = () => {
        if (collapsed.has(cat)) collapsed.delete(cat); else collapsed.add(cat);
        render();
      };
      body.appendChild(ch);
      if (isCollapsed) continue;
      for (const item of entries) body.appendChild(renderAddRow(item));
    }
  };

  const renderAddRow = (item: CatalogItem): HTMLElement => {
    const row = document.createElement("div");
    row.className = "add-row";
    if (item.rarity) row.dataset.rarity = item.rarity;
    row.draggable = true;

    const icon = document.createElement("div");
    icon.className = "inv-icon";
    if (item.icon) icon.style.backgroundImage = `url("${item.icon}")`;
    row.appendChild(icon);

    const name = document.createElement("div");
    name.className = "item-name inv-name";
    if (item.rarity) name.dataset.rarity = item.rarity;
    name.textContent = item.name;
    row.appendChild(name);

    const qty = document.createElement("input");
    qty.className = "transfer-qty add-qty";
    qty.type = "number"; qty.min = "1"; qty.value = "1";
    row.appendChild(qty);

    const plus = document.createElement("button");
    plus.className = "btn-plus"; plus.textContent = "+";
    plus.onclick = async () => {
      const q = Math.max(1, parseInt(qty.value, 10) || 1);
      await opts.onAdd(item.id, q);
    };
    row.appendChild(plus);

    row.ondblclick = async () => {
      const q = Math.max(1, parseInt(qty.value, 10) || 1);
      await opts.onAdd(item.id, q);
    };

    row.addEventListener("dragstart", (e) => {
      dragId = item.id;
      dropZone.classList.add("active");
      if (e.dataTransfer) e.dataTransfer.setData("text/plain", item.id);
      // If drop never fires (iframe quirk), bail out gracefully.
      window.clearTimeout(dropTimer);
    });
    row.addEventListener("dragend", () => {
      dropTimer = window.setTimeout(() => {
        dragId = null;
        dropZone.classList.remove("active", "over");
      }, 100);
    });
    return row;
  };

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("over");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("over"));
  dropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    window.clearTimeout(dropTimer);
    const id = dragId ?? e.dataTransfer?.getData("text/plain") ?? "";
    dragId = null;
    dropZone.classList.remove("active", "over");
    if (id) await opts.onAdd(id, 1);
  });

  search.addEventListener("input", render);
  render();

  active = overlay;
  document.addEventListener("keydown", onEsc);
}

export function closeAddDialog(): void {
  if (active) active.remove();
  active = null;
  document.removeEventListener("keydown", onEsc);
}

function onEsc(e: KeyboardEvent): void {
  if (e.key === "Escape") closeAddDialog();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui-add-dialog.ts
git commit -m "feat(ui): add-to-inventory dialog with search, dbl-click, drag-to-zone, qty"
```

---

## Task 14: Shell (search + lock + footer + gold strip + weight readout)

**Files:**
- Create: `src/ui-shell.ts`

The shell wraps the list. It owns the per-popover-session UI state (search text, lock state, collapsed categories, ghost-row IDs) and re-renders the list on changes.

- [ ] **Step 1: Implement**

```ts
import { renderList, type ListState, type RowHandlers } from "./ui-list";
import { totalWeight } from "./inventory";
import type { CatalogItem, PlayerInventoryRecord } from "./types";

export interface ShellHandlers extends Omit<RowHandlers, "onIncrement" | "onDecrement" | "onRemove"> {
  onIncrement: (id: string) => Promise<void>;
  onDecrement: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onCurrencyChange: (
    field: "pp" | "gp" | "sp" | "cp", value: number,
  ) => Promise<void>;
  onAddClick: () => void;
}

export interface ShellRefs {
  rerender: (record: PlayerInventoryRecord, catalog: CatalogItem[]) => void;
  destroy: () => void;
}

export function mountShell(
  root: HTMLElement,
  initialRecord: PlayerInventoryRecord,
  catalog: CatalogItem[],
  handlers: ShellHandlers,
): ShellRefs {
  root.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "shell";

  // Header
  const header = document.createElement("div");
  header.className = "shell-header";
  const search = document.createElement("input");
  search.className = "shell-search";
  search.placeholder = "Search inventory...";
  header.appendChild(search);
  const lockBtn = document.createElement("button");
  lockBtn.className = "lock-toggle";
  lockBtn.textContent = "🔒";
  lockBtn.title = "Click to unlock editing";
  header.appendChild(lockBtn);
  wrap.appendChild(header);

  // Body
  const body = document.createElement("div");
  body.className = "shell-body";
  wrap.appendChild(body);

  // Footer
  const footer = document.createElement("div");
  footer.className = "shell-footer";
  const weightEl = document.createElement("span");
  weightEl.textContent = "⚖ 0 lb";
  footer.appendChild(weightEl);
  const addBtn = document.createElement("button");
  addBtn.className = "btn-add";
  addBtn.textContent = "+ Add to inventory";
  addBtn.onclick = handlers.onAddClick;
  footer.appendChild(addBtn);
  wrap.appendChild(footer);

  // Gold
  const gold = document.createElement("div");
  gold.className = "gold-strip";
  const ccyInputs: Record<string, HTMLInputElement> = {} as any;
  for (const f of ["pp", "gp", "sp", "cp"] as const) {
    const cell = document.createElement("div");
    cell.className = "gold-cell";
    cell.innerHTML = `<label>${f}</label>`;
    const inp = document.createElement("input");
    inp.type = "number"; inp.min = "0"; inp.value = "0";
    inp.onchange = () => {
      const v = Math.max(0, parseInt(inp.value, 10) || 0);
      inp.value = String(v);
      handlers.onCurrencyChange(f, v);
    };
    cell.appendChild(inp);
    gold.appendChild(cell);
    ccyInputs[f] = inp;
  }
  wrap.appendChild(gold);

  root.appendChild(wrap);

  // State
  let unlocked = false;
  const collapsed = new Set<string>();
  const ghosts = new Set<string>();
  let currentRecord = initialRecord;
  let currentCatalog = catalog;

  const updateLockUI = () => {
    lockBtn.textContent = unlocked ? "🔓" : "🔒";
    lockBtn.classList.toggle("unlocked", unlocked);
    lockBtn.title = unlocked ? "Click to lock editing" : "Click to unlock editing";
    addBtn.style.display = unlocked ? "" : "none";
  };

  const rerender = (record: PlayerInventoryRecord, cat: CatalogItem[]) => {
    currentRecord = record;
    currentCatalog = cat;
    // Update gold values without stomping a focused input.
    for (const f of ["pp","gp","sp","cp"] as const) {
      if (document.activeElement !== ccyInputs[f]) {
        ccyInputs[f].value = String(record.currency[f] ?? 0);
      }
    }
    // Update weight
    weightEl.textContent = `⚖ ${formatWeight(totalWeight(record.items, cat))} lb`;
    // Render list
    const state: ListState = {
      items: record.items,
      catalog: cat,
      search: search.value,
      unlocked,
      collapsed,
      ghosts,
    };
    renderList(body, state, {
      onIncrement: (id) => {
        ghosts.add(id);
        void handlers.onIncrement(id);
      },
      onDecrement: (id) => {
        ghosts.add(id);
        void handlers.onDecrement(id);
      },
      onRemove: (id) => {
        ghosts.delete(id);
        void handlers.onRemove(id);
      },
      onDescription: handlers.onDescription,
      onTransfer: handlers.onTransfer,
    });
  };

  search.addEventListener("input", () => rerender(currentRecord, currentCatalog));
  search.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      search.value = "";
      rerender(currentRecord, currentCatalog);
    }
  });
  body.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const cat = t.closest<HTMLElement>(".cat-header")?.dataset.category;
    if (cat) {
      if (collapsed.has(cat)) collapsed.delete(cat); else collapsed.add(cat);
      rerender(currentRecord, currentCatalog);
    }
  });
  lockBtn.onclick = () => {
    unlocked = !unlocked;
    updateLockUI();
    rerender(currentRecord, currentCatalog);
  };

  updateLockUI();
  rerender(initialRecord, catalog);

  return {
    rerender,
    destroy: () => { root.innerHTML = ""; },
  };
}

function formatWeight(w: number): string {
  if (w === 0) return "0";
  if (Number.isInteger(w)) return String(w);
  return w.toFixed(1);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui-shell.ts
git commit -m "feat(ui): shell with search, lock toggle, footer weight, gold strip"
```

---

## Task 15: Player view assembly

**Files:**
- Create: `src/ui-player.ts`

This module wires shell handlers to metadata operations and SDK calls. It also handles the broadcast subscription for `transfer-received` notifications.

- [ ] **Step 1: Implement**

```ts
import OBR from "@owlbear-rodeo/sdk";
import { mountShell } from "./ui-shell";
import { renderList } from "./ui-list";
import { showDescription } from "./ui-description";
import { showTransfer, buildTargets } from "./ui-transfer";
import { openAddDialog, closeAddDialog } from "./ui-add-dialog";
import {
  getRecord, writeRecord, listInventoryRecords, onRoomMetadataChange,
} from "./metadata";
import {
  addItem, incrementItem, decrementItem, removeItem,
} from "./inventory";
import { transferItem } from "./transfer";
import { BROADCAST_CHANNEL } from "./constants";
import type {
  CatalogItem, PlayerInventoryRecord, BroadcastMessage,
} from "./types";
import { OverCapError } from "./types";

export interface PlayerViewOpts {
  root: HTMLElement;
  catalog: CatalogItem[];
  playerId: string;
  initialRecord: PlayerInventoryRecord;
}

export function mountPlayerView(opts: PlayerViewOpts): () => void {
  const byId = new Map(opts.catalog.map((c) => [c.id, c]));
  let current = opts.initialRecord;

  const refs = mountShell(opts.root, current, opts.catalog, {
    onIncrement: async (id) => {
      try { await writeRecord(opts.playerId, incrementItem(current, id)); }
      catch (e) { revertOptimistic(); rethrowIfNotCap(e); }
    },
    onDecrement: async (id) => {
      try { await writeRecord(opts.playerId, decrementItem(current, id)); }
      catch (e) { revertOptimistic(); rethrowIfNotCap(e); }
    },
    onRemove: async (id) => {
      try { await writeRecord(opts.playerId, removeItem(current, id)); }
      catch (e) { revertOptimistic(); rethrowIfNotCap(e); }
    },
    onCurrencyChange: async (f, v) => {
      const updated: PlayerInventoryRecord = {
        ...current, currency: { ...current.currency, [f]: v },
      };
      try { await writeRecord(opts.playerId, updated); }
      catch (e) { revertOptimistic(); rethrowIfNotCap(e); }
    },
    onAddClick: () => {
      openAddDialog({
        catalog: opts.catalog,
        onAdd: async (id, qty) => {
          try {
            await writeRecord(opts.playerId, addItem(current, id, qty));
            closeAddDialog();
          } catch (e) {
            rethrowIfNotCap(e);
            // silently leave dialog open; player can't see why; GM gets a popup
          }
        },
      });
    },
    onDescription: (id, anchor) => {
      showDescription(anchor, byId.get(id) ?? null, id);
    },
    onTransfer: async (id, anchor) => {
      const all = await listInventoryRecords();
      const targets = buildTargets(opts.playerId, all);
      const ci = byId.get(id);
      const entry = current.items.find(([eid]) => eid === id);
      if (!entry || entry[1] <= 0) return;
      showTransfer({
        anchor,
        itemId: id,
        itemName: ci?.name ?? id,
        itemIcon: ci?.icon,
        maxQty: entry[1],
        targets,
        onConfirm: async (toPlayerId, qty) => {
          try {
            await transferItem({
              fromPlayerId: opts.playerId,
              toPlayerId,
              itemId: id,
              itemName: ci?.name ?? id,
              qty,
            });
          } catch (e) { rethrowIfNotCap(e); }
        },
      });
    },
  });

  const unsubMeta = onRoomMetadataChange(async (records) => {
    const me = records[opts.playerId];
    if (!me) return;
    current = me;
    refs.rerender(current, opts.catalog);
  });

  const unsubBroadcast = OBR.broadcast.onMessage(
    BROADCAST_CHANNEL, (ev: { data: BroadcastMessage }) => {
      const msg = ev.data;
      if (msg.type === "transfer-received" && msg.toPlayerId === opts.playerId) {
        OBR.notification?.show?.(
          `${msg.fromName} gave you ${msg.quantity}× ${msg.itemName}`,
          "INFO",
        ).catch(() => console.warn("notification.show unavailable"));
      }
    },
  );

  function revertOptimistic() {
    refs.rerender(current, opts.catalog);
  }
  function rethrowIfNotCap(e: unknown) {
    if (!(e instanceof OverCapError)) throw e;
  }

  return () => { unsubMeta(); unsubBroadcast(); refs.destroy(); };
}
```

Note: `OBR.broadcast.onMessage` signature: subscribe with `(event) => void`, returns an unsubscribe function. The mock should expose `onMessage` — add to the mock if not present (see Step 2).

- [ ] **Step 2: Update mock to support `broadcast.onMessage`**

Edit `test/_mocks/obr-sdk.ts` to add to the `OBR.broadcast` object:

```ts
const broadcastListeners: Record<string, Array<(ev: { data: unknown }) => void>> = {};
// in OBR.broadcast:
onMessage: vi.fn((channel: string, cb: (ev: { data: unknown }) => void) => {
  if (!broadcastListeners[channel]) broadcastListeners[channel] = [];
  broadcastListeners[channel].push(cb);
  return () => {
    const arr = broadcastListeners[channel] ?? [];
    const i = arr.indexOf(cb);
    if (i >= 0) arr.splice(i, 1);
  };
}),
```

And update `sendMessage` to also dispatch to the channel listeners after recording the broadcast:

```ts
sendMessage: vi.fn(async (channel, data, opts) => {
  broadcasts.push({ channel, data, targets: opts?.destination });
  for (const l of broadcastListeners[channel] ?? []) l({ data });
}),
```

Also reset `broadcastListeners` in `__testHooks.reset()`.

- [ ] **Step 3: Run all existing tests**

Run: `npm test`
Expected: all prior tests still pass.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui-player.ts test/_mocks/obr-sdk.ts
git commit -m "feat(ui): player view wiring + broadcast subscription"
```

---

## Task 16: GM view (tabs, meter, download, over-cap modal)

**Files:**
- Create: `src/ui-gm.ts`

- [ ] **Step 1: Implement**

```ts
import OBR from "@owlbear-rodeo/sdk";
import { mountShell } from "./ui-shell";
import { showDescription } from "./ui-description";
import { showTransfer, buildTargets } from "./ui-transfer";
import { openAddDialog, closeAddDialog } from "./ui-add-dialog";
import {
  listInventoryRecords, writeRecord, inventoryByteSize, onRoomMetadataChange,
} from "./metadata";
import {
  addItem, incrementItem, decrementItem, removeItem,
} from "./inventory";
import { transferItem } from "./transfer";
import { buildExport, downloadExport } from "./export";
import {
  BROADCAST_CHANNEL, STORAGE_CAP_BYTES,
  METER_YELLOW_RATIO, METER_RED_RATIO,
} from "./constants";
import { OverCapError } from "./types";
import type {
  CatalogItem, PlayerInventoryRecord, BroadcastMessage,
} from "./types";

export interface GmViewOpts {
  root: HTMLElement;
  catalog: CatalogItem[];
  catalogUrl: string;
  selfId: string;
  selfName: string;
  selfColor: string;
}

export function mountGmView(opts: GmViewOpts): () => void {
  const byId = new Map(opts.catalog.map((c) => [c.id, c]));

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.height = "100%";

  const tabsEl = document.createElement("div");
  tabsEl.className = "tabs";
  wrap.appendChild(tabsEl);

  const meterEl = document.createElement("div");
  meterEl.className = "meter-strip";
  meterEl.innerHTML = `<div class="meter-bar"><div class="meter-fill"></div></div><div class="meter-text"></div>`;
  wrap.appendChild(meterEl);

  const shellRoot = document.createElement("div");
  shellRoot.style.flex = "1";
  shellRoot.style.minHeight = "0";
  wrap.appendChild(shellRoot);

  opts.root.innerHTML = "";
  opts.root.appendChild(wrap);

  let records: Record<string, PlayerInventoryRecord> = {};
  let activePid = opts.selfId;
  let shellRefs: { rerender: (r: PlayerInventoryRecord, cat: CatalogItem[]) => void; destroy: () => void } | null = null;

  const renderTabs = () => {
    tabsEl.innerHTML = "";
    const ids = Object.keys(records).sort((a, b) => {
      if (a === opts.selfId) return 1;     // self at the end
      if (b === opts.selfId) return -1;
      return records[a].name.localeCompare(records[b].name);
    });
    for (const pid of ids) {
      const t = document.createElement("button");
      t.className = "tab" + (pid === activePid ? " active" : "");
      t.style.borderLeftColor = records[pid].color;
      t.textContent = records[pid].name + (pid === opts.selfId ? " (GM)" : "");
      t.onclick = () => { activePid = pid; renderAll(); };
      tabsEl.appendChild(t);
    }
    const dl = document.createElement("button");
    dl.className = "tab-download";
    dl.textContent = "⤓";
    dl.title = "Download backup JSON";
    dl.onclick = async () => {
      const exp = await buildExport(opts.catalog, opts.catalogUrl);
      downloadExport(exp);
    };
    tabsEl.appendChild(dl);
  };

  const renderMeter = async () => {
    const bytes = await inventoryByteSize();
    const ratio = bytes / STORAGE_CAP_BYTES;
    const fill = meterEl.querySelector(".meter-fill") as HTMLElement;
    const text = meterEl.querySelector(".meter-text") as HTMLElement;
    fill.style.width = `${Math.min(100, ratio * 100).toFixed(1)}%`;
    fill.dataset.state = ratio >= METER_RED_RATIO ? "red"
      : ratio >= METER_YELLOW_RATIO ? "yellow" : "green";
    text.textContent = `${(bytes / 1024).toFixed(1)} KB / ${(STORAGE_CAP_BYTES / 1024).toFixed(0)} KB`;
  };

  const renderShell = () => {
    const rec = records[activePid];
    if (!rec) return;
    if (shellRefs) shellRefs.destroy();
    shellRefs = mountShell(shellRoot, rec, opts.catalog, {
      onIncrement: async (id) => {
        try { await writeRecord(activePid, incrementItem(rec, id)); }
        catch (e) { gmHandleErr(e); shellRefs?.rerender(rec, opts.catalog); }
      },
      onDecrement: async (id) => {
        try { await writeRecord(activePid, decrementItem(rec, id)); }
        catch (e) { gmHandleErr(e); shellRefs?.rerender(rec, opts.catalog); }
      },
      onRemove: async (id) => {
        try { await writeRecord(activePid, removeItem(rec, id)); }
        catch (e) { gmHandleErr(e); shellRefs?.rerender(rec, opts.catalog); }
      },
      onCurrencyChange: async (f, v) => {
        const u = { ...rec, currency: { ...rec.currency, [f]: v } };
        try { await writeRecord(activePid, u); }
        catch (e) { gmHandleErr(e); shellRefs?.rerender(rec, opts.catalog); }
      },
      onAddClick: () => {
        openAddDialog({
          catalog: opts.catalog,
          onAdd: async (id, qty) => {
            try {
              await writeRecord(activePid, addItem(rec, id, qty));
              closeAddDialog();
            } catch (e) { gmHandleErr(e); }
          },
        });
      },
      onDescription: (id, anchor) => showDescription(anchor, byId.get(id) ?? null, id),
      onTransfer: async (id, anchor) => {
        const all = await listInventoryRecords();
        const targets = buildTargets(activePid, all, opts.selfId);
        const ci = byId.get(id);
        const entry = rec.items.find(([eid]) => eid === id);
        if (!entry || entry[1] <= 0) return;
        showTransfer({
          anchor, itemId: id,
          itemName: ci?.name ?? id, itemIcon: ci?.icon,
          maxQty: entry[1], targets,
          onConfirm: async (toPlayerId, qty) => {
            try {
              await transferItem({
                fromPlayerId: activePid, toPlayerId,
                itemId: id, itemName: ci?.name ?? id, qty,
              });
            } catch (e) { gmHandleErr(e); }
          },
        });
      },
    });
  };

  const renderAll = () => {
    renderTabs();
    void renderMeter();
    renderShell();
  };

  const gmHandleErr = (e: unknown) => {
    if (e instanceof OverCapError) {
      showOverCapModal({
        triggeringPlayerName: records[activePid]?.name ?? activePid,
        attempted: e.attempted,
        currentBytes: e.currentBytes,
        cap: e.cap,
      });
      return;
    }
    throw e;
  };

  const unsubMeta = onRoomMetadataChange((next) => {
    records = next;
    if (!records[activePid]) activePid = opts.selfId;
    renderAll();
  });

  const unsubBroadcast = OBR.broadcast.onMessage(
    BROADCAST_CHANNEL, (ev: { data: BroadcastMessage }) => {
      const msg = ev.data;
      if (msg.type === "over-cap") {
        showOverCapModal({
          triggeringPlayerName: msg.triggeringPlayerName,
          attempted: msg.attempted,
          currentBytes: msg.currentBytes,
          cap: msg.cap,
        });
      }
    },
  );

  // Initial fetch
  void (async () => {
    records = await listInventoryRecords();
    if (!records[opts.selfId]) {
      // Ensure GM tab exists
      await writeRecord(opts.selfId, {
        name: opts.selfName, color: opts.selfColor,
        items: [], currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
      });
      records = await listInventoryRecords();
    }
    renderAll();
  })();

  return () => { unsubMeta(); unsubBroadcast(); shellRefs?.destroy(); };
}

function showOverCapModal(args: {
  triggeringPlayerName: string;
  attempted: string;
  currentBytes: number;
  cap: number;
}) {
  const back = document.createElement("div");
  back.className = "modal-backdrop";
  const m = document.createElement("div");
  m.className = "modal";
  m.innerHTML = `
    <h3>Inventory storage full</h3>
    <p><strong>${escapeHtml(args.triggeringPlayerName)}</strong> tried: ${escapeHtml(args.attempted)}</p>
    <p>Current usage: ${(args.currentBytes/1024).toFixed(2)} KB of ${(args.cap/1024).toFixed(0)} KB</p>
    <button class="ok-btn">Got it</button>
  `;
  back.appendChild(m);
  document.body.appendChild(back);
  (m.querySelector(".ok-btn") as HTMLButtonElement).onclick = () => back.remove();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui-gm.ts
git commit -m "feat(ui): GM view with tabs, storage meter, JSON download, over-cap modal"
```

---

## Task 17: Bootstrap (`main.ts`)

**Files:**
- Create: `src/main.ts`

- [ ] **Step 1: Implement**

```ts
import OBR from "@owlbear-rodeo/sdk";
import { fetchCatalog } from "./catalog";
import { ensureRecord, getRecord } from "./metadata";
import { mountPlayerView } from "./ui-player";
import { mountGmView } from "./ui-gm";
import { injectBaseStyles, injectStyles } from "./styles";
import { LIST_CSS } from "./styles-list";
import { DIALOG_CSS } from "./styles-dialog";
import { DEFAULT_CATALOG_URL, CONFIG_KEY } from "./constants";
import type { ExtensionConfig } from "./types";

OBR.onReady(async () => {
  injectBaseStyles();
  injectStyles(LIST_CSS, "obr-inv-list-styles");
  injectStyles(DIALOG_CSS, "obr-inv-dialog-styles");

  const root = document.getElementById("root");
  if (!root) return;

  const role = await OBR.player.getRole();
  const selfId = OBR.player.id;
  const selfName = await OBR.player.getName();
  const selfColor = await OBR.player.getColor();

  // Resolve catalog URL from config (GM may have set a custom URL)
  const md = await OBR.room.getMetadata();
  const cfg = (md[CONFIG_KEY] as ExtensionConfig | undefined);
  const catalogUrl = cfg?.catalogUrl ?? DEFAULT_CATALOG_URL;

  let catalog;
  try {
    catalog = await fetchCatalog(catalogUrl);
  } catch (err) {
    console.error("[obr-inv] catalog fetch failed", err);
    root.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-dim)">Couldn't load item catalog. Inventory display is paused — try reopening.</div>`;
    return;
  }

  await ensureRecord(selfId, selfName, selfColor);

  if (role === "GM") {
    mountGmView({
      root, catalog, catalogUrl,
      selfId, selfName, selfColor,
    });
  } else {
    const initial = await getRecord(selfId);
    if (!initial) return;
    mountPlayerView({
      root, catalog, playerId: selfId, initialRecord: initial,
    });
  }
});
```

If `OBR.onReady` is not exported by the SDK type, fall back to `OBR.ready(...)` (the SDK uses `onReady` on v3+; the mock supports both shapes — adjust if needed).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (If the SDK signature mismatches, replace `OBR.onReady(async () => {...})` with `await OBR.ready(); ...` or wrap in `OBR.onReady` as appropriate to the v3.1 SDK shape — verify against `node_modules/@owlbear-rodeo/sdk/dist/index.d.ts`.)

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds, `dist/` contains hashed `index-*.js`, `index.html`, and `public/` assets.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: role-aware bootstrap entry point"
```

---

## Task 18: UI smoke tests

**Files:**
- Create: `test/ui-smoke.test.ts`

- [ ] **Step 1: Write the smoke tests**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { __testHooks } from "./_mocks/obr-sdk";
import { mountShell } from "../src/ui-shell";
import type { CatalogItem, PlayerInventoryRecord } from "../src/types";

const catalog: CatalogItem[] = [
  { id: "h1", name: "Healing Potion", category: "Consumables",
    icon: "u", description: "d", rarity: "uncommon", weight: 0.5 },
  { id: "a1", name: "+1 Arrows", category: "Weapons",
    icon: "u", description: "Sharp.", rarity: "rare" },
];

const record: PlayerInventoryRecord = {
  name: "Alice", color: "#fff",
  items: [["h1", 3], ["a1", 20]],
  currency: { pp: 0, gp: 142, sp: 7, cp: 3 },
};

describe("ui-shell smoke", () => {
  beforeEach(() => {
    __testHooks.reset();
    document.body.innerHTML = "";
  });

  it("mounts a shell with the right number of rows", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    mountShell(root, record, catalog, makeNoopHandlers());
    const rows = root.querySelectorAll(".inv-row");
    expect(rows.length).toBe(2);
  });

  it("hides ± and × buttons when locked", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    mountShell(root, record, catalog, makeNoopHandlers());
    expect(root.querySelectorAll('[data-action="dec"]').length).toBe(0);
    expect(root.querySelectorAll('[data-action="inc"]').length).toBe(0);
    expect(root.querySelectorAll('[data-action="remove"]').length).toBe(0);
  });

  it("reveals ± and × after clicking the lock toggle", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    mountShell(root, record, catalog, makeNoopHandlers());
    (root.querySelector(".lock-toggle") as HTMLButtonElement).click();
    expect(root.querySelectorAll('[data-action="dec"]').length).toBe(2);
    expect(root.querySelectorAll('[data-action="inc"]').length).toBe(2);
    expect(root.querySelectorAll('[data-action="remove"]').length).toBe(2);
  });

  it("filters by name only on search (description match doesn't show)", () => {
    const cat: CatalogItem[] = [
      { id: "x1", name: "Sword", category: "Weapons",
        icon: "u", description: "potion of stabbing" },
      { id: "x2", name: "Healing Potion", category: "Consumables",
        icon: "u", description: "drink" },
    ];
    const r: PlayerInventoryRecord = {
      name: "A", color: "#fff",
      items: [["x1", 1], ["x2", 1]],
      currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    };
    const root = document.createElement("div");
    document.body.appendChild(root);
    mountShell(root, r, cat, makeNoopHandlers());
    const search = root.querySelector(".shell-search") as HTMLInputElement;
    search.value = "potion";
    search.dispatchEvent(new Event("input"));
    const visibleNames = Array.from(root.querySelectorAll(".inv-name"))
      .map((el) => el.textContent ?? "");
    expect(visibleNames).toEqual(["Healing Potion"]);
  });
});

function makeNoopHandlers() {
  return {
    onIncrement: async () => {},
    onDecrement: async () => {},
    onRemove: async () => {},
    onCurrencyChange: async () => {},
    onAddClick: () => {},
    onDescription: () => {},
    onTransfer: () => {},
  };
}
```

- [ ] **Step 2: Run tests**

Run: `npm test -- ui-smoke`
Expected: all 4 smoke tests pass.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests pass (~35-40 cases).

- [ ] **Step 4: Commit**

```bash
git add test/ui-smoke.test.ts
git commit -m "test: smoke tests for shell render, lock state, name-only search"
```

---

## Task 19: GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm test
      - run: npm run build

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add Pages deploy workflow with test gate"
```

---

## Task 20: Catalog seed (separate repo bootstrapping)

The catalog lives in a separate repo: `obr-inv-catalog`. This task creates the seed file and tooling there. **Do this in a sibling directory** (not inside `obr-inv`).

**Files (in `../obr-inv-catalog/`):**
- Create: `../obr-inv-catalog/items.json`
- Create: `../obr-inv-catalog/scripts/add-item.mjs`
- Create: `../obr-inv-catalog/.github/workflows/deploy.yml`
- Create: `../obr-inv-catalog/index.html` (so Pages has a default page)

- [ ] **Step 1: Initialize the sibling repo**

```bash
cd ..
mkdir obr-inv-catalog && cd obr-inv-catalog
git init -b main
```

- [ ] **Step 2: Write a seed `items.json` with a handful of common items**

```json
[
  { "id": "h7p2Xy", "name": "Healing Potion", "category": "Consumables",
    "icon": "https://5e.tools/img/items/XPHB/Potion%20of%20Healing.webp",
    "description": "When you drink this potion, you regain 2d4 + 2 hit points.",
    "rarity": "common", "weight": 0.5 },
  { "id": "torch01", "name": "Torch", "category": "Adventuring Gear",
    "icon": "https://5e.tools/img/items/XPHB/Torch.webp",
    "description": "A torch burns for 1 hour, providing bright light in a 20-foot radius.",
    "rarity": "common", "weight": 1 },
  { "id": "rope50", "name": "Rope, Hempen (50 ft)", "category": "Adventuring Gear",
    "icon": "https://5e.tools/img/items/XPHB/Rope%2C%20Hempen.webp",
    "description": "Rope has 2 hit points and can be burst with a DC 17 Strength check.",
    "rarity": "common", "weight": 10 },
  { "id": "arrow1", "name": "Arrows (20)", "category": "Ammunition",
    "icon": "https://5e.tools/img/items/XPHB/Arrow.webp",
    "description": "Standard arrows, used with shortbows and longbows.",
    "rarity": "common", "weight": 1 }
]
```

- [ ] **Step 3: Write `scripts/add-item.mjs`**

```js
#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function nanoid(len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
}

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "..", "items.json");
const items = JSON.parse(readFileSync(file, "utf8"));
const seen = new Set(items.map((i) => i.id));

let id;
do { id = nanoid(); } while (seen.has(id));

const stub = {
  id,
  name: "TODO",
  category: "TODO",
  icon: "https://...",
  description: "TODO",
  rarity: "common",
  weight: 0,
};

console.log("Generated stub. Paste into items.json:");
console.log(JSON.stringify(stub, null, 2));
console.log(`\nThen re-run this script with --validate to check for problems.`);

if (process.argv.includes("--validate")) {
  const required = ["id", "name", "category", "icon", "description"];
  let bad = 0;
  const ids = new Set();
  for (const it of items) {
    for (const f of required) {
      if (typeof it[f] !== "string" || it[f].length === 0) {
        console.error(`bad item: missing ${f}`, it);
        bad++;
      }
    }
    if (ids.has(it.id)) {
      console.error(`duplicate id ${it.id}`);
      bad++;
    }
    ids.add(it.id);
  }
  if (bad > 0) process.exit(1);
  console.log(`OK: ${items.length} items, no problems.`);
}
```

- [ ] **Step 4: Add a default Pages page**

```html
<!-- index.html -->
<!doctype html>
<html><body>
  <p>OBR Inventory Catalog — see <a href="./items.json">items.json</a>.</p>
</body></html>
```

- [ ] **Step 5: Add a Pages workflow**

```yaml
# .github/workflows/deploy.yml
name: Deploy catalog
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 6: Commit and push the catalog repo**

```bash
git add .
git commit -m "feat: initial catalog seed and add-item tooling"
# create the GitHub repo at github.com/abottchen/obr-inv-catalog manually (or with gh)
git remote add origin https://github.com/abottchen/obr-inv-catalog.git
git push -u origin main
```

- [ ] **Step 7: Validate the catalog parses with the extension's validator**

Back in `obr-inv/`:

Run: `npx vitest run -t "parseCatalog"`
Expected: existing parser tests still pass. (If you want a one-off sanity check, add a temporary test that imports the seed JSON via fetch mock — not required.)

---

## Task 21: README, manual test pass, deploy

**Files:**
- Create: `README.md`
- Update: anywhere a real bug surfaces during the manual pass

- [ ] **Step 1: Write `README.md`**

```markdown
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
```

- [ ] **Step 2: Run the full test suite one more time**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 3: Build and dev-serve**

Run: `npm run dev`
Open `http://localhost:5173/` in a browser. Inspect for console errors. (You won't see real OBR behavior outside the OBR app, but the catalog fetch and shell rendering should at least crash-test cleanly.)

- [ ] **Step 4: Push to GitHub**

```bash
git add README.md
git commit -m "docs: README with setup, dev, and deploy notes"
git push
```

GitHub Actions runs the test gate then deploys to Pages.

- [ ] **Step 5: Manual test in OBR**

In OBR (web app):
1. Settings → Extensions → Add custom: `https://abottchen.github.io/obr-inv/manifest.json`.
2. Open a room with at least 2 connected players + the GM.
3. As GM, open the Inventory popover. Confirm tabs appear, meter renders, and self-tab is empty.
4. Use "+ Add to inventory" to populate items into your tab and one player's tab.
5. As the player (different OBR session / browser profile), open the popover. Confirm only their tab is shown, lock toggle works, gold inputs commit, weight readout updates.
6. Right-click an item — description popover appears anchored to row, doesn't clip the iframe.
7. Shift+right-click an item — transfer popover lists the other player. Send 1 to the other player. Confirm the recipient sees the item and gets a notification.
8. Decrement an item to 0 — row stays at 0 in the UI, no errors. Close the popover, reopen — the 0 row is gone.
9. As GM, click the download icon — confirm a JSON file downloads with `exportedAt`, hydrated entries, and currency.
10. Force the over-cap path: have the GM paste a long item name into the catalog config repo (or temporarily lower the cap in `constants.ts` for testing). Try to add an item; confirm the GM sees the over-cap modal and the player sees no UI change.
11. Lock-state: lock the inventory; confirm ± and × disappear; gold inputs and shift+right-click transfer still work.

- [ ] **Step 6: Commit any fixes from the manual pass**

For each issue found, file a fix as its own commit. Re-run `npm test` after each.

- [ ] **Step 7: Final push**

```bash
git push
```

---

## Done.

When all 21 tasks are complete, the extension is deployed at `abottchen.github.io/obr-inv` and the catalog at `abottchen.github.io/obr-inv-catalog/items.json`. The full Vitest suite (~35-40 cases) runs in CI before every Pages deploy, and the OBR popover behavior matches the spec.

If a future feature needs a new field on items (e.g., charges, attunement), the catalog tolerates it (forward-compatible parser), but the storage may need a `v2` migration if it grows the per-record payload above the current cap.

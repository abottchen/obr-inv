export const EXTENSION_ID = "com.abottchen.obr-inv";
export const METADATA_KEY_PREFIX = `${EXTENSION_ID}/v1/`;
export const CONFIG_KEY = `${EXTENSION_ID}/config`;
export const BROADCAST_CHANNEL = `${EXTENSION_ID}/events`;
export const CUSTOMS_KEY = `${METADATA_KEY_PREFIX}customs`;

export const STORAGE_CAP_BYTES = 8192;
export const METER_YELLOW_RATIO = 0.75;
export const METER_RED_RATIO = 0.90;

// Relative URL: resolves against the page that loaded the extension,
// so dev (vite serving public/) and prod (Pages serving dist/) both
// fetch the catalog from the same domain that hosts the extension.
export const DEFAULT_CATALOG_URL = "./data/items.json";

export const RARITIES = [
  "common",
  "uncommon",
  "rare",
  "very rare",
  "legendary",
] as const;

// Rarity colours follow the D&D contract (green/blue/purple/orange) but use
// deeper, less neon variants that sit better on the leather palette without
// breaking recognisability.
export const RARITY_COLORS: Record<string, string> = {
  common: "#968259",
  uncommon: "#7fa844",
  rare: "#5a93c4",
  "very rare": "#a87bc8",
  legendary: "#e6a93f",
};

export const CURRENCY_COLORS: Record<"pp" | "gp" | "sp" | "cp", string> = {
  pp: "#e0e0e8",
  gp: "#f0c878",
  sp: "#cfcfcf",
  cp: "#c47a4a",
};

// Leather-codex theme: oxblood/umber backgrounds, gilded brass accent,
// parchment text. Replaces the previous slate/purple palette.
export const THEME = {
  bg0: "#14100b",   // shell ground (deepest)
  bg1: "#1c150f",   // panel face
  bg2: "#261c14",   // raised surface (rows, cells, popovers)
  border: "#3f2e21",
  text: "#ece0c2",      // parchment
  textDim: "#b09a76",   // sepia
  accent: "#c8a44e",       // gilt
  accentSoft: "#e8cf86",   // bright gilt for hover/glow
  ok: "#7fa844",
  warn: "#d68a2a",
  bad: "#c4564a",
} as const;

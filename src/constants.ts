export const EXTENSION_ID = "com.abottchen.obr-inv";
export const METADATA_KEY_PREFIX = `${EXTENSION_ID}/v1/`;
export const CONFIG_KEY = `${EXTENSION_ID}/config`;
export const BROADCAST_CHANNEL = `${EXTENSION_ID}/events`;
export const CUSTOMS_KEY = `${METADATA_KEY_PREFIX}customs`;

export const STORAGE_CAP_BYTES = 5120;
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

export const RARITY_COLORS: Record<string, string> = {
  common: "#888",
  uncommon: "#4caf50",
  rare: "#2196f3",
  "very rare": "#9c27b0",
  legendary: "#ff9800",
};

export const CURRENCY_COLORS: Record<"pp" | "gp" | "sp" | "cp", string> = {
  pp: "#d0d0d8",
  gp: "#ffd700",
  sp: "#c0c0c0",
  cp: "#b87333",
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

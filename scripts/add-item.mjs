#!/usr/bin/env node
/**
 * Usage:
 *   node scripts/add-item.mjs                  # print blank stub
 *   node scripts/add-item.mjs "Longsword"       # look up in 5etools, append to items.json
 *   node scripts/add-item.mjs --validate        # check items.json for problems
 *
 * 5etools lookup requires ../5etools-src to be present.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ALPHA = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function nanoid(len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
}

const here = dirname(fileURLToPath(import.meta.url));
const catalogFile = join(here, "..", "public", "data", "items.json");
const items = JSON.parse(readFileSync(catalogFile, "utf8"));
const usedIds = new Set(items.map((i) => i.id));

function freshId() {
  let id;
  do { id = nanoid(); } while (usedIds.has(id));
  usedIds.add(id);
  return id;
}

// ── --validate ────────────────────────────────────────────────────────────────

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
  process.exit(0);
}

// ── 5etools lookup ────────────────────────────────────────────────────────────

const TYPE_TO_CATEGORY = {
  A:   "Ammunition",
  AT:  "Tool",
  G:   "Adventuring Gear",
  GS:  "Tool",
  HA:  "Armor",
  INS: "Tool",
  LA:  "Armor",
  M:   "Weapon",
  MA:  "Armor",
  MNT: "Animal",
  P:   "Consumable",
  R:   "Weapon",
  RD:  "Wondrous Item",
  RG:  "Wondrous Item",
  S:   "Armor",
  SC:  "Adventuring Gear - Spell Scrolls",
  SCF: "Spellcasting Focus",
  ST:  "Wondrous Item",
  T:   "Tool",
  WD:  "Wondrous Item",
};

function entriesText(entries) {
  if (!entries) return "";
  return entries
    .map((e) => {
      if (typeof e === "string") return e;
      if (e && typeof e === "object" && e.entries) return entriesText(e.entries);
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

function load5etools() {
  const gitCommonDir = execSync("git rev-parse --git-common-dir", { encoding: "utf8" }).trim();
  const repoRoot = resolve(gitCommonDir, "..");
  const base = resolve(repoRoot, "..", "5etools-src", "data");

  const all = [];
  for (const [file, key] of [["items.json", "item"], ["items-base.json", "baseitem"]]) {
    try {
      const d = JSON.parse(readFileSync(join(base, file), "utf8"));
      all.push(...(d[key] ?? []));
    } catch {
      console.warn(`warning: could not read ${file} from 5etools-src`);
    }
  }
  return all;
}

function findInFtools(name, ftItems) {
  const needle = name.toLowerCase().trim();
  // Prefer XPHB, then any source
  const matches = ftItems.filter((i) => i.name?.toLowerCase().trim() === needle);
  return matches.find((i) => i.source === "XPHB") ?? matches[0] ?? null;
}

const searchName = process.argv.slice(2).find((a) => !a.startsWith("--"));

if (searchName) {
  const ftItems = load5etools();
  const found = findInFtools(searchName, ftItems);

  if (!found) {
    console.error(`Not found in 5etools: "${searchName}"`);
    console.error("Falling back to blank stub — fill in manually.");
    const stub = { id: freshId(), name: searchName, category: "TODO", icon: "https://...", description: "TODO", rarity: "common" };
    console.log(JSON.stringify(stub, null, 2));
    process.exit(1);
  }

  const source = found.source ?? "XPHB";
  const encodedName = encodeURIComponent(found.name);
  const icon = `https://5e.tools/img/items/${source}/${encodedName}.webp`;

  const typeCode = (found.type ?? "").split("|")[0];
  const category = found.wondrous ? "Wondrous Item" : (TYPE_TO_CATEGORY[typeCode] ?? "Adventuring Gear");
  const rarity = found.rarity && found.rarity !== "none" ? found.rarity : "common";
  const description = entriesText(found.entries).trim();

  const entry = {
    id: freshId(),
    name: found.name,
    category,
    icon,
    description: description || "TODO",
    rarity,
  };
  if (typeof found.weight === "number") entry.weight = found.weight;

  // Check for name collision
  const dupe = items.find((i) => i.name.toLowerCase() === found.name.toLowerCase());
  if (dupe) {
    console.error(`"${found.name}" already exists in catalog (id: ${dupe.id}). Aborting.`);
    process.exit(1);
  }

  items.push(entry);
  writeFileSync(catalogFile, JSON.stringify(items, null, 2) + "\n");
  console.log(`Added to items.json (${items.length} total):`);
  console.log(JSON.stringify(entry, null, 2));
  process.exit(0);
}

// ── blank stub (default) ──────────────────────────────────────────────────────

const stub = {
  id: freshId(),
  name: "TODO",
  category: "TODO",
  icon: "https://...",
  description: "TODO",
  rarity: "common",
  weight: 0,
};

console.log("Generated stub. Paste into public/data/items.json:");
console.log(JSON.stringify(stub, null, 2));
console.log("\nOr: node scripts/add-item.mjs \"<5etools item name>\" to look up and append automatically.");

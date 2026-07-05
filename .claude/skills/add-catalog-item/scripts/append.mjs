#!/usr/bin/env node
/**
 * Append a finalized catalog entry to public/data/items.json for the
 * add-catalog-item skill.
 *
 *   node append.mjs /path/to/entry.json     # entry from a file
 *   node append.mjs < entry.json            # or from stdin
 *
 * What it guarantees so you don't have to get it right by hand:
 *   - a fresh, collision-free nano-id (any "id" on the input is ignored)
 *   - required string fields are present and non-empty
 *   - no duplicate name already in the catalog
 *   - rarity is a real RARITIES value (read from src/constants.ts) or dropped
 *   - weight is kept only when it is a finite number, else dropped
 *   - field order + 2-space formatting + trailing newline match add-item.mjs,
 *     so the git diff stays to exactly the new object
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const catalogFile = join(repoRoot, "public", "data", "items.json");
const constantsFile = join(repoRoot, "src", "constants.ts");

function validRarities() {
  try {
    const src = readFileSync(constantsFile, "utf8");
    const block = src.match(/RARITIES\s*=\s*\[([^\]]*)\]/);
    if (block) {
      const vals = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      if (vals.length) return vals;
    }
  } catch {
    /* fall through to defaults */
  }
  return ["common", "uncommon", "rare", "very rare", "legendary"];
}

const ALPHA = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function nanoid(len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
}

const inputPath = process.argv[2];
const raw = inputPath ? readFileSync(inputPath, "utf8") : readFileSync(0, "utf8");
let entry;
try {
  entry = JSON.parse(raw);
} catch (e) {
  console.error(`could not parse entry JSON: ${e.message}`);
  process.exit(1);
}

const items = JSON.parse(readFileSync(catalogFile, "utf8"));
const used = new Set(items.map((i) => i.id));

for (const f of ["name", "category", "icon", "description"]) {
  if (typeof entry[f] !== "string" || entry[f].trim() === "") {
    console.error(`entry is missing required non-empty string field: ${f}`);
    process.exit(1);
  }
}

const dupe = items.find((i) => i.name.toLowerCase() === entry.name.toLowerCase());
if (dupe) {
  console.error(`"${entry.name}" already exists in the catalog (id ${dupe.id}). Aborting — edit it by hand if you meant to change it.`);
  process.exit(1);
}

if (entry.rarity !== undefined && entry.rarity !== null) {
  const ok = validRarities();
  if (!ok.includes(entry.rarity)) {
    console.error(`invalid rarity "${entry.rarity}". Must be one of: ${ok.join(", ")} (or null / omitted).`);
    process.exit(1);
  }
}

let id;
do {
  id = nanoid();
} while (used.has(id));

// Rebuild in catalog field order; omit null rarity and non-numeric weight.
const finalEntry = { id, name: entry.name, category: entry.category, icon: entry.icon, description: entry.description };
if (entry.rarity !== undefined && entry.rarity !== null) finalEntry.rarity = entry.rarity;
if (typeof entry.weight === "number" && isFinite(entry.weight)) finalEntry.weight = entry.weight;

items.push(finalEntry);
writeFileSync(catalogFile, JSON.stringify(items, null, 2) + "\n");

console.log(`Added "${finalEntry.name}" (id ${id}). Catalog now has ${items.length} items.`);
console.log(JSON.stringify(finalEntry, null, 2));

#!/usr/bin/env node
/**
 * Read-only 5etools lookup for the add-catalog-item skill.
 *
 *   node lookup.mjs "Command Amulet"          # search every source
 *   node lookup.mjs "Command Amulet" XMM      # prefer source code XMM
 *
 * Prints a candidate catalog entry (no id) to stdout as clean JSON, and prints
 * NOTES to stderr flagging anything you should confirm with the user (ambiguous
 * category, invalid rarity, which source matched, leftover markup, the icon).
 *
 * This NEVER writes anything. Review/adjust the entry, then hand the finalized
 * object to append.mjs. Requires ../../../../5etools-src next to the main repo,
 * exactly like scripts/add-item.mjs.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Kept in sync with RARITIES in src/constants.ts. append.mjs re-checks against
// the real constant; this copy just drives the "is this rarity usable?" note.
const VALID_RARITIES = ["common", "uncommon", "rare", "very rare", "legendary"];

// Mirrors scripts/add-item.mjs. OTH is added here so magic "Other" items don't
// silently fall through to "Adventuring Gear".
const TYPE_TO_CATEGORY = {
  A: "Ammunition", AT: "Tool", G: "Adventuring Gear", GS: "Tool", HA: "Armor",
  INS: "Tool", LA: "Armor", M: "Weapon", MA: "Armor", MNT: "Animal",
  P: "Consumable", R: "Weapon", RD: "Wondrous Item", RG: "Wondrous Item",
  S: "Armor", SC: "Adventuring Gear - Spell Scrolls", SCF: "Spellcasting Focus",
  ST: "Wondrous Item", T: "Tool", WD: "Wondrous Item", OTH: "Other",
};

function fivetoolsData() {
  const gitCommonDir = execSync("git rev-parse --git-common-dir", { encoding: "utf8" }).trim();
  const repoRoot = resolve(gitCommonDir, "..");
  const base = resolve(repoRoot, "..", "5etools-src", "data");
  const all = [];
  for (const [file, key] of [["items.json", "item"], ["items-base.json", "baseitem"]]) {
    try {
      const d = JSON.parse(readFileSync(join(base, file), "utf8"));
      all.push(...(d[key] ?? []));
    } catch {
      console.error(`warning: could not read ${file} from ${base}`);
    }
  }
  return all;
}

// Flatten 5etools' nested entries into one string. Handles the shapes items
// actually use: bare strings, {entries:[...]}, {items:[...]}, {entry:"..."}.
function entriesText(entries) {
  if (!entries) return "";
  return entries
    .map((e) => {
      if (typeof e === "string") return e;
      if (e && typeof e === "object") {
        if (Array.isArray(e.entries)) return entriesText(e.entries);
        if (Array.isArray(e.items)) return entriesText(e.items);
        if (typeof e.entry === "string") return e.entry;
      }
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

// Resolve 5etools {@tag ...} markup to its display text. The convention is
// {@tag name|source|display}: use an explicit display override when present,
// otherwise the first segment. {@dc 15} -> "DC 15". Loops to catch nesting.
function cleanMarkup(str) {
  if (typeof str !== "string") return str;
  let prev;
  do {
    prev = str;
    str = str.replace(/\{@(\w+)([^{}]*)\}/g, (_m, tag, rest) => {
      const body = rest.trim();
      if (body === "") return "";
      const parts = body.split("|").map((p) => p.trim());
      if (tag.toLowerCase() === "dc") return "DC " + parts[0];
      if (parts.length >= 3 && parts[2]) return parts[2];
      return parts[0];
    });
  } while (str !== prev);
  return str.replace(/\s+/g, " ").trim();
}

const [name, preferSource] = process.argv.slice(2);
if (!name) {
  console.error('usage: node lookup.mjs "<item name>" [SOURCE_CODE]');
  process.exit(2);
}

const items = fivetoolsData();
const needle = name.toLowerCase().trim();
const matches = items.filter((i) => i.name?.toLowerCase().trim() === needle);

if (matches.length === 0) {
  console.error(
    `Not found in 5etools: "${name}".\n` +
      "This is expected for homebrew / campaign items. Build the entry from the " +
      "details the user gives you instead — do not invent stats.",
  );
  process.exit(1);
}

const found =
  (preferSource && matches.find((i) => i.source?.toUpperCase() === preferSource.toUpperCase())) ||
  matches.find((i) => i.source === "XPHB") ||
  matches[0];

const source = found.source ?? "XPHB";
const typeCode = (found.type ?? "").split("|")[0];
const category = found.wondrous ? "Wondrous Item" : TYPE_TO_CATEGORY[typeCode] ?? "Adventuring Gear";
const rawRarity = found.rarity && found.rarity !== "none" ? found.rarity : null;
const rarity = VALID_RARITIES.includes(rawRarity) ? rawRarity : null;
const description = cleanMarkup(entriesText(found.entries)) || "TODO";

const entry = {
  name: found.name,
  category,
  icon: `https://5e.tools/img/items/${source}/${encodeURIComponent(found.name)}.webp`,
  description,
  rarity,
};
if (typeof found.weight === "number" && isFinite(found.weight)) entry.weight = found.weight;

console.log(JSON.stringify(entry, null, 2));

const notes = [`source: ${source}${found.page ? " p." + found.page : ""}`];
if (matches.length > 1) {
  notes.push(
    `${matches.length} sources matched (${matches.map((m) => m.source).join(", ")}); used ${source}. ` +
      "Pass a source code as the 2nd arg to pick another.",
  );
}
if (rawRarity && rarity === null) {
  notes.push(
    `rarity "${rawRarity}" is not a catalog rarity — set to null. ASK the user which to use: ` +
      `one of ${VALID_RARITIES.join(" / ")}, or leave it out.`,
  );
}
if (typeCode === "OTH") {
  notes.push(`type is OTH ("Other") — category guessed as "${category}". Confirm Wondrous Item vs Other with the user.`);
}
notes.push("icon defaults to 5e.tools art. If the user wants a scene prop's image, replace icon with that prop's image.url.");
notes.push("Read the description back — check for leftover {@...} markup, tables, or list formatting that flattened badly.");
console.error("\nNOTES:\n- " + notes.join("\n- "));

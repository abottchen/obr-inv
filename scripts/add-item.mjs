#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function nanoid(len = 6) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
}

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "..", "public", "data", "items.json");
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

console.log("Generated stub. Paste into public/data/items.json:");
console.log(JSON.stringify(stub, null, 2));
console.log(`\nThen re-run with --validate to check the file.`);

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

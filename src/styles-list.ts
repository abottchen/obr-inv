export const LIST_CSS = `
.shell { display: flex; flex-direction: column; height: 100%; position: relative; }

/* ─── Header ────────────────────────────────────────────────────────── */
.shell-header {
  position: sticky; top: 0; z-index: 5;
  display: flex; flex-direction: column; gap: 8px;
  padding: 10px 12px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.022), transparent 60%),
    var(--bg-0);
  border-bottom: 1px solid var(--border);
}

.brand {
  display: flex; align-items: baseline; gap: 10px;
  min-width: 0;
}
.brand-mark {
  width: 18px; height: 18px;
  flex-shrink: 0; align-self: center;
  color: var(--accent-soft);
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent-soft) 35%, transparent));
}
.brand-title {
  font-family: var(--font-display);
  font-variation-settings: "opsz" 144, "wght" 500, "SOFT" 30;
  font-size: 17px;
  line-height: 1;
  color: var(--text);
  letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.brand-sub {
  margin-left: auto;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--text-dim);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 50%;
}

.shell-controls {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 6px;
  align-items: center;
}

/* Search field with a leading icon. The icon is a sibling, not a
 * pseudo-element, so it picks up currentColor and stays sharp. */
.search-wrap {
  position: relative;
  display: block;
  min-width: 0;
}
.search-icon {
  position: absolute;
  left: 10px; top: 50%;
  transform: translateY(-50%);
  width: 13px; height: 13px;
  color: var(--text-dim);
  pointer-events: none;
}
.shell-search {
  width: 100%;
  background: rgba(0,0,0,0.3);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 7px 10px 7px 30px;
  outline: none;
  font: 500 12.5px/1 var(--font-body);
  transition: border-color 120ms, box-shadow 120ms;
}
.shell-search::placeholder { color: var(--text-dim); font-style: italic; }
.shell-search:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent) inset,
              0 0 10px color-mix(in srgb, var(--accent-soft) 30%, transparent);
}

/* Paired collapse/expand controls — read as one cluster, not two
 * orphan buttons. */
.icon-pair {
  display: inline-flex;
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border);
  border-radius: 5px;
  overflow: hidden;
}
.icon-pair .shell-btn {
  background: transparent;
  border: 0;
  border-radius: 0;
  padding: 0;
  width: 28px; height: 28px;
  color: var(--text-dim);
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background 100ms, color 100ms;
}
.icon-pair .shell-btn:hover { background: var(--bg-2); color: var(--text); }
.icon-pair .shell-btn + .shell-btn { border-left: 1px solid var(--border); }
.icon-pair .shell-btn svg { width: 13px; height: 13px; }

/* Stand-alone shell buttons (kept for any future use; current header
 * groups them in icon-pair / view-seg). */
.shell-btn {
  background: var(--bg-1); color: var(--text);
  border: 1px solid var(--border); border-radius: 5px;
  padding: 6px 10px; cursor: pointer;
  font-size: 13px; line-height: 1;
}
.shell-btn:hover { border-color: var(--accent-soft); }

/* Segmented view toggle. The active button gets the gilt treatment so
 * the current mode is obvious at a glance. */
.view-seg {
  display: inline-flex;
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 2px;
}
.view-seg button {
  background: transparent;
  border: 0;
  border-radius: 4px;
  width: 28px; height: 24px;
  color: var(--text-dim);
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background 100ms, color 100ms;
}
.view-seg button svg { width: 12px; height: 12px; }
.view-seg button:hover { color: var(--text); }
.view-seg button.active {
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--accent) 35%, var(--bg-2)),
    color-mix(in srgb, var(--accent) 12%, var(--bg-1)));
  color: var(--accent-soft);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 50%, transparent) inset;
}

/* ─── Body ──────────────────────────────────────────────────────────── */
.shell-body { flex: 1; overflow-y: auto; padding: 10px 12px 4px; }

.cat-header {
  display: grid;
  /* Two grid children in markup: titlewrap (chev + name + decorative
   * rule) takes the elastic 1fr column; the count badge sits in the
   * trailing auto column. The earlier auto/1fr/auto template assumed a
   * three-child shape and let the badge stretch the whole row. */
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 4px 0 6px;
  cursor: pointer; user-select: none;
}
.cat-header > span:first-child {
  display: inline-flex; align-items: baseline; gap: 8px;
  min-width: 0;
  font-family: var(--font-display);
  font-variation-settings: "opsz" 60, "wght" 500;
  font-size: 13.5px;
  letter-spacing: 0;
  color: var(--text);
  text-transform: none;
}
.cat-header > span:first-child::after {
  content: "";
  display: inline-block;
  height: 1px;
  flex: 1;
  min-width: 24px;
  background: linear-gradient(90deg, var(--border) 0%, transparent 100%);
  align-self: center;
  transform: translateY(-2px);
}
.cat-header > span:last-child {
  font: 600 10px var(--font-mono);
  color: var(--text-dim);
  letter-spacing: 0.04em;
  padding: 1px 7px;
  border: 1px solid var(--border);
  border-radius: 99px;
  background: rgba(0,0,0,0.25);
}
.cat-header .chev {
  width: 8px; height: 8px;
  display: inline-block;
  border-right: 1.5px solid var(--accent);
  border-bottom: 1.5px solid var(--accent);
  transform: rotate(45deg) translate(-1px,-1px);
  transform-origin: 50% 55%;
  transition: transform 200ms ease;
}
.cat-group[data-collapsed="true"] .chev {
  transform: rotate(-45deg) translate(0,1px);
}
.cat-body {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 220ms ease, opacity 200ms ease;
}
.cat-group[data-collapsed="true"] .cat-body { grid-template-rows: 0fr; opacity: 0; }
.cat-body-inner { overflow: hidden; min-height: 0; box-sizing: border-box; }

/* Spacing between category groups — replaces the cat-body bottom padding
 * that would have leaked when collapsed. */
.cat-group { margin-bottom: 12px; }
.cat-group:last-child { margin-bottom: 6px; }

/* ─── Rows ──────────────────────────────────────────────────────────── */
.inv-row {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 10px; margin-bottom: 4px;
  background: linear-gradient(180deg, var(--bg-2) 0%,
    color-mix(in srgb, var(--bg-2) 70%, var(--bg-0)) 100%);
  border: 1px solid var(--border);
  border-left: 3px solid var(--rarity-common);
  border-radius: 5px;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}
.inv-row:hover {
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--bg-2) 80%, var(--accent) 6%) 0%,
    var(--bg-2) 100%);
  border-color: color-mix(in srgb, var(--border) 70%, var(--accent) 30%);
}
.inv-row[data-rarity="uncommon"] { border-left: 3px solid var(--rarity-uncommon); }
.inv-row[data-rarity="rare"] { border-left: 3px solid var(--rarity-rare); }
.inv-row[data-rarity="very rare"] { border-left: 3px solid var(--rarity-very-rare); }
.inv-row[data-rarity="legendary"] { border-left: 3px solid var(--rarity-legendary); }
.inv-row[data-rarity="common"], .inv-row:not([data-rarity]) { border-left: 3px solid var(--rarity-common); }

.inv-icon {
  width: 28px; height: 28px; flex-shrink: 0;
  background: var(--bg-0); border-radius: 4px;
  border: 1px solid var(--border);
  overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.inv-name {
  flex: 1;
  font-family: var(--font-display);
  font-variation-settings: "opsz" 36, "wght" 450;
  font-size: 14px;
  line-height: 1.2;
  letter-spacing: -0.005em;
  color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.inv-name mark {
  background: color-mix(in srgb, var(--accent) 30%, transparent);
  color: inherit;
  padding: 0 2px;
  border-radius: 2px;
}
.inv-name[data-rarity="uncommon"]  { color: color-mix(in srgb, var(--rarity-uncommon) 70%, var(--text)); }
.inv-name[data-rarity="rare"]      { color: color-mix(in srgb, var(--rarity-rare) 65%, var(--text)); }
.inv-name[data-rarity="very rare"] {
  color: color-mix(in srgb, var(--rarity-very-rare) 70%, var(--text));
  text-shadow: 0 0 6px color-mix(in srgb, var(--rarity-very-rare) 40%, transparent);
}
.inv-name[data-rarity="legendary"] {
  color: color-mix(in srgb, var(--rarity-legendary) 75%, var(--text));
  text-shadow: 0 0 8px color-mix(in srgb, var(--rarity-legendary) 50%, transparent);
}
.inv-count {
  font: 700 12.5px var(--font-mono);
  font-variant-numeric: tabular-nums;
  min-width: 28px; text-align: right;
  color: var(--text-dim);
  position: relative;
}

.btn-step, .btn-x {
  width: 24px; height: 24px;
  background: var(--bg-1); border: 1px solid var(--border);
  border-radius: 4px; color: var(--text); cursor: pointer;
  font: 600 13px var(--font-body);
  display: inline-flex; align-items: center; justify-content: center;
  transition: all 100ms;
}
.btn-step:hover {
  color: var(--accent-soft);
  border-color: var(--accent-soft);
  background: color-mix(in srgb, var(--accent) 12%, var(--bg-1));
}
.btn-x:hover {
  color: #fff;
  background: var(--bad);
  border-color: var(--bad);
}
.btn-x svg { width: 13px; height: 13px; }

/* ─── Footer ────────────────────────────────────────────────────────── */
.shell-footer {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; padding: 8px 12px;
  border-top: 1px solid var(--border);
  background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.25) 100%);
}
.weight {
  display: inline-flex; align-items: baseline; gap: 6px;
  color: var(--text-dim);
}
.weight-num {
  font: 700 13px var(--font-mono);
  color: var(--text);
}
.weight-unit {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
}
.shell-actions {
  display: inline-flex; gap: 6px;
}

/* Primary "Add to inventory" — gilt stamped button with a serif label.
 * Stronger visual weight than any other footer control because it's the
 * default action a player takes after looting. */
.btn-add {
  background: linear-gradient(180deg, var(--accent) 0%,
    color-mix(in srgb, var(--accent) 75%, #000) 100%);
  color: var(--bg-0);
  border: 1px solid var(--accent-soft);
  border-radius: 5px;
  padding: 7px 14px;
  font-variation-settings: "opsz" 36, "wght" 600;
  font-size: 12.5px;
  letter-spacing: 0.04em;
  cursor: pointer;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.18) inset,
    0 -1px 0 rgba(0,0,0,0.25) inset,
    0 3px 10px rgba(0,0,0,0.4);
  transition: filter 100ms;
}
.btn-add:hover { filter: brightness(1.08); }
.btn-add:active { transform: translateY(1px); }

/* Secondary action ("Create item", GM only) — subtler, ghost on dark. */
.btn-create {
  background: rgba(0,0,0,0.3);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 7px 12px;
  font-variation-settings: "opsz" 36, "wght" 500;
  font-size: 12.5px;
  letter-spacing: 0.04em;
  cursor: pointer;
}
.btn-create:hover {
  color: var(--accent-soft);
  border-color: var(--accent-soft);
}

/* ─── Coin pouch (currency) ─────────────────────────────────────────── */
.gold-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 8px 12px 12px;
  border-top: 1px solid var(--border);
  background: var(--bg-0);
}
.gold-cell {
  display: flex; align-items: center; gap: 8px;
  background: rgba(0,0,0,0.32);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 8px 4px 4px;
  transition: border-color 120ms, box-shadow 120ms;
}
.gold-cell:focus-within {
  border-color: var(--accent-soft);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-soft) 40%, transparent) inset;
}

/* Stamped coin disc — round, with a faint inner ring. The base colour
 * comes from the per-currency rules below. */
.coin-disc {
  width: 24px; height: 24px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  font-variation-settings: "opsz" 12, "wght" 700;
  font-size: 9.5px;
  letter-spacing: 0;
  position: relative;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.28) inset,
    0 -2px 2px rgba(0,0,0,0.4) inset,
    0 1px 2px rgba(0,0,0,0.5);
}
.coin-disc::after {
  content: "";
  position: absolute; inset: 2px;
  border-radius: 50%;
  border: 1px dashed rgba(0,0,0,0.22);
}
.gold-cell[data-ccy="pp"] .coin-disc {
  background: linear-gradient(135deg, #f0f0f5 0%, #9aa0b0 100%);
  color: #2a2f3c;
}
.gold-cell[data-ccy="gp"] .coin-disc {
  background: linear-gradient(135deg, #f5d774 0%, #b58020 100%);
  color: #3a2810;
}
.gold-cell[data-ccy="sp"] .coin-disc {
  background: linear-gradient(135deg, #e6e6e6 0%, #8a8a8a 100%);
  color: #2a2a2a;
}
.gold-cell[data-ccy="cp"] .coin-disc {
  background: linear-gradient(135deg, #d2895a 0%, #7a3e1f 100%);
  color: #2a160a;
}

.coin-input, .gold-cell input {
  flex: 1 1 0; width: 0; min-width: 0;
  background: transparent; color: var(--text);
  border: none; outline: none;
  padding: 4px 0;
  font: 700 13px var(--font-mono);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.empty-state {
  padding: 36px 24px;
  text-align: center;
  color: var(--text-dim);
  font-style: italic;
}
/* Evocative first-time empty state — distinct from a search-no-match
 * which stays a one-liner. The glyph picks up the gilt accent so the
 * visual weight nudges the player toward the Add button below. */
.empty-state.empty-pack {
  display: flex; flex-direction: column; align-items: center;
  padding: 56px 32px;
  font-style: normal;
}
.empty-glyph {
  width: 64px; height: 64px;
  color: color-mix(in srgb, var(--accent) 60%, var(--text-dim));
  opacity: 0.7;
  margin-bottom: 14px;
  filter: drop-shadow(0 0 12px color-mix(in srgb, var(--accent-soft) 28%, transparent));
}
.empty-title {
  font-family: var(--font-display);
  font-variation-settings: "opsz" 144, "wght" 500, "WONK" 1;
  font-size: 20px;
  margin: 0 0 8px;
  color: var(--text);
  letter-spacing: -0.01em;
}
.empty-sub {
  font-style: italic;
  color: var(--text-dim);
  max-width: 280px;
  line-height: 1.5;
  margin: 0;
  font-size: 12.5px;
}

/* ─── Grid view ─────────────────────────────────────────────────────── */
.grid-cells {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 6px;
  padding: 2px;
}
.inv-cell {
  position: relative;
  aspect-ratio: 1;
  background:
    radial-gradient(circle at 30% 25%, rgba(255,255,255,0.05) 0%, transparent 50%),
    linear-gradient(180deg, var(--bg-2) 0%, var(--bg-0) 100%);
  border: 1px solid var(--border);
  border-radius: 5px;
  overflow: visible;
  cursor: pointer;
  user-select: none;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.03) inset,
    0 -2px 6px rgba(0,0,0,0.35) inset;
  transition: transform 120ms ease, border-color 120ms ease;
}
.inv-cell:hover { transform: translateY(-1px); }
.inv-cell[data-rarity="uncommon"]  { border-color: color-mix(in srgb, var(--rarity-uncommon) 60%, var(--border)); }
.inv-cell[data-rarity="rare"]      { border-color: color-mix(in srgb, var(--rarity-rare) 60%, var(--border)); }
.inv-cell[data-rarity="very rare"] {
  border-color: color-mix(in srgb, var(--rarity-very-rare) 60%, var(--border));
  box-shadow:
    0 1px 0 rgba(255,255,255,0.03) inset,
    0 -2px 6px rgba(0,0,0,0.35) inset,
    0 0 8px color-mix(in srgb, var(--rarity-very-rare) 35%, transparent);
}
.inv-cell[data-rarity="legendary"] {
  border-color: color-mix(in srgb, var(--rarity-legendary) 70%, var(--border));
  box-shadow:
    0 1px 0 rgba(255,255,255,0.05) inset,
    0 -2px 6px rgba(0,0,0,0.35) inset,
    0 0 12px color-mix(in srgb, var(--rarity-legendary) 45%, transparent);
}
.cell-image {
  position: absolute; inset: 2px;
  background-color: var(--bg-1);
  border-radius: 4px;
  overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; color: var(--text-dim);
}
.icon-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
  transform-origin: center;
}
.cell-count {
  position: absolute; right: 3px; bottom: 3px;
  background: var(--bg-0);
  border: 1px solid var(--border);
  color: var(--text);
  font: 700 10.5px var(--font-mono);
  font-variant-numeric: tabular-nums;
  padding: 1px 5px; border-radius: 3px;
  pointer-events: none;
  box-shadow: 0 1px 2px rgba(0,0,0,0.5);
}
/* In-cell .cell-tooltip is a hidden data carrier (text + data-rarity).
 * Actual rendering happens in .cell-tooltip-layer (a single position:fixed
 * element on the shell), which the shell shows on cell mouseover. The layer
 * escapes every .cat-body-inner overflow:hidden so tooltips never get clipped
 * by the collapse-animation container. */
.cell-tooltip { display: none; }
.cell-tooltip-layer {
  position: fixed;
  background: var(--bg-0);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 9px;
  font-family: var(--font-display);
  font-variation-settings: "opsz" 36, "wght" 500;
  font-size: 12px; line-height: 1.2;
  letter-spacing: -0.005em;
  white-space: nowrap;
  pointer-events: none;
  z-index: 1000;
  color: var(--text);
  box-shadow: 0 4px 14px rgba(0,0,0,0.5);
}
.cell-tooltip-layer[data-rarity="uncommon"]  { color: color-mix(in srgb, var(--rarity-uncommon) 70%, var(--text)); }
.cell-tooltip-layer[data-rarity="rare"]      { color: color-mix(in srgb, var(--rarity-rare) 65%, var(--text)); }
.cell-tooltip-layer[data-rarity="very rare"] {
  color: color-mix(in srgb, var(--rarity-very-rare) 70%, var(--text));
  text-shadow: 0 0 6px color-mix(in srgb, var(--rarity-very-rare) 40%, transparent);
}
.cell-tooltip-layer[data-rarity="legendary"] {
  color: color-mix(in srgb, var(--rarity-legendary) 75%, var(--text));
  text-shadow: 0 0 8px color-mix(in srgb, var(--rarity-legendary) 50%, transparent);
}
`;

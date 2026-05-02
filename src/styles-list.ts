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
.shell-btn {
  background: var(--bg-1); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px;
  padding: 6px 10px; cursor: pointer;
  font-size: 13px; line-height: 1;
}
.shell-btn:hover { border-color: var(--accent-soft); }

.shell-body { flex: 1; overflow-y: auto; padding: 4px 8px; }
.cat-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 4px; color: var(--text-dim);
  cursor: pointer; user-select: none;
  text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;
}
.cat-header .chev {
  width: 10px;
  display: inline-block;
  transform-origin: 50% 55%;
  transition: transform 180ms ease;
}
.cat-group[data-collapsed="true"] .chev { transform: rotate(-90deg); }
.cat-body {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 220ms ease;
}
.cat-group[data-collapsed="true"] .cat-body { grid-template-rows: 0fr; }
.cat-body-inner { overflow: hidden; min-height: 0; }
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
/* Rarity-tinted item names. Common stays at default text color so the long
 * tail of mundane items doesn't add visual noise; uncommon/rare get a flat
 * tint; very-rare/legendary get a subtle text-shadow glow on top, signalling
 * "this is special" without competing with the pulse animations. */
.inv-name[data-rarity="uncommon"]  { color: var(--rarity-uncommon); }
.inv-name[data-rarity="rare"]      { color: var(--rarity-rare); }
.inv-name[data-rarity="very rare"] {
  color: var(--rarity-very-rare);
  text-shadow: 0 0 6px color-mix(in srgb, var(--rarity-very-rare) 45%, transparent);
}
.inv-name[data-rarity="legendary"] {
  color: var(--rarity-legendary);
  text-shadow: 0 0 8px color-mix(in srgb, var(--rarity-legendary) 50%, transparent);
}
.inv-count { font-variant-numeric: tabular-nums; min-width: 26px; text-align: right; color: var(--text-dim); position: relative; }

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
  display: flex; gap: 4px; padding: 6px 8px;
  border-top: 1px solid var(--border); background: var(--bg-0);
}
.gold-cell {
  flex: 1 1 0; min-width: 0;
  display: flex; align-items: center; gap: 4px;
  background: var(--bg-1); border: 1px solid var(--border);
  border-radius: 4px; padding: 0 6px;
}
.gold-cell[data-ccy="pp"] { border-left: 2px solid var(--ccy-pp); }
.gold-cell[data-ccy="gp"] { border-left: 2px solid var(--ccy-gp); }
.gold-cell[data-ccy="sp"] { border-left: 2px solid var(--ccy-sp); }
.gold-cell[data-ccy="cp"] { border-left: 2px solid var(--ccy-cp); }
.gold-cell:focus-within { border-color: var(--accent); }
.gold-cell:focus-within[data-ccy="pp"] { border-left-color: var(--ccy-pp); }
.gold-cell:focus-within[data-ccy="gp"] { border-left-color: var(--ccy-gp); }
.gold-cell:focus-within[data-ccy="sp"] { border-left-color: var(--ccy-sp); }
.gold-cell:focus-within[data-ccy="cp"] { border-left-color: var(--ccy-cp); }
.gold-cell label {
  text-transform: uppercase;
  font-size: 10px; font-weight: 700; letter-spacing: 0.05em;
  flex-shrink: 0;
}
.gold-cell[data-ccy="pp"] label { color: var(--ccy-pp); }
.gold-cell[data-ccy="gp"] label { color: var(--ccy-gp); }
.gold-cell[data-ccy="sp"] label { color: var(--ccy-sp); }
.gold-cell[data-ccy="cp"] label { color: var(--ccy-cp); }
.gold-cell input {
  flex: 1 1 0; width: 0; min-width: 0;
  background: transparent; color: var(--text);
  border: none; outline: none;
  padding: 4px 0;
  font-variant-numeric: tabular-nums;
  text-align: right;
  font-size: 12px;
}

.empty-state { padding: 24px 8px; text-align: center; color: var(--text-dim); }
`;

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
  display: flex; gap: 4px; padding: 6px 8px;
  border-top: 1px solid var(--border); background: var(--bg-0);
}
.gold-cell {
  flex: 1 1 0; min-width: 0;
  display: flex; align-items: center; gap: 2px;
  background: var(--bg-1); border: 1px solid var(--border);
  border-radius: 4px; padding: 0 3px;
}
.gold-cell:focus-within { border-color: var(--accent); }
.gold-cell label {
  color: var(--accent-soft); text-transform: uppercase;
  font-size: 9px; font-weight: 700; letter-spacing: 0.04em;
  flex-shrink: 0;
}
.gold-cell input {
  flex: 1 1 0; width: 0; min-width: 0;
  background: transparent; color: var(--text);
  border: none; outline: none;
  padding: 4px 0;
  font-variant-numeric: tabular-nums;
  text-align: right;
  font-size: 12px;
}
.gold-cell input::-webkit-outer-spin-button,
.gold-cell input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.gold-cell input { -moz-appearance: textfield; appearance: textfield; }
.ccy-stepper {
  display: flex; flex-direction: column; gap: 1px;
  flex-shrink: 0;
}
.ccy-step {
  width: 12px; height: 10px; padding: 0;
  background: var(--bg-2); color: var(--accent-soft);
  border: 1px solid var(--border); border-radius: 2px;
  font-size: 7px; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.ccy-step:hover {
  background: var(--accent); color: #fff;
  border-color: var(--accent-soft);
}
.ccy-step:active { transform: translateY(1px); }

.empty-state { padding: 24px 8px; text-align: center; color: var(--text-dim); }
`;

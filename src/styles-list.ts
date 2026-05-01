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

export const DIALOG_CSS = `
.popover {
  position: absolute; z-index: 50;
  background: var(--bg-2); color: var(--text);
  border: 1px solid var(--border); border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.45);
  padding: 8px 10px; min-width: 180px; max-width: 320px;
}
.popover h4 { margin: 0 0 4px 0; font-size: 13px; display: flex; align-items: center; gap: 6px; }
.popover .meta { color: var(--text-dim); font-size: 11px; margin-bottom: 6px; }
.popover .desc { font-size: 12px; max-height: 240px; overflow-y: auto; }

.transfer-list { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.transfer-list button {
  display: flex; align-items: center; gap: 6px;
  background: var(--bg-1); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px;
  padding: 5px 8px; cursor: pointer; text-align: left;
}
.transfer-list button:hover { background: var(--accent); border-color: var(--accent-soft); }
.transfer-qty {
  background: var(--bg-1); color: var(--text);
  border: 1px solid var(--border); border-radius: 4px;
  padding: 3px 6px; width: 60px; outline: none;
}

.dialog-overlay {
  position: fixed; inset: 0; z-index: 40;
  background: var(--bg-0); display: flex; flex-direction: column;
}
.dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px; border-bottom: 1px solid var(--border);
}
.dialog-close {
  background: transparent; border: none; color: var(--text-dim);
  cursor: pointer; font-size: 18px;
}
.dialog-body { flex: 1; overflow-y: auto; padding: 4px 8px; }
.add-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; margin-bottom: 4px;
  background: var(--bg-1); border-radius: 6px;
  border-left: 3px solid var(--rarity-common);
}
.add-row[data-rarity="uncommon"] { border-left-color: var(--rarity-uncommon);
  background: linear-gradient(90deg, rgba(76,175,80,0.10), var(--bg-1) 60%); }
.add-row[data-rarity="rare"] { border-left-color: var(--rarity-rare);
  background: linear-gradient(90deg, rgba(33,150,243,0.10), var(--bg-1) 60%); }
.add-row[data-rarity="very rare"] { border-left-color: var(--rarity-very-rare);
  background: linear-gradient(90deg, rgba(156,39,176,0.10), var(--bg-1) 60%); }
.add-row[data-rarity="legendary"] { border-left-color: var(--rarity-legendary);
  background: linear-gradient(90deg, rgba(255,152,0,0.10), var(--bg-1) 60%); }
.add-row .item-name[data-rarity="uncommon"] { color: var(--rarity-uncommon); }
.add-row .item-name[data-rarity="rare"] { color: var(--rarity-rare); }
.add-row .item-name[data-rarity="very rare"] { color: var(--rarity-very-rare); }
.add-row .item-name[data-rarity="legendary"] { color: var(--rarity-legendary); }
.add-qty { width: 56px; }
.btn-plus {
  background: var(--accent); color: #fff;
  border: none; border-radius: 4px;
  padding: 4px 10px; cursor: pointer;
}

.drop-zone {
  position: sticky; bottom: 0;
  margin: 8px; padding: 12px;
  border: 2px dashed var(--accent-soft); border-radius: 6px;
  text-align: center; color: var(--text-dim); background: var(--bg-1);
  display: none;
}
.drop-zone.active { display: block; }
.drop-zone.over { background: var(--bg-2); border-color: var(--accent); color: var(--text); }

.tabs {
  display: flex; gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  background: var(--bg-0);
}
.tab {
  flex-shrink: 0;
  background: var(--bg-1); color: var(--text);
  border: 1px solid var(--border);
  border-left: 3px solid var(--text-dim);
  border-radius: 4px;
  padding: 4px 10px; cursor: pointer;
}
.tab.active { background: var(--accent); border-color: var(--accent-soft); color: #fff; }
.tab-download {
  margin-left: auto; flex-shrink: 0;
  background: var(--bg-1); color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px; padding: 4px 8px; cursor: pointer;
}

.meter-strip { padding: 6px 8px; border-bottom: 1px solid var(--border); }
.meter-bar { height: 8px; background: var(--bg-1); border-radius: 4px; overflow: hidden; }
.meter-fill { height: 100%; background: var(--ok); transition: width 0.2s, background 0.2s; }
.meter-fill[data-state="yellow"] { background: var(--warn); }
.meter-fill[data-state="red"] { background: var(--bad); }
.meter-text { font-size: 11px; color: var(--text-dim); margin-top: 2px; }

.modal-backdrop {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
}
.modal {
  background: var(--bg-2); border: 1px solid var(--border); border-radius: 8px;
  padding: 16px; max-width: 320px;
}
.modal h3 { margin: 0 0 8px 0; }
.modal .ok-btn {
  background: var(--accent); color: #fff;
  border: none; border-radius: 6px; padding: 6px 14px;
  cursor: pointer; margin-top: 12px;
}
`;

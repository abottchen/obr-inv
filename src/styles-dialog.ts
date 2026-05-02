export const DIALOG_CSS = `
.popover {
  position: absolute; z-index: 50;
  background: var(--bg-2); color: var(--text);
  border: 1px solid var(--border); border-radius: 8px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset;
  padding: 8px 10px; min-width: 180px; max-width: 320px;
}
.popover h4 { margin: 0 0 4px 0; font-size: 13px; display: flex; align-items: center; gap: 6px; }
.popover .meta { color: var(--text-dim); font-size: 11px; margin-bottom: 6px; }
.popover .desc { font-size: 12px; max-height: 240px; overflow-y: auto; }

.description-popover {
  padding: 0;
  overflow: hidden;
  min-width: 220px;
  border-top: 3px solid var(--rarity-common);
}
.description-popover[data-rarity="uncommon"]   { border-top-color: var(--rarity-uncommon); }
.description-popover[data-rarity="rare"]       { border-top-color: var(--rarity-rare); }
.description-popover[data-rarity="very rare"]  { border-top-color: var(--rarity-very-rare); }
.description-popover[data-rarity="legendary"]  { border-top-color: var(--rarity-legendary); }

.description-popover .desc-header {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  background: linear-gradient(180deg, rgba(255,255,255,0.04), transparent);
}
.description-popover .desc-icon {
  width: 36px; height: 36px;
  background-color: var(--bg-1);
  border: 1px solid var(--border); border-radius: 4px;
  background-size: cover; background-position: center;
  flex-shrink: 0;
}
.description-popover .desc-title {
  flex: 1; min-width: 0;
  font-size: 14px; font-weight: 600; line-height: 1.25;
}
.popover-close {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 3px;
  line-height: 1;
}
.popover-close:hover {
  background: var(--bg-1);
  color: var(--text);
}
.description-popover .desc-title[data-rarity="uncommon"]  { color: var(--rarity-uncommon); }
.description-popover .desc-title[data-rarity="rare"]      { color: var(--rarity-rare); }
.description-popover .desc-title[data-rarity="very rare"] { color: var(--rarity-very-rare); }
.description-popover .desc-title[data-rarity="legendary"] { color: var(--rarity-legendary); }

.description-popover .meta {
  margin: 0;
  padding: 5px 12px;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  background: var(--bg-1);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}

.description-popover .desc {
  padding: 10px 12px;
  font-size: 12.5px;
  line-height: 1.5;
  max-height: 220px;
  overflow-y: auto;
}

.description-popover .desc-actions {
  padding: 8px 12px;
  border-top: 1px solid var(--border);
  background: var(--bg-1);
  display: flex; justify-content: flex-end; gap: 6px;
}
.description-popover .desc-transfer {
  background: var(--accent); color: #fff;
  border: none; border-radius: 6px;
  padding: 6px 12px; font-size: 12px; cursor: pointer;
}
.description-popover .desc-transfer:hover { filter: brightness(1.1); }

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
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.transfer-qty::-webkit-outer-spin-button,
.transfer-qty::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.transfer-qty { -moz-appearance: textfield; appearance: textfield; }
.qty-stepper {
  display: flex; flex-direction: column; gap: 1px;
  flex-shrink: 0;
}
.qty-step {
  width: 14px; height: 11px; padding: 0;
  background: var(--bg-2); color: var(--accent-soft);
  border: 1px solid var(--border); border-radius: 2px;
  font-size: 8px; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.qty-step:hover {
  background: var(--accent); color: #fff;
  border-color: var(--accent-soft);
}
.qty-step:active { transform: translateY(1px); }

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
/* Rarity color/glow on .item-name now comes from the .inv-name rules in
 * styles-list.ts — the add-dialog row's name carries both classes. */
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
  display: flex; flex-wrap: wrap; gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
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

.tab-customs {
  flex-shrink: 0;
  background: var(--bg-1); color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px; padding: 4px 8px; cursor: pointer;
}
.tab-customs:hover {
  background: var(--accent); color: #fff; border-color: var(--accent-soft);
}

.btn-create {
  background: var(--bg-1); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px;
  padding: 6px 10px; cursor: pointer;
}
.btn-create:hover {
  background: var(--accent); color: #fff; border-color: var(--accent-soft);
}

.empty-cta {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 24px 8px; text-align: center; color: var(--text-dim);
}
.empty-cta button {
  background: var(--accent); color: #fff;
  border: none; border-radius: 6px;
  padding: 6px 14px; cursor: pointer;
}

.customs-dialog {
  width: 360px; max-width: calc(100vw - 24px);
  padding: 0;
}
.customs-dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-bottom: 1px solid var(--border);
}
.customs-dialog-header h3 { margin: 0; font-size: 14px; }
.customs-error {
  background: rgba(233,94,94,0.10);
  color: var(--bad);
  border-bottom: 1px solid var(--border);
  padding: 8px 12px;
  font-size: 12px;
}
.customs-form {
  display: flex; flex-direction: column; gap: 10px;
  padding: 12px;
}
.customs-field {
  display: flex; flex-direction: column; gap: 4px;
}
.customs-label {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--text-dim);
}
.customs-input {
  background: var(--bg-1); color: var(--text);
  border: 1px solid var(--border); border-radius: 4px;
  padding: 6px 8px; outline: none; font-size: 13px;
  font-family: inherit;
}
.customs-input:focus { border-color: var(--accent); }
.customs-textarea {
  resize: vertical; min-height: 64px;
  font-family: inherit; line-height: 1.4;
}
.customs-inline {
  display: flex; gap: 10px;
}
.customs-inline-cell { flex: 1 1 0; min-width: 0; }
.customs-actions {
  display: flex; justify-content: flex-end; gap: 8px;
  padding-top: 4px;
}
.btn-cancel {
  background: var(--bg-1); color: var(--text);
  border: 1px solid var(--border); border-radius: 4px;
  padding: 6px 12px; cursor: pointer;
}
.btn-cancel:hover { background: var(--bg-2); }
.btn-save {
  background: var(--accent); color: #fff;
  border: none; border-radius: 4px;
  padding: 6px 14px; cursor: pointer;
}
.btn-save:disabled {
  opacity: 0.4; cursor: not-allowed;
}

.customs-panel {
  width: 420px; max-width: calc(100vw - 24px);
  display: flex; flex-direction: column;
  max-height: 80vh;
}
.customs-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-bottom: 1px solid var(--border);
}
.customs-panel-header h3 { margin: 0; font-size: 14px; }
.customs-panel-body {
  flex: 1 1 auto; overflow-y: auto;
  padding: 8px 12px; min-height: 80px;
}
.customs-panel-empty {
  padding: 16px 0; text-align: center; color: var(--text-dim);
}
.customs-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px; margin-bottom: 4px;
  background: var(--bg-1); border: 1px solid var(--border);
  border-radius: 6px;
}
.customs-row .inv-icon { width: 28px; height: 28px; }
.customs-row .customs-row-main {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 2px;
}
.customs-row-name {
  font-size: 13px; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.customs-row-meta {
  font-size: 11px; color: var(--text-dim);
}
.customs-row-actions {
  display: flex; gap: 4px; flex-shrink: 0;
}
.btn-icon {
  width: 24px; height: 24px;
  background: var(--bg-2); border: 1px solid var(--border);
  border-radius: 4px; color: var(--text); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px;
}
.btn-icon:hover { background: var(--accent); border-color: var(--accent-soft); color: #fff; }
.btn-icon.danger:hover { background: var(--bad); border-color: var(--bad); }

.customs-panel-footer {
  display: flex; justify-content: space-between;
  padding: 8px 12px; border-top: 1px solid var(--border);
  font-size: 11px; color: var(--text-dim);
}
.customs-panel-footer[data-state="yellow"] .usage { color: var(--warn); }
.customs-panel-footer[data-state="red"] .usage { color: var(--bad); }

.customs-confirm-list {
  margin: 8px 0 0 0;
  padding-left: 18px;
  color: var(--text);
  font-size: 12px;
}
.customs-confirm-buttons {
  display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;
}
.btn-danger {
  background: var(--bad); color: #fff;
  border: none; border-radius: 4px;
  padding: 6px 14px; cursor: pointer;
}
.btn-danger:hover { filter: brightness(1.05); }
`;

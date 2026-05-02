export const DIALOG_CSS = `
/* ─── Generic popover ──────────────────────────────────────────────── */
.popover {
  position: absolute; z-index: 50;
  background: var(--bg-2); color: var(--text);
  border: 1px solid var(--border); border-radius: 6px;
  box-shadow: 0 18px 38px -12px rgba(0,0,0,0.85),
              0 2px 0 rgba(255,255,255,0.04) inset;
  padding: 8px 10px; min-width: 180px; max-width: 340px;
}
.popover h4 { margin: 0 0 4px 0; font-size: 13px; display: flex; align-items: center; gap: 6px; }
.popover .meta { color: var(--text-dim); font-size: 11px; margin-bottom: 6px; }
.popover .desc { font-size: 12px; max-height: 240px; overflow-y: auto; }

/* ─── Item card (description popover) ──────────────────────────────── */
.description-popover {
  padding: 0;
  overflow: hidden;
  min-width: 260px;
  max-width: 340px;
  background: linear-gradient(180deg, var(--bg-2) 0%, var(--bg-1) 100%);
  border-top: 4px solid var(--rarity-common);
}
.description-popover[data-rarity="uncommon"]   { border-top-color: var(--rarity-uncommon); }
.description-popover[data-rarity="rare"]       { border-top-color: var(--rarity-rare); }
.description-popover[data-rarity="very rare"]  {
  border-top-color: var(--rarity-very-rare);
  box-shadow: 0 18px 38px -12px rgba(0,0,0,0.85),
              0 2px 0 rgba(255,255,255,0.04) inset,
              0 -3px 14px color-mix(in srgb, var(--rarity-very-rare) 35%, transparent);
}
.description-popover[data-rarity="legendary"]  {
  border-top-color: var(--rarity-legendary);
  box-shadow: 0 18px 38px -12px rgba(0,0,0,0.85),
              0 2px 0 rgba(255,255,255,0.04) inset,
              0 -3px 16px color-mix(in srgb, var(--rarity-legendary) 50%, transparent);
}

.description-popover .desc-header {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  gap: 12px;
  padding: 14px 16px 10px;
}
.description-popover .desc-icon {
  width: 56px; height: 56px;
  background-color: var(--bg-0);
  border: 1px solid var(--border);
  border-radius: 5px;
  flex-shrink: 0;
  overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.description-popover .desc-titleblock { min-width: 0; align-self: center; }
.description-popover .desc-tagline {
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: var(--text-dim);
  margin-bottom: 4px;
}
.description-popover .desc-title {
  font-family: var(--font-display);
  font-variation-settings: "opsz" 144, "wght" 500, "SOFT" 30, "WONK" 1;
  font-size: 19px;
  line-height: 1.1;
  letter-spacing: -0.01em;
  color: var(--text);
}
.description-popover .desc-title[data-rarity="uncommon"]  {
  color: color-mix(in srgb, var(--rarity-uncommon) 70%, var(--text));
}
.description-popover .desc-title[data-rarity="rare"]      {
  color: color-mix(in srgb, var(--rarity-rare) 65%, var(--text));
}
.description-popover .desc-title[data-rarity="very rare"] {
  color: color-mix(in srgb, var(--rarity-very-rare) 75%, var(--text));
  text-shadow: 0 0 10px color-mix(in srgb, var(--rarity-very-rare) 40%, transparent);
}
.description-popover .desc-title[data-rarity="legendary"] {
  color: color-mix(in srgb, var(--rarity-legendary) 80%, var(--text));
  text-shadow: 0 0 12px color-mix(in srgb, var(--rarity-legendary) 50%, transparent);
}

.popover-close {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  padding: 4px;
  border-radius: 3px;
  line-height: 1;
  display: inline-flex; align-items: center; justify-content: center;
  align-self: start;
}
.popover-close svg { width: 12px; height: 12px; }
.popover-close:hover { background: var(--bg-1); color: var(--text); }

/* Three-up meta strip: cells with a small uppercase key + display-font value. */
.description-popover .meta {
  margin: 0;
  padding: 8px 16px;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  background: rgba(0,0,0,0.22);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}
.description-popover .meta.meta-strip {
  display: flex;
  gap: 0;
  text-transform: none;
  letter-spacing: 0;
}
.description-popover .meta-cell {
  flex: 1;
  display: flex; flex-direction: column; gap: 2px;
  padding: 0 12px 0 0;
}
.description-popover .meta-cell + .meta-cell {
  border-left: 1px solid var(--border);
  padding-left: 12px;
}
.description-popover .meta-cell .k {
  font-family: var(--font-body);
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--text-dim);
}
.description-popover .meta-cell .v {
  font-family: var(--font-display);
  font-variation-settings: "opsz" 36, "wght" 500;
  font-size: 13px;
  letter-spacing: -0.005em;
  color: var(--text);
  text-transform: capitalize;
}

.description-popover .desc {
  padding: 14px 16px;
  font-family: var(--font-display);
  font-variation-settings: "opsz" 14, "wght" 400;
  font-size: 13px;
  line-height: 1.55;
  color: color-mix(in srgb, var(--text) 90%, var(--text-dim));
  max-height: 220px;
  overflow-y: auto;
}
/* Drop cap for the first letter of the description — tiny editorial touch
 * that makes legendary/very-rare items feel like compendium entries. */
.description-popover .desc::first-letter {
  font-family: var(--font-display);
  font-variation-settings: "opsz" 144, "wght" 600, "WONK" 1;
  font-size: 30px;
  float: left;
  line-height: 1;
  margin: 2px 6px 0 0;
  color: var(--accent-soft);
}

.description-popover .desc-actions {
  padding: 8px 12px;
  border-top: 1px solid var(--border);
  background: var(--bg-1);
  display: flex; align-items: center; justify-content: flex-end; gap: 6px;
}
.description-popover .desc-count-wrap {
  position: relative;
  display: inline-block;
}
.description-popover .desc-count {
  font-variant-numeric: tabular-nums;
  min-width: 28px; text-align: center;
  color: var(--text-dim); font-size: 12px;
  display: inline-block;
}
.description-popover .desc-delta {
  position: absolute;
  left: 50%; top: -2px;
  transform: translateX(-50%);
  font-size: 11px; font-weight: 700;
  pointer-events: none;
  opacity: 0;
}
.description-popover .desc-delta:empty { display: none; }
.description-popover .desc-delta[data-pulse="inc"] {
  animation: feedback-float 800ms ease-out;
  color: var(--accent);
}
.description-popover .desc-delta[data-pulse="dec"] {
  animation: feedback-float 800ms ease-out;
  color: var(--warn);
}
.description-popover .desc-count[data-pulse="inc"] {
  animation: desc-count-pos 500ms ease-out;
}
.description-popover .desc-count[data-pulse="dec"] {
  animation: desc-count-neg 500ms ease-out;
}
@keyframes desc-count-pos {
  0%   { transform: scale(1); color: var(--text-dim); }
  20%  { transform: scale(1.25); color: #fff; text-shadow: 0 0 10px var(--accent); }
  100% { transform: scale(1); color: var(--text-dim); }
}
@keyframes desc-count-neg {
  0%   { transform: scale(1); color: var(--text-dim); }
  20%  { transform: scale(0.85); color: var(--warn); }
  100% { transform: scale(1); color: var(--text-dim); }
}
.description-popover .desc-transfer {
  background: linear-gradient(180deg, var(--accent) 0%,
    color-mix(in srgb, var(--accent) 75%, #000) 100%);
  color: var(--bg-0);
  border: 1px solid var(--accent-soft);
  border-radius: 4px;
  padding: 6px 14px;
  font-family: var(--font-display);
  font-variation-settings: "opsz" 36, "wght" 600;
  font-size: 12px;
  letter-spacing: 0.04em;
  cursor: pointer;
  margin-left: auto;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.18) inset,
    0 -1px 0 rgba(0,0,0,0.25) inset;
}
.description-popover .desc-transfer:hover { filter: brightness(1.08); }

/* "Unlock to edit" CTA — only renders when shell is locked. Sits before
 * Transfer in the actions row and reads as the primary path forward. */
.description-popover .desc-unlock {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(0,0,0,0.32);
  color: var(--accent-soft);
  border: 1px dashed color-mix(in srgb, var(--accent-soft) 70%, transparent);
  border-radius: 4px;
  padding: 6px 12px;
  font-family: var(--font-display);
  font-variation-settings: "opsz" 36, "wght" 500;
  font-size: 12px;
  letter-spacing: 0.02em;
  cursor: pointer;
  margin-right: auto;
  transition: all 140ms ease;
}
.description-popover .desc-unlock svg { width: 12px; height: 12px; }
.description-popover .desc-unlock:hover {
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--accent) 22%, var(--bg-2)),
    color-mix(in srgb, var(--accent) 8%, var(--bg-1)));
  border-style: solid;
  color: var(--accent-soft);
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent-soft) 30%, transparent);
}

/* ─── Transfer popover ─────────────────────────────────────────────── */
/* A second popover that follows the description popover's "Transfer →"
 * tap. Pre-redesign it inherited the bare .popover style and read as
 * floating debris over the description card. Now it's clearly a
 * deliberate next step: gilt top accent, beefier shadow, scale-in
 * entrance, and the target list reads as gilt-edged action buttons
 * instead of unstyled list items. */
.transfer-popover {
  z-index: 60;
  min-width: 240px;
  max-width: 320px;
  padding: 0;
  overflow: hidden;
  background: linear-gradient(180deg, var(--bg-2) 0%, var(--bg-1) 100%);
  border: 1px solid var(--accent-soft);
  border-radius: 6px;
  box-shadow:
    0 22px 48px -12px rgba(0,0,0,0.85),
    0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent),
    0 0 22px color-mix(in srgb, var(--accent-soft) 28%, transparent),
    0 2px 0 rgba(255,255,255,0.05) inset;
  animation: transfer-pop-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.transfer-popover::before {
  content: "";
  display: block;
  height: 3px;
  background: linear-gradient(90deg,
    transparent 0%,
    var(--accent-soft) 30%,
    color-mix(in srgb, var(--accent-soft) 100%, #fff 20%) 50%,
    var(--accent-soft) 70%,
    transparent 100%);
  box-shadow: 0 0 14px color-mix(in srgb, var(--accent-soft) 50%, transparent);
}
@keyframes transfer-pop-in {
  from { opacity: 0; transform: translateY(6px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}

.transfer-popover h4 {
  margin: 0;
  padding: 12px 14px 4px;
  font-family: var(--font-display);
  font-variation-settings: "opsz" 144, "wght" 500, "WONK" 1;
  font-size: 16px;
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: var(--text);
}
.transfer-popover .meta {
  margin: 0;
  padding: 8px 14px 10px;
  display: flex; align-items: center; gap: 8px;
  border-bottom: 1px solid var(--border);
  background: rgba(0,0,0,0.22);
}
.transfer-qty-label {
  font: 700 9.5px var(--font-body);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--text-dim);
}
.transfer-popover .transfer-qty {
  background: var(--bg-1);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 8px;
  width: 64px;
  outline: none;
  font: 700 13px var(--font-mono);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.transfer-popover .transfer-qty:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent) inset;
}
.transfer-qty-max {
  font: 600 11px var(--font-mono);
  color: var(--text-dim);
}

.transfer-sub {
  padding: 8px 14px 4px;
  font: 700 9.5px var(--font-body);
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: var(--accent-soft);
}

.transfer-list {
  display: flex; flex-direction: column; gap: 4px;
  padding: 4px 10px 12px;
  margin-top: 0;
}
.transfer-list button {
  display: flex; align-items: center; gap: 10px;
  background: var(--bg-1);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 8px 12px;
  cursor: pointer;
  text-align: left;
  font-family: var(--font-display);
  font-variation-settings: "opsz" 36, "wght" 500;
  font-size: 13.5px;
  letter-spacing: -0.005em;
  transition: all 110ms ease;
  position: relative;
}
.transfer-list button::after {
  content: "→";
  margin-left: auto;
  font-family: var(--font-body);
  color: var(--text-dim);
  font-size: 14px;
  transition: transform 120ms, color 120ms;
}
.transfer-list button:hover {
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--accent) 22%, var(--bg-2)),
    color-mix(in srgb, var(--accent) 8%, var(--bg-1)));
  border-color: var(--accent-soft);
  color: var(--text);
}
.transfer-list button:hover::after {
  color: var(--accent-soft);
  transform: translateX(3px);
}
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

/* ─── GM view: vertical player rail ──────────────────────────────── */
.gm-wrap {
  display: grid;
  grid-template-columns: 200px 1fr;
  height: 100%;
  min-height: 0;
}
.player-rail {
  display: flex; flex-direction: column;
  background: rgba(0,0,0,0.32);
  border-right: 1px solid var(--border);
  min-height: 0;
}
.rail-head {
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--border);
}
.rail-title {
  font-family: var(--font-display);
  font-variation-settings: "opsz" 144, "wght" 500, "WONK" 1;
  font-size: 16px;
  line-height: 1;
  margin: 0 0 4px;
  color: var(--text);
  letter-spacing: -0.01em;
}
.rail-sub {
  margin: 0;
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--text-dim);
}
.rail-list {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 6px;
  display: flex; flex-direction: column; gap: 2px;
  min-height: 0;
}
.rail-item {
  display: grid;
  grid-template-columns: 26px 1fr;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid transparent;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: var(--text);
  font: inherit;
  transition: background 100ms ease, border-color 100ms ease;
}
.rail-item:hover { background: rgba(255,255,255,0.04); }
.rail-item.active {
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--accent) 18%, transparent),
    color-mix(in srgb, var(--accent) 4%, transparent));
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
}
.rail-pip {
  width: 26px; height: 26px;
  border-radius: 50%;
  border: 2px solid currentColor;
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--font-display);
  font-variation-settings: "opsz" 36, "wght" 600;
  font-size: 12px;
  color: var(--text);
  flex-shrink: 0;
}
.rail-who {
  display: flex; flex-direction: column; gap: 1px;
  min-width: 0;
}
.rail-name {
  font-family: var(--font-display);
  font-variation-settings: "opsz" 36, "wght" 500;
  font-size: 13px;
  line-height: 1.15;
  color: var(--text);
  letter-spacing: -0.005em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rail-stats {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0;
  color: var(--text-dim);
  white-space: nowrap;
}
.rail-foot {
  padding: 8px 10px 10px;
  border-top: 1px solid var(--border);
  background: rgba(0,0,0,0.25);
  flex-shrink: 0;
}
.rail-meter { margin-bottom: 8px; }
.rail-meter .meter-row {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--text-dim);
  margin-bottom: 4px;
}
.rail-meter .meter-text {
  font-family: var(--font-mono);
  letter-spacing: 0;
  color: var(--text);
  text-transform: none;
}
.rail-actions {
  display: flex; gap: 6px;
}
.rail-action {
  flex: 1;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: 4px;
  padding: 5px 4px;
  font: 600 10px var(--font-body);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  transition: all 100ms;
}
.rail-action:hover { color: var(--accent-soft); border-color: var(--accent-soft); }
.rail-action svg { width: 11px; height: 11px; }

.gm-shell-host {
  display: flex; flex-direction: column;
  min-width: 0; min-height: 0;
}

/* ─── Meter (shared visual; used by both legacy meter-strip and rail) ── */
.meter-strip { padding: 6px 8px; border-bottom: 1px solid var(--border); }
.meter-bar {
  height: 5px;
  background: var(--bg-0);
  border: 1px solid var(--border);
  border-radius: 99px;
  overflow: hidden;
}
.meter-fill {
  height: 100%;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--accent) 70%, transparent),
    var(--accent-soft));
  box-shadow: 0 0 8px color-mix(in srgb, var(--accent-soft) 40%, transparent);
  transition: width 0.2s, background 0.2s;
}
.meter-fill[data-state="yellow"] {
  background: var(--warn);
  box-shadow: 0 0 8px color-mix(in srgb, var(--warn) 40%, transparent);
}
.meter-fill[data-state="red"] {
  background: var(--bad);
  box-shadow: 0 0 8px color-mix(in srgb, var(--bad) 40%, transparent);
}
.meter-text { font-size: 11px; color: var(--text-dim); margin-top: 2px; }

/* Legacy tab styles kept as a fallback for any stray .tabs/.tab markup
 * (none currently in the GM view). */
.tabs { display: none; }
.tab, .tab-download { display: none; }

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

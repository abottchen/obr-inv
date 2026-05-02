import { renderList, type ListState, type RowHandlers } from "./ui-list";
import { renderGrid, type GridState } from "./ui-grid";
import { totalWeight } from "./inventory";
import { createPulseTracker, type PulseTracker } from "./ui-feedback";
import type { CatalogItem, PlayerInventoryRecord } from "./types";

const VIEW_MODE_KEY = "obr-inv:viewMode";
type ViewMode = "list" | "grid";

function readViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    if (v === "grid" || v === "list") return v;
  } catch (e) {
    console.warn("[obr-inv] localStorage read failed for view mode", e);
  }
  return "list";
}

function writeViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch (e) {
    console.warn("[obr-inv] localStorage write failed for view mode", e);
  }
}

export interface DescriptionCtx {
  unlocked: boolean;
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

export interface ShellHandlers extends Omit<RowHandlers, "onIncrement" | "onDecrement" | "onRemove" | "onDescription"> {
  onIncrement: (id: string) => Promise<void>;
  onDecrement: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onCurrencyChange: (
    field: "pp" | "gp" | "sp" | "cp", value: number,
  ) => Promise<void>;
  onAddClick: () => void;
  onDescription: (
    id: string, anchor: { x: number; y: number }, ctx: DescriptionCtx,
  ) => void;
  /** GM-only entry point for creating a custom item. Omit on the
   *  player view to suppress the button; the shell hides it when
   *  this handler is not provided. */
  onCreateCustomClick?: () => void;
}

export interface ShellRefs {
  rerender: (record: PlayerInventoryRecord, catalog: CatalogItem[]) => void;
  markReceived: (itemId: string, quantity: number) => void;
  destroy: () => void;
}

export function mountShell(
  root: HTMLElement,
  initialRecord: PlayerInventoryRecord,
  catalog: CatalogItem[],
  handlers: ShellHandlers,
): ShellRefs {
  root.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "shell";

  const header = document.createElement("div");
  header.className = "shell-header";
  const search = document.createElement("input");
  search.className = "shell-search";
  search.placeholder = "Search inventory...";
  header.appendChild(search);
  const collapseAllBtn = document.createElement("button");
  collapseAllBtn.className = "shell-btn";
  collapseAllBtn.textContent = "⊟";
  collapseAllBtn.title = "Collapse all categories";
  header.appendChild(collapseAllBtn);
  const expandAllBtn = document.createElement("button");
  expandAllBtn.className = "shell-btn";
  expandAllBtn.textContent = "⊞";
  expandAllBtn.title = "Expand all categories";
  header.appendChild(expandAllBtn);
  const viewToggleBtn = document.createElement("button");
  viewToggleBtn.className = "shell-btn view-toggle";
  header.appendChild(viewToggleBtn);
  const lockBtn = document.createElement("button");
  lockBtn.className = "lock-toggle";
  lockBtn.textContent = "🔒";
  lockBtn.title = "Click to unlock editing";
  header.appendChild(lockBtn);
  wrap.appendChild(header);

  const body = document.createElement("div");
  body.className = "shell-body";
  wrap.appendChild(body);

  // Tooltip lives at shell-wrap level (position: fixed, escaping every
  // .cat-body-inner overflow:hidden) and is populated on cell hover via
  // event delegation on shell-body. Grid view depends on this; list view
  // ignores it (its .inv-cell selector won't match).
  const tooltipLayer = document.createElement("div");
  tooltipLayer.className = "cell-tooltip-layer";
  tooltipLayer.style.display = "none";
  wrap.appendChild(tooltipLayer);

  const hideTooltip = () => { tooltipLayer.style.display = "none"; };
  body.addEventListener("mouseover", (e) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>(".inv-cell");
    if (!cell) return;
    const tipEl = cell.querySelector<HTMLElement>(".cell-tooltip");
    if (!tipEl) return;
    tooltipLayer.textContent = tipEl.textContent;
    if (tipEl.dataset.rarity) tooltipLayer.dataset.rarity = tipEl.dataset.rarity;
    else delete tooltipLayer.dataset.rarity;
    tooltipLayer.style.display = "block";
    const rect = cell.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const tipW = tooltipLayer.offsetWidth || 0;
    const tipH = tooltipLayer.offsetHeight || 24;
    const above = rect.top - tipH - 6 > 4;
    const margin = 4;
    const desiredLeft = rect.left + rect.width / 2 - tipW / 2;
    const minLeft = wrapRect.left + margin;
    const maxLeft = wrapRect.right - margin - tipW;
    const clampedLeft = maxLeft < minLeft
      ? minLeft
      : Math.min(Math.max(desiredLeft, minLeft), maxLeft);
    tooltipLayer.style.left = `${clampedLeft}px`;
    tooltipLayer.style.top = above
      ? `${rect.top - tipH - 6}px`
      : `${rect.bottom + 6}px`;
  });
  body.addEventListener("mouseout", (e) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>(".inv-cell");
    if (!cell) return;
    const related = e.relatedTarget as HTMLElement | null;
    if (related && cell.contains(related)) return;
    hideTooltip();
  });
  body.addEventListener("scroll", hideTooltip);

  const footer = document.createElement("div");
  footer.className = "shell-footer";
  const weightEl = document.createElement("span");
  weightEl.textContent = "⚖ 0 lb";
  footer.appendChild(weightEl);
  // Trailing cluster: optional "+ Create item" (GM only) followed by
  // the always-present "+ Add to inventory" button.
  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "6px";
  if (handlers.onCreateCustomClick) {
    const createBtn = document.createElement("button");
    createBtn.className = "btn-create";
    createBtn.textContent = "+ Create item";
    createBtn.title = "Create a one-off custom item (GM only)";
    createBtn.onclick = handlers.onCreateCustomClick;
    actions.appendChild(createBtn);
  }
  const addBtn = document.createElement("button");
  addBtn.className = "btn-add";
  addBtn.textContent = "+ Add to inventory";
  addBtn.onclick = handlers.onAddClick;
  actions.appendChild(addBtn);
  footer.appendChild(actions);
  wrap.appendChild(footer);

  const gold = document.createElement("div");
  gold.className = "gold-strip";
  const ccyInputs = {} as Record<"pp" | "gp" | "sp" | "cp", HTMLInputElement>;
  const tip = "Type a number to set, +N to add, -N to subtract";
  for (const f of ["pp", "gp", "sp", "cp"] as const) {
    const cell = document.createElement("div");
    cell.className = "gold-cell";
    cell.dataset.ccy = f;
    cell.title = tip;
    const lbl = document.createElement("label");
    lbl.textContent = f;
    cell.appendChild(lbl);
    const inp = document.createElement("input");
    inp.type = "text";
    inp.inputMode = "numeric";
    inp.value = "0";
    inp.title = tip;
    const currentValue = () => currentRecord.currency[f] ?? 0;
    const commit = () => {
      const parsed = parseCurrencyInput(inp.value, currentValue());
      if (parsed === null) {
        inp.value = String(currentValue());
        return;
      }
      const clamped = Math.max(0, Math.floor(parsed));
      inp.value = String(clamped);
      void handlers.onCurrencyChange(f, clamped);
    };
    inp.onchange = commit;
    inp.onfocus = () => inp.select();
    inp.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
        inp.blur();
      } else if (e.key === "Escape") {
        inp.value = String(currentValue());
        inp.blur();
      }
    };
    cell.appendChild(inp);
    gold.appendChild(cell);
    ccyInputs[f] = inp;
  }
  wrap.appendChild(gold);

  root.appendChild(wrap);

  let unlocked = false;
  let viewMode: ViewMode = readViewMode();
  const collapsed = new Set<string>();
  const ghosts = new Set<string>();
  const tracker: PulseTracker = createPulseTracker();
  // prevRecord starts null so the very first rerender (from initial mount
  // below) diffs to an empty mark map — no on-load pulse storm. Subsequent
  // rerenders diff against the prior render's record.
  let prevRecord: PlayerInventoryRecord | null = null;
  let currentRecord = initialRecord;
  let currentCatalog = catalog;

  const updateLockUI = () => {
    lockBtn.textContent = unlocked ? "🔓" : "🔒";
    lockBtn.classList.toggle("unlocked", unlocked);
    lockBtn.title = unlocked ? "Click to lock editing" : "Click to unlock editing";
  };

  // Toggle button shows the *target* mode (what clicking will switch to).
  const updateViewToggleUI = () => {
    if (viewMode === "list") {
      viewToggleBtn.textContent = "▦";
      viewToggleBtn.title = "Switch to grid view";
    } else {
      viewToggleBtn.textContent = "☰";
      viewToggleBtn.title = "Switch to list view";
    }
  };

  const rerender = (record: PlayerInventoryRecord, cat: CatalogItem[]) => {
    currentRecord = record;
    currentCatalog = cat;
    hideTooltip();
    for (const f of ["pp","gp","sp","cp"] as const) {
      if (document.activeElement !== ccyInputs[f]) {
        ccyInputs[f].value = String(record.currency[f] ?? 0);
      }
    }

    // Re-inject [id, 0] rows for any ghost id that pruneZeros stripped from
    // the stored record (writeRecord drops count=0 entries before write).
    // Without this the row vanishes the moment metadata round-trips, the
    // diff reads it as an explicit removal, and the leave animation plays.
    let working = record;
    if (ghosts.size > 0) {
      const present = new Set(record.items.map(([id]) => id));
      const extras: PlayerInventoryRecord["items"] = [];
      for (const id of ghosts) {
        if (!present.has(id)) extras.push([id, 0]);
      }
      if (extras.length > 0) {
        working = { ...record, items: [...record.items, ...extras] };
      }
    }

    weightEl.textContent = `⚖ ${formatWeight(totalWeight(working.items, cat))} lb`;

    // Diff vs. previous record (if any) and stamp pulses.
    const marks = tracker.diff(prevRecord, working);

    // Ids removed this render get one frame as phantom rows.
    const phantomRemoves = new Set<string>();
    for (const [id, m] of marks) {
      if (m.kind === "remove") phantomRemoves.add(id);
    }

    tracker.mark(marks);
    prevRecord = working;

    const wrappedOnDescription = (id: string, anchor: { x: number; y: number }) => {
      const entry = working.items.find(([eid]) => eid === id);
      const count = entry?.[1] ?? 0;
      handlers.onDescription(id, anchor, {
        unlocked,
        count,
        onIncrement: () => { ghosts.add(id); void handlers.onIncrement(id); },
        onDecrement: () => { ghosts.add(id); void handlers.onDecrement(id); },
        onRemove:    () => { ghosts.delete(id); void handlers.onRemove(id); },
      });
    };

    if (viewMode === "grid") {
      const gridState: GridState = {
        items: working.items,
        catalog: cat,
        search: search.value,
        unlocked,
        collapsed,
        ghosts,
        tracker,
        phantomRemoves,
      };
      renderGrid(body, gridState, { onDescription: wrappedOnDescription });
    } else {
      const listState: ListState = {
        items: working.items,
        catalog: cat,
        search: search.value,
        unlocked,
        collapsed,
        ghosts,
        tracker,
        phantomRemoves,
      };
      renderList(body, listState, {
        onIncrement: (id) => {
          ghosts.add(id);
          void handlers.onIncrement(id);
        },
        onDecrement: (id) => {
          ghosts.add(id);
          void handlers.onDecrement(id);
        },
        onRemove: (id) => {
          ghosts.delete(id);
          void handlers.onRemove(id);
        },
        onDescription: wrappedOnDescription,
      });
    }
  };

  search.addEventListener("input", () => rerender(currentRecord, currentCatalog));
  search.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      search.value = "";
      rerender(currentRecord, currentCatalog);
    }
  });
  body.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const headerEl = t.closest<HTMLElement>(".cat-header");
    if (!headerEl) return;
    const cat = headerEl.dataset.category;
    if (!cat) return;
    const willCollapse = !collapsed.has(cat);
    if (willCollapse) collapsed.add(cat); else collapsed.delete(cat);
    // Toggle data-collapsed on the persistent .cat-group element so the
    // CSS grid-rows transition animates. A full rerender would replace
    // the DOM and skip the transition.
    const group = headerEl.closest<HTMLElement>(".cat-group");
    if (group) group.dataset.collapsed = willCollapse ? "true" : "false";
  });
  lockBtn.onclick = () => {
    unlocked = !unlocked;
    updateLockUI();
    rerender(currentRecord, currentCatalog);
  };
  viewToggleBtn.onclick = () => {
    viewMode = viewMode === "list" ? "grid" : "list";
    writeViewMode(viewMode);
    updateViewToggleUI();
    rerender(currentRecord, currentCatalog);
  };
  collapseAllBtn.onclick = () => {
    body.querySelectorAll<HTMLElement>(".cat-group").forEach((group) => {
      const cat = group.dataset.category;
      if (cat) collapsed.add(cat);
      group.dataset.collapsed = "true";
    });
  };
  expandAllBtn.onclick = () => {
    collapsed.clear();
    body.querySelectorAll<HTMLElement>(".cat-group").forEach((group) => {
      group.dataset.collapsed = "false";
    });
  };

  updateLockUI();
  updateViewToggleUI();
  rerender(initialRecord, catalog);

  return {
    rerender,
    markReceived: (itemId, quantity) => {
      tracker.mark(new Map([[itemId, { kind: "received", delta: quantity }]]));
      // The diff path never produces "received", so auto-expand has to
      // happen here. Schedule a render immediately so the pulse is visible
      // even if the metadata event never lands (broadcast-only path).
      const item = currentCatalog.find((c) => c.id === itemId);
      if (item) collapsed.delete(item.category);
      rerender(currentRecord, currentCatalog);
    },
    destroy: () => { root.innerHTML = ""; },
  };
}

function formatWeight(w: number): string {
  if (w === 0) return "0";
  if (Number.isInteger(w)) return String(w);
  return w.toFixed(1);
}

/**
 * Parse a currency input value:
 * - "123"   → set to 123
 * - "+45"   → current + 45
 * - "-20"   → current - 20  (caller clamps at 0)
 * - "" or junk → null (caller reverts)
 */
export function parseCurrencyInput(raw: string, current: number): number | null {
  const t = raw.trim();
  const m = /^([+-]?)(\d+)$/.exec(t);
  if (!m) return null;
  const n = parseInt(m[2], 10);
  if (m[1] === "+") return current + n;
  if (m[1] === "-") return current - n;
  return n;
}

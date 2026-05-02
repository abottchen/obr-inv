import { renderList, type ListState, type RowHandlers } from "./ui-list";
import { renderGrid, type GridState } from "./ui-grid";
import { totalWeight } from "./inventory";
import { createPulseTracker, type PulseTracker } from "./ui-feedback";
import { mountIconSprite, icon, setIcon } from "./ui-icons";
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
  mountIconSprite();

  const wrap = document.createElement("div");
  wrap.className = "shell";

  // Top accent rail. CSS shows it only when the shell is unlocked, so the
  // gilt glow becomes the unmistakable signal that edit mode is on — even
  // for a player who scrolled past the lock pill.
  const lockRail = document.createElement("div");
  lockRail.className = "lock-rail";
  wrap.appendChild(lockRail);

  const header = document.createElement("div");
  header.className = "shell-header";

  // Brand bar — heraldic mark + name of the bound inventory. Spans the
  // header's full width above the controls row.
  const brand = document.createElement("div");
  brand.className = "brand";
  const brandMark = icon("i-brand", "brand-mark");
  brand.appendChild(brandMark);
  const brandTitle = document.createElement("span");
  brandTitle.className = "brand-title font-display";
  brandTitle.textContent = "Tome of Holdings";
  brand.appendChild(brandTitle);
  const brandSub = document.createElement("span");
  brandSub.className = "brand-sub";
  brandSub.textContent = initialRecord.name;
  brand.appendChild(brandSub);
  header.appendChild(brand);

  // Controls row. Wrapper splits the header into [brand], then [controls];
  // CSS lays out the controls children left-to-right (search dominant).
  const controls = document.createElement("div");
  controls.className = "shell-controls";

  const searchWrap = document.createElement("label");
  searchWrap.className = "search-wrap";
  searchWrap.appendChild(icon("i-search", "search-icon"));
  const search = document.createElement("input");
  search.className = "shell-search";
  search.placeholder = "Seek by name…";
  searchWrap.appendChild(search);
  controls.appendChild(searchWrap);

  const iconPair = document.createElement("div");
  iconPair.className = "icon-pair";
  const collapseAllBtn = document.createElement("button");
  collapseAllBtn.className = "shell-btn";
  collapseAllBtn.title = "Collapse all categories";
  collapseAllBtn.appendChild(icon("i-collapse"));
  iconPair.appendChild(collapseAllBtn);
  const expandAllBtn = document.createElement("button");
  expandAllBtn.className = "shell-btn";
  expandAllBtn.title = "Expand all categories";
  expandAllBtn.appendChild(icon("i-expand"));
  iconPair.appendChild(expandAllBtn);
  controls.appendChild(iconPair);

  // Segmented view toggle: list on the left, grid on the right. The
  // .view-toggle class on the grid button satisfies legacy tests that
  // grab the toggle by class; clicking either child swaps mode.
  const viewSeg = document.createElement("div");
  viewSeg.className = "view-seg";
  const viewListBtn = document.createElement("button");
  viewListBtn.dataset.mode = "list";
  viewListBtn.title = "List view";
  viewListBtn.appendChild(icon("i-list"));
  viewSeg.appendChild(viewListBtn);
  const viewGridBtn = document.createElement("button");
  viewGridBtn.className = "view-toggle";
  viewGridBtn.dataset.mode = "grid";
  viewGridBtn.title = "Grid view";
  viewGridBtn.appendChild(icon("i-grid"));
  viewSeg.appendChild(viewGridBtn);
  controls.appendChild(viewSeg);

  const lockBtn = document.createElement("button");
  lockBtn.className = "lock-toggle";
  lockBtn.title = "Click to unlock editing";
  const lockIcon = icon("i-lock", "lock-icon");
  const lockLabel = document.createElement("span");
  lockLabel.className = "lock-label";
  lockLabel.textContent = "Locked";
  lockBtn.appendChild(lockIcon);
  lockBtn.appendChild(lockLabel);
  controls.appendChild(lockBtn);

  header.appendChild(controls);
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
  const weightWrap = document.createElement("span");
  weightWrap.className = "weight";
  const weightNum = document.createElement("span");
  weightNum.className = "weight-num font-mono";
  weightNum.textContent = "0";
  const weightUnit = document.createElement("span");
  weightUnit.className = "weight-unit";
  weightUnit.textContent = "lb borne";
  weightWrap.appendChild(weightNum);
  weightWrap.appendChild(weightUnit);
  footer.appendChild(weightWrap);
  // Compatibility alias: `weightEl` was the single span the original
  // shell wrote into. The rerender path still calls `weightEl.textContent`,
  // so keep it pointing at the number node — the unit is static.
  const weightEl = weightNum;
  // Trailing cluster: optional "+ Create item" (GM only) followed by
  // the always-present "+ Add to inventory" button.
  const actions = document.createElement("div");
  actions.className = "shell-actions";
  if (handlers.onCreateCustomClick) {
    const createBtn = document.createElement("button");
    createBtn.className = "btn-create font-display";
    createBtn.textContent = "Create item";
    createBtn.title = "Create a one-off custom item (GM only)";
    createBtn.onclick = handlers.onCreateCustomClick;
    actions.appendChild(createBtn);
  }
  const addBtn = document.createElement("button");
  addBtn.className = "btn-add font-display";
  addBtn.textContent = "Add to inventory";
  addBtn.onclick = handlers.onAddClick;
  actions.appendChild(addBtn);
  footer.appendChild(actions);
  wrap.appendChild(footer);

  const gold = document.createElement("div");
  gold.className = "gold-strip pouch";
  const ccyInputs = {} as Record<"pp" | "gp" | "sp" | "cp", HTMLInputElement>;
  const tip = "Type a number to set, +N to add, -N to subtract";
  for (const f of ["pp", "gp", "sp", "cp"] as const) {
    const cell = document.createElement("div");
    cell.className = "gold-cell coin";
    cell.dataset.ccy = f;
    cell.title = tip;
    const disc = document.createElement("span");
    disc.className = "coin-disc font-display";
    disc.textContent = f.toUpperCase();
    cell.appendChild(disc);
    // Hidden alias kept for any legacy CSS that targets the label;
    // visible label is now the coin disc above.
    const lbl = document.createElement("label");
    lbl.textContent = f;
    lbl.style.display = "none";
    cell.appendChild(lbl);
    const inp = document.createElement("input");
    inp.type = "text";
    inp.inputMode = "numeric";
    inp.className = "coin-input font-mono";
    inp.value = "0";
    inp.title = tip;
    inp.setAttribute("aria-label", `${f.toUpperCase()} coins`);
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
    setIcon(lockIcon, unlocked ? "i-unlock" : "i-lock");
    lockLabel.textContent = unlocked ? "Unlocked" : "Locked";
    lockBtn.classList.toggle("unlocked", unlocked);
    lockBtn.title = unlocked ? "Click to lock editing" : "Click to unlock editing";
    // The wrap data-attr drives both the gilt accent rail and any other
    // unlocked-mode treatments (row-action visibility, etc.).
    wrap.dataset.unlocked = unlocked ? "true" : "false";
  };

  // Segmented control: each button reflects its own mode. The active class
  // moves to whichever button matches the current viewMode.
  const updateViewToggleUI = () => {
    viewListBtn.classList.toggle("active", viewMode === "list");
    viewGridBtn.classList.toggle("active", viewMode === "grid");
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

    weightEl.textContent = formatWeight(totalWeight(working.items, cat));

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
  // Segmented control: each button selects its mode. Clicking the already-
  // active button is a no-op.
  const setView = (mode: ViewMode) => {
    if (mode === viewMode) return;
    viewMode = mode;
    writeViewMode(viewMode);
    updateViewToggleUI();
    rerender(currentRecord, currentCatalog);
  };
  viewListBtn.onclick = () => setView("list");
  viewGridBtn.onclick = () => setView("grid");
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

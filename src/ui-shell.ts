import { renderList, type ListState, type RowHandlers } from "./ui-list";
import { totalWeight } from "./inventory";
import { createPulseTracker, type PulseTracker } from "./ui-feedback";
import type { CatalogItem, PlayerInventoryRecord } from "./types";

export interface ShellHandlers extends Omit<RowHandlers, "onIncrement" | "onDecrement" | "onRemove"> {
  onIncrement: (id: string) => Promise<void>;
  onDecrement: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onCurrencyChange: (
    field: "pp" | "gp" | "sp" | "cp", value: number,
  ) => Promise<void>;
  onAddClick: () => void;
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
  const lockBtn = document.createElement("button");
  lockBtn.className = "lock-toggle";
  lockBtn.textContent = "🔒";
  lockBtn.title = "Click to unlock editing";
  header.appendChild(lockBtn);
  wrap.appendChild(header);

  const body = document.createElement("div");
  body.className = "shell-body";
  wrap.appendChild(body);

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

  const rerender = (record: PlayerInventoryRecord, cat: CatalogItem[]) => {
    currentRecord = record;
    currentCatalog = cat;
    for (const f of ["pp","gp","sp","cp"] as const) {
      if (document.activeElement !== ccyInputs[f]) {
        ccyInputs[f].value = String(record.currency[f] ?? 0);
      }
    }
    weightEl.textContent = `⚖ ${formatWeight(totalWeight(record.items, cat))} lb`;

    // Diff vs. previous record (if any) and stamp pulses.
    const marks = tracker.diff(prevRecord, record);

    // Ids removed this render get one frame as phantom rows.
    const phantomRemoves = new Set<string>();
    for (const [id, m] of marks) {
      if (m.kind === "remove") phantomRemoves.add(id);
    }

    tracker.mark(marks);
    prevRecord = record;

    const state: ListState = {
      items: record.items,
      catalog: cat,
      search: search.value,
      unlocked,
      collapsed,
      ghosts,
      tracker,
      phantomRemoves,
    };
    renderList(body, state, {
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
      onDescription: handlers.onDescription,
      onTransfer: handlers.onTransfer,
    });
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

  updateLockUI();
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

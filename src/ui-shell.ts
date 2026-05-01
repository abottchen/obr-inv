import { renderList, type ListState, type RowHandlers } from "./ui-list";
import { totalWeight } from "./inventory";
import type { CatalogItem, PlayerInventoryRecord } from "./types";

export interface ShellHandlers extends Omit<RowHandlers, "onIncrement" | "onDecrement" | "onRemove"> {
  onIncrement: (id: string) => Promise<void>;
  onDecrement: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onCurrencyChange: (
    field: "pp" | "gp" | "sp" | "cp", value: number,
  ) => Promise<void>;
  onAddClick: () => void;
}

export interface ShellRefs {
  rerender: (record: PlayerInventoryRecord, catalog: CatalogItem[]) => void;
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
  const addBtn = document.createElement("button");
  addBtn.className = "btn-add";
  addBtn.textContent = "+ Add to inventory";
  addBtn.onclick = handlers.onAddClick;
  footer.appendChild(addBtn);
  wrap.appendChild(footer);

  const gold = document.createElement("div");
  gold.className = "gold-strip";
  const ccyInputs: Record<string, HTMLInputElement> = {} as any;
  for (const f of ["pp", "gp", "sp", "cp"] as const) {
    const cell = document.createElement("div");
    cell.className = "gold-cell";
    const lbl = document.createElement("label");
    lbl.textContent = f;
    cell.appendChild(lbl);
    const inp = document.createElement("input");
    inp.type = "number"; inp.min = "0"; inp.value = "0";
    const commit = (v: number) => {
      const clamped = Math.max(0, Math.floor(v));
      inp.value = String(clamped);
      void handlers.onCurrencyChange(f, clamped);
    };
    inp.onchange = () => commit(parseInt(inp.value, 10) || 0);
    cell.appendChild(inp);
    const stepper = document.createElement("div");
    stepper.className = "ccy-stepper";
    const up = document.createElement("button");
    up.type = "button"; up.className = "ccy-step ccy-up";
    up.textContent = "▲"; up.title = `Increase ${f}`;
    up.onclick = () => commit((parseInt(inp.value, 10) || 0) + 1);
    const down = document.createElement("button");
    down.type = "button"; down.className = "ccy-step ccy-down";
    down.textContent = "▼"; down.title = `Decrease ${f}`;
    down.onclick = () => commit((parseInt(inp.value, 10) || 0) - 1);
    stepper.appendChild(up);
    stepper.appendChild(down);
    cell.appendChild(stepper);
    gold.appendChild(cell);
    ccyInputs[f] = inp;
  }
  wrap.appendChild(gold);

  root.appendChild(wrap);

  let unlocked = false;
  const collapsed = new Set<string>();
  const ghosts = new Set<string>();
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
    const state: ListState = {
      items: record.items,
      catalog: cat,
      search: search.value,
      unlocked,
      collapsed,
      ghosts,
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
    const cat = t.closest<HTMLElement>(".cat-header")?.dataset.category;
    if (cat) {
      if (collapsed.has(cat)) collapsed.delete(cat); else collapsed.add(cat);
      rerender(currentRecord, currentCatalog);
    }
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
    destroy: () => { root.innerHTML = ""; },
  };
}

function formatWeight(w: number): string {
  if (w === 0) return "0";
  if (Number.isInteger(w)) return String(w);
  return w.toFixed(1);
}

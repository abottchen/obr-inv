import { escapeHtml, isSafeIconUrl } from "./escape";
import type { CatalogItem, InventoryEntry, Rarity } from "./types";
import type { PulseTracker, PulseEntry } from "./ui-feedback";

export interface RowHandlers {
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onDescription: (id: string, anchor: { x: number; y: number }) => void;
}

export interface ListState {
  items: InventoryEntry[];
  catalog: CatalogItem[];
  search: string;
  unlocked: boolean;
  collapsed: Set<string>;
  ghosts: Set<string>;
  tracker: PulseTracker;
  phantomRemoves: Set<string>;
}

export function renderList(
  container: HTMLElement, state: ListState, handlers: RowHandlers,
): void {
  container.innerHTML = "";
  const byId = new Map(state.catalog.map((c) => [c.id, c]));
  const search = state.search.trim().toLowerCase();

  // Real items + synthetic [id, 0] entries for phantom removes (one render).
  const working: InventoryEntry[] = [...state.items];
  const realIds = new Set(state.items.map((e) => e[0]));
  for (const id of state.phantomRemoves) {
    if (!realIds.has(id)) working.push([id, 0]);
  }

  const byCat = new Map<string, Array<{ entry: InventoryEntry; item: CatalogItem | null }>>();
  for (const entry of working) {
    const item = byId.get(entry[0]) ?? null;
    const isPhantom = state.phantomRemoves.has(entry[0]);
    if (entry[1] === 0 && !state.ghosts.has(entry[0]) && !isPhantom) continue;
    if (search && !rowMatches(entry, item, search)) continue;
    const cat = item?.category ?? "Unknown";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push({ entry, item });
  }

  if (byCat.size === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = search ? `No items match "${state.search}"` : "Inventory is empty";
    container.appendChild(empty);
    return;
  }

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  const receivedRows: HTMLElement[] = [];

  const sortedCats = [...byCat.entries()].sort(
    ([a], [b]) => a.localeCompare(b),
  );
  for (const [cat, entries] of sortedCats) {
    const collapsed = state.collapsed.has(cat);

    const group = document.createElement("div");
    group.className = "cat-group";
    group.dataset.category = cat;
    group.dataset.collapsed = collapsed ? "true" : "false";

    const header = document.createElement("div");
    header.className = "cat-header";
    header.dataset.category = cat;
    header.innerHTML = `<span><span class="chev">▾</span> ${escapeHtml(cat)}</span><span>(${entries.length})</span>`;
    group.appendChild(header);

    const bodyEl = document.createElement("div");
    bodyEl.className = "cat-body";
    const inner = document.createElement("div");
    inner.className = "cat-body-inner";
    for (const { entry, item } of entries) {
      const row = renderRow(entry, item, state.unlocked, search, handlers, state.tracker);
      if (row.dataset.pulse === "received") receivedRows.push(row);
      inner.appendChild(row);
    }
    bodyEl.appendChild(inner);
    group.appendChild(bodyEl);

    container.appendChild(group);
  }

  for (const row of receivedRows) {
    // jsdom doesn't implement scrollIntoView; guard so DOM tests don't crash.
    row.scrollIntoView?.({
      block: "center",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }
}

function rowMatches(
  entry: InventoryEntry, item: CatalogItem | null, search: string,
): boolean {
  const name = item?.name ?? entry[0];
  return name.toLowerCase().includes(search);
}

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${Math.abs(delta)}`;
  return "";
}

function renderRow(
  entry: InventoryEntry, item: CatalogItem | null, unlocked: boolean,
  search: string, h: RowHandlers, tracker: PulseTracker,
): HTMLElement {
  const [id, count] = entry;
  const row = document.createElement("div");
  row.className = "inv-row";
  if (item?.rarity) row.dataset.rarity = item.rarity as Rarity;
  row.dataset.itemId = id;

  const icon = document.createElement("div");
  icon.className = "inv-icon";
  if (item?.icon && isSafeIconUrl(item.icon)) {
    icon.style.backgroundImage = `url("${item.icon}")`;
  } else {
    icon.textContent = "❓";
  }
  row.appendChild(icon);

  const name = document.createElement("div");
  name.className = "inv-name";
  name.innerHTML = item ? highlight(item.name, search) : escapeHtml(`[${id}] (missing from catalog)`);
  row.appendChild(name);

  const cnt = document.createElement("div");
  cnt.className = "inv-count";
  cnt.textContent = `×${count}`;
  const delta = document.createElement("span");
  delta.className = "inv-delta";
  cnt.appendChild(delta);
  row.appendChild(cnt);

  const pulse: PulseEntry | null = tracker.consume(id);
  if (pulse) {
    row.dataset.pulse = pulse.kind;
    if (pulse.delta != null) delta.textContent = formatDelta(pulse.delta);
  }

  if (unlocked) {
    const dec = document.createElement("button");
    dec.className = "btn-step"; dec.textContent = "−"; dec.title = "Decrease";
    dec.dataset.action = "dec";
    dec.onclick = () => h.onDecrement(id);
    row.appendChild(dec);

    const inc = document.createElement("button");
    inc.className = "btn-step"; inc.textContent = "+"; inc.title = "Increase";
    inc.dataset.action = "inc";
    inc.onclick = () => h.onIncrement(id);
    row.appendChild(inc);

    const rm = document.createElement("button");
    rm.className = "btn-x"; rm.textContent = "🗑"; rm.title = "Delete this item";
    rm.dataset.action = "remove";
    rm.onclick = () => h.onRemove(id);
    row.appendChild(rm);
  }

  // Right-click anywhere on the row opens the description popover, which
  // contains a Transfer button when applicable. Shift+right-click was the
  // previous transfer shortcut but Firefox forces its native menu when
  // Shift is held, bypassing preventDefault.
  // Exempt the ± / × buttons so right-clicking those does nothing surprising.
  row.addEventListener("contextmenu", (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest(".btn-step, .btn-x")) return;
    ev.preventDefault();
    const me = ev as MouseEvent;
    h.onDescription(id, { x: me.clientX, y: me.clientY });
  });

  return row;
}

function highlight(text: string, search: string): string {
  if (!search) return escapeHtml(text);
  const lower = text.toLowerCase();
  const idx = lower.indexOf(search);
  if (idx < 0) return escapeHtml(text);
  return escapeHtml(text.slice(0, idx))
    + `<mark>${escapeHtml(text.slice(idx, idx + search.length))}</mark>`
    + escapeHtml(text.slice(idx + search.length));
}

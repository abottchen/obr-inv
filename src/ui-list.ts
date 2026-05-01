import type { CatalogItem, InventoryEntry, Rarity } from "./types";

export interface RowHandlers {
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onDescription: (id: string, anchor: { x: number; y: number }) => void;
  onTransfer: (id: string, anchor: { x: number; y: number }) => void;
}

export interface ListState {
  items: InventoryEntry[];
  catalog: CatalogItem[];
  search: string;
  unlocked: boolean;
  collapsed: Set<string>;
  ghosts: Set<string>;
}

export function renderList(
  container: HTMLElement, state: ListState, handlers: RowHandlers,
): void {
  container.innerHTML = "";
  const byId = new Map(state.catalog.map((c) => [c.id, c]));
  const search = state.search.trim().toLowerCase();

  const byCat = new Map<string, Array<{ entry: InventoryEntry; item: CatalogItem | null }>>();
  for (const entry of state.items) {
    const item = byId.get(entry[0]) ?? null;
    if (entry[1] === 0 && !state.ghosts.has(entry[0])) continue;
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

  for (const [cat, entries] of byCat.entries()) {
    const collapsed = state.collapsed.has(cat);
    const header = document.createElement("div");
    header.className = "cat-header";
    header.dataset.category = cat;
    header.innerHTML = `<span><span class="chev">${collapsed ? "▸" : "▾"}</span> ${escape(cat)}</span><span>(${entries.length})</span>`;
    container.appendChild(header);
    if (collapsed) continue;
    for (const { entry, item } of entries) {
      container.appendChild(renderRow(entry, item, state.unlocked, search, handlers));
    }
  }
}

function rowMatches(
  entry: InventoryEntry, item: CatalogItem | null, search: string,
): boolean {
  const name = item?.name ?? entry[0];
  return name.toLowerCase().includes(search);
}

function renderRow(
  entry: InventoryEntry, item: CatalogItem | null, unlocked: boolean,
  search: string, h: RowHandlers,
): HTMLElement {
  const [id, count] = entry;
  const row = document.createElement("div");
  row.className = "inv-row";
  if (item?.rarity) row.dataset.rarity = item.rarity as Rarity;
  row.dataset.itemId = id;

  const icon = document.createElement("div");
  icon.className = "inv-icon";
  if (item?.icon) icon.style.backgroundImage = `url("${item.icon}")`;
  else icon.textContent = "❓";
  row.appendChild(icon);

  const name = document.createElement("div");
  name.className = "inv-name";
  name.innerHTML = item ? highlight(item.name, search) : escape(`[${id}] (missing from catalog)`);
  row.appendChild(name);

  const cnt = document.createElement("div");
  cnt.className = "inv-count";
  cnt.textContent = `×${count}`;
  row.appendChild(cnt);

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
    rm.className = "btn-x"; rm.textContent = "✕"; rm.title = "Remove";
    rm.dataset.action = "remove";
    rm.onclick = () => h.onRemove(id);
    row.appendChild(rm);
  }

  // Right-click and shift+right-click open description / transfer.
  // Bound to the icon+name+count area only — not the buttons.
  const interactiveZone = [icon, name, cnt];
  for (const el of interactiveZone) {
    el.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      const me = ev as MouseEvent;
      if (me.shiftKey) h.onTransfer(id, { x: me.clientX, y: me.clientY });
      else h.onDescription(id, { x: me.clientX, y: me.clientY });
    });
  }

  return row;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

function highlight(text: string, search: string): string {
  if (!search) return escape(text);
  const lower = text.toLowerCase();
  const idx = lower.indexOf(search);
  if (idx < 0) return escape(text);
  return escape(text.slice(0, idx))
    + `<mark>${escape(text.slice(idx, idx + search.length))}</mark>`
    + escape(text.slice(idx + search.length));
}

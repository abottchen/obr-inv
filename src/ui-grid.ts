import { escapeHtml } from "./escape";
import type { CatalogItem, InventoryEntry, Rarity } from "./types";
import { appendIconImage } from "./ui-icon";
import { groupByCategory } from "./ui-items-data";
import type { PulseTracker } from "./ui-feedback";

export interface GridHandlers {
  onDescription: (id: string, anchor: { x: number; y: number }) => void;
}

export interface GridState {
  items: InventoryEntry[];
  catalog: CatalogItem[];
  search: string;
  unlocked: boolean;
  collapsed: Set<string>;
  ghosts: Set<string>;
  tracker: PulseTracker;
  phantomRemoves: Set<string>;
}

export function renderGrid(
  container: HTMLElement, state: GridState, handlers: GridHandlers,
): void {
  container.innerHTML = "";
  const search = state.search.trim().toLowerCase();
  const sortedCats = groupByCategory({
    items: state.items,
    catalog: state.catalog,
    search: state.search,
    ghosts: state.ghosts,
    phantomRemoves: state.phantomRemoves,
  });

  if (sortedCats.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = search ? `No items match "${state.search}"` : "Inventory is empty";
    container.appendChild(empty);
    return;
  }

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  const receivedCells: HTMLElement[] = [];

  for (const [cat, entries] of sortedCats) {
    const collapsed = state.collapsed.has(cat);

    const group = document.createElement("div");
    group.className = "cat-group";
    group.dataset.category = cat;
    group.dataset.collapsed = collapsed ? "true" : "false";

    const header = document.createElement("div");
    header.className = "cat-header";
    header.dataset.category = cat;
    header.innerHTML = `<span><span class="chev"></span><span class="cat-title">${escapeHtml(cat)}</span></span><span class="cat-count">${entries.length}</span>`;
    group.appendChild(header);

    const bodyEl = document.createElement("div");
    bodyEl.className = "cat-body";
    const inner = document.createElement("div");
    inner.className = "cat-body-inner grid-cells";

    // Alphabetize within the category for grid layout. Helper preserves
    // input order so list view stays unaffected.
    const sortedEntries = [...entries].sort((a, b) => {
      const an = a.item?.name ?? a.entry[0];
      const bn = b.item?.name ?? b.entry[0];
      return an.localeCompare(bn);
    });

    for (const { entry, item } of sortedEntries) {
      const cell = renderCell(entry, item, handlers, state.tracker);
      if (cell.dataset.pulse === "received") receivedCells.push(cell);
      inner.appendChild(cell);
    }
    bodyEl.appendChild(inner);
    group.appendChild(bodyEl);

    container.appendChild(group);
  }

  for (const cell of receivedCells) {
    cell.scrollIntoView?.({
      block: "center",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }
}

function renderCell(
  entry: InventoryEntry, item: CatalogItem | null,
  h: GridHandlers, tracker: PulseTracker,
): HTMLElement {
  const [id, count] = entry;
  const cell = document.createElement("div");
  cell.className = "inv-cell";
  if (item?.rarity) cell.dataset.rarity = item.rarity as Rarity;
  cell.dataset.itemId = id;

  const image = document.createElement("div");
  image.className = "cell-image";
  const appended = item?.icon ? appendIconImage(image, item.icon) : null;
  if (!appended) image.textContent = "❓";
  cell.appendChild(image);

  if (count > 1) {
    const badge = document.createElement("div");
    badge.className = "cell-count";
    badge.textContent = `×${count}`;
    cell.appendChild(badge);
  }

  const tip = document.createElement("span");
  tip.className = "cell-tooltip";
  if (item?.rarity) tip.dataset.rarity = item.rarity;
  tip.textContent = item ? item.name : `[${id}] (missing from catalog)`;
  cell.appendChild(tip);

  const pulse = tracker.consume(id);
  if (pulse) cell.dataset.pulse = pulse.kind;

  cell.addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
    const me = ev as MouseEvent;
    h.onDescription(id, { x: me.clientX, y: me.clientY });
  });

  return cell;
}

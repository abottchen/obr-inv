import type { CatalogItem, InventoryEntry, Rarity } from "./types";
import { appendIconImage } from "./ui-icon";
import { flatSorted } from "./ui-items-data";
import type { PulseTracker } from "./ui-feedback";

export interface GridHandlers {
  onDescription: (id: string, anchor: { x: number; y: number }) => void;
}

export interface GridState {
  items: InventoryEntry[];
  catalog: CatalogItem[];
  search: string;
  ghosts: Set<string>;
  tracker: PulseTracker;
  phantomRemoves: Set<string>;
}

export function renderGrid(
  container: HTMLElement, state: GridState, handlers: GridHandlers,
): void {
  container.innerHTML = "";
  const search = state.search.trim().toLowerCase();
  const entries = flatSorted({
    items: state.items,
    catalog: state.catalog,
    search: state.search,
    ghosts: state.ghosts,
    phantomRemoves: state.phantomRemoves,
  });

  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    if (search) {
      empty.textContent = `No items match "${state.search}"`;
    } else {
      empty.classList.add("empty-pack");
      empty.innerHTML = `
        <svg class="empty-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M5 7h14l-2 12c0 1-1 2-2 2H9c-1 0-2-1-2-2L5 7Z"/>
          <path d="M9 7V5a3 3 0 0 1 6 0v2"/>
          <path d="M10 13h4"/>
        </svg>
        <h3 class="empty-title">Your pack is empty</h3>
        <p class="empty-sub">Quests reward those prepared for them. Stock up on potions, scrolls, and arms before you set out.</p>
      `;
    }
    container.appendChild(empty);
    return;
  }

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  const grid = document.createElement("div");
  grid.className = "grid-cells";

  const receivedCells: HTMLElement[] = [];
  for (const { entry, item } of entries) {
    const cell = renderCell(entry, item, handlers, state.tracker);
    if (cell.dataset.pulse === "received") receivedCells.push(cell);
    grid.appendChild(cell);
  }

  container.appendChild(grid);

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

  // Both left- and right-click open the description popover. The popover
  // is the sole edit surface in grid view (cells are visually identical
  // regardless of intent), so making the primary mouse button work as
  // well as the context menu is purely a discoverability win — no
  // behaviour conflict.
  const open = (ev: MouseEvent) => {
    h.onDescription(id, { x: ev.clientX, y: ev.clientY });
  };
  cell.addEventListener("click", open);
  cell.addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
    open(ev);
  });

  return cell;
}

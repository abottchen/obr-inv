import { escapeHtml } from "./escape";
import type { CatalogItem, InventoryEntry, Rarity } from "./types";
import { appendIconImage } from "./ui-icon";
import { icon as svgIcon } from "./ui-icons";
import { groupByCategory } from "./ui-items-data";
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
    if (search) {
      // Search-no-match: keep it terse, the user already gave the query.
      empty.textContent = `No items match "${state.search}"`;
    } else {
      // First-time / cleared inventory: an evocative state with a glyph,
      // serif title, and italic subline. Sets the tone before the player
      // has any items to look at.
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

  const receivedRows: HTMLElement[] = [];

  for (const [cat, entries] of sortedCats) {
    const collapsed = state.collapsed.has(cat);

    const group = document.createElement("div");
    group.className = "cat-group";
    group.dataset.category = cat;
    group.dataset.collapsed = collapsed ? "true" : "false";

    const header = document.createElement("div");
    header.className = "cat-header";
    header.dataset.category = cat;
    // Chev is a CSS-drawn arrow (see .cat-header .chev rule); the span is
    // empty so it doesn't render any glyph beneath the borders.
    header.innerHTML = `<span><span class="chev"></span><span class="cat-title">${escapeHtml(cat)}</span></span><span class="cat-count">${entries.length}</span>`;
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
  const appended = item?.icon ? appendIconImage(icon, item.icon) : null;
  if (!appended) icon.textContent = "❓";
  row.appendChild(icon);

  const name = document.createElement("div");
  name.className = "inv-name";
  if (item?.rarity) name.dataset.rarity = item.rarity;
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
    rm.className = "btn-x"; rm.title = "Delete this item";
    rm.appendChild(svgIcon("i-trash"));
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

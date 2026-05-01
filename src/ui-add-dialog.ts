import type { CatalogItem } from "./types";

export interface AddDialogOpts {
  catalog: CatalogItem[];
  onAdd: (itemId: string, qty: number) => Promise<void> | void;
}

let active: HTMLElement | null = null;

export function openAddDialog(opts: AddDialogOpts): void {
  closeAddDialog();

  const overlay = document.createElement("div");
  overlay.className = "dialog-overlay";

  const header = document.createElement("div");
  header.className = "dialog-header";
  const h = document.createElement("h3");
  h.textContent = "Add to inventory";
  h.style.margin = "0";
  header.appendChild(h);
  const close = document.createElement("button");
  close.className = "dialog-close"; close.textContent = "✕";
  close.onclick = closeAddDialog;
  header.appendChild(close);
  overlay.appendChild(header);

  const search = document.createElement("input");
  search.className = "shell-search";
  search.placeholder = "Search items by name...";
  search.style.margin = "8px";
  // .shell-search has flex:1 for the inventory header (horizontal flex). In this
  // dialog the parent is a column flex, so flex:1 would grow it vertically.
  search.style.flex = "0 0 auto";
  overlay.appendChild(search);

  const body = document.createElement("div");
  body.className = "dialog-body";
  overlay.appendChild(body);

  const dropZone = document.createElement("div");
  dropZone.className = "drop-zone";
  dropZone.textContent = "Drop here to add";
  overlay.appendChild(dropZone);

  document.body.appendChild(overlay);

  const collapsed = new Set<string>();
  let dragId: string | null = null;
  let dropTimer: number | undefined;

  const renderAddRow = (item: CatalogItem): HTMLElement => {
    const row = document.createElement("div");
    row.className = "add-row";
    if (item.rarity) row.dataset.rarity = item.rarity;
    row.draggable = true;

    const icon = document.createElement("div");
    icon.className = "inv-icon";
    if (item.icon) icon.style.backgroundImage = `url("${item.icon}")`;
    row.appendChild(icon);

    const name = document.createElement("div");
    name.className = "item-name inv-name";
    if (item.rarity) name.dataset.rarity = item.rarity;
    name.textContent = item.name;
    row.appendChild(name);

    const qty = document.createElement("input");
    qty.className = "transfer-qty add-qty";
    qty.type = "number"; qty.min = "1"; qty.value = "1";
    row.appendChild(qty);

    const plus = document.createElement("button");
    plus.className = "btn-plus"; plus.textContent = "+";
    plus.onclick = async () => {
      const q = Math.max(1, parseInt(qty.value, 10) || 1);
      await opts.onAdd(item.id, q);
    };
    row.appendChild(plus);

    row.ondblclick = async () => {
      const q = Math.max(1, parseInt(qty.value, 10) || 1);
      await opts.onAdd(item.id, q);
    };

    row.addEventListener("dragstart", (e) => {
      dragId = item.id;
      dropZone.classList.add("active");
      if (e.dataTransfer) e.dataTransfer.setData("text/plain", item.id);
      window.clearTimeout(dropTimer);
    });
    row.addEventListener("dragend", () => {
      dropTimer = window.setTimeout(() => {
        dragId = null;
        dropZone.classList.remove("active", "over");
      }, 100);
    });
    return row;
  };

  const render = () => {
    body.innerHTML = "";
    const q = search.value.trim().toLowerCase();
    const groups = new Map<string, CatalogItem[]>();
    for (const item of opts.catalog) {
      if (q && !item.name.toLowerCase().includes(q)) continue;
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category)!.push(item);
    }
    if (groups.size === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = q ? `No items match "${search.value}"` : "Catalog is empty";
      body.appendChild(empty);
      return;
    }
    for (const [cat, entries] of groups.entries()) {
      const ch = document.createElement("div");
      ch.className = "cat-header";
      ch.dataset.category = cat;
      const isCollapsed = collapsed.has(cat);
      ch.innerHTML = `<span><span class="chev">${isCollapsed ? "▸" : "▾"}</span> ${escapeHtml(cat)}</span><span>(${entries.length})</span>`;
      ch.onclick = () => {
        if (collapsed.has(cat)) collapsed.delete(cat); else collapsed.add(cat);
        render();
      };
      body.appendChild(ch);
      if (isCollapsed) continue;
      for (const item of entries) body.appendChild(renderAddRow(item));
    }
  };

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("over");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("over"));
  dropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    window.clearTimeout(dropTimer);
    const id = dragId ?? e.dataTransfer?.getData("text/plain") ?? "";
    dragId = null;
    dropZone.classList.remove("active", "over");
    if (id) await opts.onAdd(id, 1);
  });

  search.addEventListener("input", render);
  render();

  active = overlay;
  document.addEventListener("keydown", onEsc);
}

export function closeAddDialog(): void {
  if (active) active.remove();
  active = null;
  document.removeEventListener("keydown", onEsc);
}

function onEsc(e: KeyboardEvent): void {
  if (e.key === "Escape") closeAddDialog();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

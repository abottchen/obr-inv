import type { CatalogItem } from "./types";
import type { StashEntry } from "./stash";
import { mountShell, type ShellHandlers, type ShellRefs } from "./ui-shell";
import { showDescription, closeDescription } from "./ui-description";

export interface OpenStashOpts {
  stashes: StashEntry[];
  catalog: CatalogItem[];
}

let active: HTMLElement | null = null;
let panel: HTMLElement | null = null;
let host: HTMLElement | null = null;
let tabsEl: HTMLElement | null = null;
let shell: ShellRefs | null = null;
let stashes: StashEntry[] = [];
let catalog: CatalogItem[] = [];
let selectedId = "";
let mountedName: string | null = null;

export function openStash(opts: OpenStashOpts): void {
  closeStash();
  if (opts.stashes.length === 0) return;
  stashes = opts.stashes;
  catalog = opts.catalog;
  selectedId = stashes[0].id;

  const back = document.createElement("div");
  back.className = "modal-backdrop";
  back.addEventListener("mousedown", (e) => {
    if (e.target === back) closeStash();
  });

  panel = document.createElement("div");
  panel.className = "modal stash-panel";
  host = document.createElement("div");
  host.className = "stash-shell-host";
  panel.appendChild(host);
  back.appendChild(panel);
  document.body.appendChild(back);
  active = back;

  renderTabs();
  mountSelected();
  document.addEventListener("keydown", onKey, true);
}

export function updateStash(next: StashEntry[], cat: CatalogItem[]): void {
  if (!active) return;
  stashes = next;
  catalog = cat;
  if (next.length === 0) {
    closeStash();
    return;
  }
  const current = next.find((s) => s.id === selectedId);
  if (!current) {
    selectedId = next[0].id;
    renderTabs();
    mountSelected();
  } else if (current.record.name !== mountedName) {
    renderTabs();
    mountSelected();
  } else {
    renderTabs();
    shell!.rerender(current.record, cat);
  }
}

export function closeStash(): void {
  closeDescription();
  shell?.destroy();
  active?.remove();
  document.removeEventListener("keydown", onKey, true);
  active = panel = host = tabsEl = shell = null;
  stashes = [];
  catalog = [];
  selectedId = "";
  mountedName = null;
}

function onKey(e: KeyboardEvent): void {
  if (e.key !== "Escape") return;
  const t = e.target as HTMLElement | null;
  if (t?.classList?.contains("shell-search") && (t as HTMLInputElement).value) {
    return; // the shell clears the search first
  }
  closeStash();
}

function renderTabs(): void {
  tabsEl?.remove();
  tabsEl = null;
  if (!panel || !host || stashes.length <= 1) return;
  const tabs = document.createElement("div");
  tabs.className = "stash-tabs";
  for (const s of stashes) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "stash-tab";
    if (s.id === selectedId) b.classList.add("active");
    b.dataset.stashId = s.id;
    b.textContent = s.record.name;
    b.addEventListener("click", () => {
      if (s.id === selectedId) return;
      selectedId = s.id;
      renderTabs();
      mountSelected();
    });
    tabs.appendChild(b);
  }
  panel.insertBefore(tabs, host);
  tabsEl = tabs;
}

function mountSelected(): void {
  const entry = stashes.find((s) => s.id === selectedId);
  if (!entry || !host) return;
  shell?.destroy();
  mountedName = entry.record.name;
  const handlers: ShellHandlers = {
    onIncrement: async () => {},
    onDecrement: async () => {},
    onRemove: async () => {},
    onCurrencyChange: async () => {},
    onAddClick: () => {},
    onDescription: (id, anchor) => {
      const item = catalog.find((c) => c.id === id);
      showDescription(anchor, item ?? null, id);
    },
  };
  shell = mountShell(host, entry.record, catalog, handlers, {
    readOnly: true,
    title: entry.record.name,
    subtitle: "Read only",
    onClose: closeStash,
  });
}

import {
  METER_RED_RATIO, METER_YELLOW_RATIO, STORAGE_CAP_BYTES,
} from "./constants";
import { findReferences, removeCustom, updateCustom } from "./customs";
import {
  getCustoms, listInventoryRecords, roomDataByteSize, writeCustoms,
} from "./metadata";
import { openCustomsDialog } from "./ui-customs-dialog";
import { resolvedCatalog } from "./catalog";
import type {
  CatalogItem, CustomItem, CustomItemsRecord, PlayerInventoryRecord,
} from "./types";
import { OverCapError } from "./types";

export interface CustomsPanelOpts {
  /** Latest catalog (remote-only). */
  catalog: CatalogItem[];
  /** Read-through accessor for live customs. The panel reopens its
   *  own local view on each metadata change via reload(). */
  initialCustoms: CustomItemsRecord;
  /** Latest inventory map; used to count references for delete UX. */
  records: Record<string, PlayerInventoryRecord>;
  /** Surfaces over-cap errors back to the GM via the existing modal. */
  onError?: (e: unknown) => void;
}

let active: HTMLElement | null = null;

export function openCustomsPanel(opts: CustomsPanelOpts): void {
  closeCustomsPanel();

  const back = document.createElement("div");
  back.className = "modal-backdrop";
  back.addEventListener("mousedown", (e) => {
    if (e.target === back) closeCustomsPanel();
  });

  const panel = document.createElement("div");
  panel.className = "modal customs-panel";

  const header = document.createElement("div");
  header.className = "customs-panel-header";
  const h = document.createElement("h3");
  h.textContent = "Custom items";
  header.appendChild(h);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "dialog-close";
  close.textContent = "✕";
  close.title = "Close";
  close.onclick = closeCustomsPanel;
  header.appendChild(close);
  panel.appendChild(header);

  const body = document.createElement("div");
  body.className = "customs-panel-body";
  panel.appendChild(body);

  const footer = document.createElement("div");
  footer.className = "customs-panel-footer";
  const countEl = document.createElement("span");
  const usageEl = document.createElement("span");
  usageEl.className = "usage";
  footer.appendChild(countEl);
  footer.appendChild(usageEl);
  panel.appendChild(footer);

  back.appendChild(panel);
  document.body.appendChild(back);
  active = back;

  // Track current snapshot inside the panel so the local re-render
  // doesn't have to round-trip through metadata for every interaction.
  let customs = opts.initialCustoms;
  let records = opts.records;

  const render = (): void => {
    body.innerHTML = "";
    if (customs.length === 0) {
      const empty = document.createElement("div");
      empty.className = "customs-panel-empty";
      empty.textContent =
        "No custom items yet. Use \"+ Create item\" in the inventory footer.";
      body.appendChild(empty);
    } else {
      for (const c of customs) {
        body.appendChild(renderRow(c));
      }
    }
    void renderFooter();
  };

  const renderRow = (c: CustomItem): HTMLElement => {
    const row = document.createElement("div");
    row.className = "customs-row";
    if (c.rarity) row.dataset.rarity = c.rarity;

    const icon = document.createElement("div");
    icon.className = "inv-icon";
    if (c.icon) icon.style.backgroundImage = `url("${c.icon}")`;
    else icon.textContent = "❓";
    row.appendChild(icon);

    const main = document.createElement("div");
    main.className = "customs-row-main";
    const name = document.createElement("div");
    name.className = "customs-row-name";
    name.textContent = c.name;
    main.appendChild(name);
    const meta = document.createElement("div");
    meta.className = "customs-row-meta";
    const refs = findReferences(c.id, records);
    const refTotal = refs.reduce((acc, r) => acc + r.count, 0);
    const refLabel = refTotal > 0
      ? `${c.category} · in ${refs.length} inventor${refs.length === 1 ? "y" : "ies"} (×${refTotal})`
      : `${c.category} · unused`;
    meta.textContent = refLabel;
    main.appendChild(meta);
    row.appendChild(main);

    const actions = document.createElement("div");
    actions.className = "customs-row-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-icon";
    editBtn.title = "Edit";
    editBtn.textContent = "✎";
    editBtn.onclick = () => {
      openCustomsDialog({
        resolved: resolvedCatalog(opts.catalog, customs),
        initial: c,
        onSave: async (updated) => {
          // OverCapError is the dialog's own concern — let it bubble so
          // the dialog can show its inline cap-full banner. Anything else
          // gets surfaced via the GM's error channel; we still rethrow so
          // the dialog stays open for the user to retry.
          try {
            const next = updateCustom(customs, updated);
            await writeCustoms(next);
            customs = next;
            render();
          } catch (err) {
            if (!(err instanceof OverCapError)) opts.onError?.(err);
            throw err;
          }
        },
      });
    };
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-icon danger";
    deleteBtn.title = "Delete";
    deleteBtn.textContent = "🗑";
    deleteBtn.onclick = () => {
      confirmDelete(c, refs, async () => {
        try {
          const next = removeCustom(customs, c.id);
          await writeCustoms(next);
          customs = next;
          render();
        } catch (err) {
          opts.onError?.(err);
        }
      });
    };
    actions.appendChild(deleteBtn);

    row.appendChild(actions);
    return row;
  };

  const renderFooter = async (): Promise<void> => {
    const totalBytes = await roomDataByteSize();
    const ratio = totalBytes / STORAGE_CAP_BYTES;
    countEl.textContent = `${customs.length} custom item${customs.length === 1 ? "" : "s"}`;
    usageEl.textContent = `${(totalBytes / 1024).toFixed(1)} KB / ${(STORAGE_CAP_BYTES / 1024).toFixed(0)} KB`;
    footer.dataset.state = ratio >= METER_RED_RATIO ? "red"
      : ratio >= METER_YELLOW_RATIO ? "yellow" : "green";
  };

  /** Re-pull customs + records and re-render. Called by the GM view's
   *  metadata subscription so the panel stays in sync with external
   *  edits and with cap-meter accounting. */
  const reload = async (): Promise<void> => {
    const [c, r] = await Promise.all([getCustoms(), listInventoryRecords()]);
    customs = c;
    records = r;
    render();
  };

  // Stash the reloader on the panel so the GM view can drive it.
  (back as HTMLElement & { __reload?: () => Promise<void> }).__reload = reload;

  document.addEventListener("keydown", onKeydown);
  render();
}

export function closeCustomsPanel(): void {
  if (active) active.remove();
  active = null;
  document.removeEventListener("keydown", onKeydown);
}

/**
 * If the panel is open, ask it to refresh from the latest metadata
 * snapshot. Otherwise no-op. Lets the parent view drive updates without
 * coupling to the panel's internals.
 */
export function reloadCustomsPanel(): void {
  if (!active) return;
  const fn = (active as HTMLElement & { __reload?: () => Promise<void> }).__reload;
  void fn?.();
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") closeCustomsPanel();
}

interface RefRow { playerName: string; count: number }

function confirmDelete(
  item: CustomItem, refs: RefRow[], onConfirm: () => Promise<void>,
): void {
  const back = document.createElement("div");
  back.className = "modal-backdrop";
  const m = document.createElement("div");
  m.className = "modal";
  m.style.maxWidth = "320px";

  const heading = document.createElement("h3");
  heading.textContent = `Delete "${item.name}"?`;
  m.appendChild(heading);

  if (refs.length === 0) {
    const p = document.createElement("p");
    p.textContent = "This item is not in any player's inventory.";
    m.appendChild(p);
  } else {
    const intro = document.createElement("p");
    intro.textContent = "This item is currently in:";
    m.appendChild(intro);
    const list = document.createElement("ul");
    list.className = "customs-confirm-list";
    for (const r of refs) {
      const li = document.createElement("li");
      li.textContent = `${r.playerName} — ${r.count}`;
      list.appendChild(li);
    }
    m.appendChild(list);
    const note = document.createElement("p");
    note.style.fontSize = "12px";
    note.style.color = "var(--text-dim)";
    note.textContent =
      "Their inventory rows will become \"missing from catalog\" until you re-create the item or promote it to the catalog.";
    m.appendChild(note);
  }

  const buttons = document.createElement("div");
  buttons.className = "customs-confirm-buttons";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn-cancel";
  cancel.textContent = "Cancel";
  cancel.onclick = () => back.remove();
  const del = document.createElement("button");
  del.type = "button";
  del.className = "btn-danger";
  del.textContent = refs.length === 0 ? "Delete" : "Delete anyway";
  del.onclick = async () => {
    del.disabled = true;
    cancel.disabled = true;
    try {
      await onConfirm();
    } finally {
      back.remove();
    }
  };
  buttons.appendChild(cancel);
  buttons.appendChild(del);
  m.appendChild(buttons);

  back.appendChild(m);
  document.body.appendChild(back);
}

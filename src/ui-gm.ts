import OBR from "@owlbear-rodeo/sdk";
import { mountShell } from "./ui-shell";
import { showDescription } from "./ui-description";
import { showTransfer, buildTargets } from "./ui-transfer";
import { openAddDialog, closeAddDialog } from "./ui-add-dialog";
import {
  listInventoryRecords, writeRecord, inventoryByteSize, onRoomMetadataChange,
} from "./metadata";
import {
  addItem, incrementItem, decrementItem, removeItem,
} from "./inventory";
import { transferItem } from "./transfer";
import { buildExport, downloadExport } from "./export";
import {
  BROADCAST_CHANNEL, STORAGE_CAP_BYTES,
  METER_YELLOW_RATIO, METER_RED_RATIO,
} from "./constants";
import { OverCapError } from "./types";
import type {
  CatalogItem, PlayerInventoryRecord, BroadcastMessage,
} from "./types";

export interface GmViewOpts {
  root: HTMLElement;
  catalog: CatalogItem[];
  catalogUrl: string;
  selfId: string;
  selfName: string;
  selfColor: string;
}

export function mountGmView(opts: GmViewOpts): () => void {
  const byId = new Map(opts.catalog.map((c) => [c.id, c]));

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.height = "100%";

  const tabsEl = document.createElement("div");
  tabsEl.className = "tabs";
  wrap.appendChild(tabsEl);

  const meterEl = document.createElement("div");
  meterEl.className = "meter-strip";
  meterEl.innerHTML = `<div class="meter-bar"><div class="meter-fill"></div></div><div class="meter-text"></div>`;
  wrap.appendChild(meterEl);

  const shellRoot = document.createElement("div");
  shellRoot.style.flex = "1";
  shellRoot.style.minHeight = "0";
  wrap.appendChild(shellRoot);

  opts.root.innerHTML = "";
  opts.root.appendChild(wrap);

  let records: Record<string, PlayerInventoryRecord> = {};
  let activePid = opts.selfId;
  let shellRefs: { rerender: (r: PlayerInventoryRecord, cat: CatalogItem[]) => void; destroy: () => void } | null = null;

  const renderTabs = () => {
    tabsEl.innerHTML = "";
    const ids = Object.keys(records).sort((a, b) => {
      if (a === opts.selfId) return 1;
      if (b === opts.selfId) return -1;
      return records[a].name.localeCompare(records[b].name);
    });
    for (const pid of ids) {
      const t = document.createElement("button");
      t.className = "tab" + (pid === activePid ? " active" : "");
      t.style.borderLeftColor = records[pid].color;
      t.textContent = records[pid].name + (pid === opts.selfId ? " (GM)" : "");
      t.onclick = () => { activePid = pid; renderAll(); };
      tabsEl.appendChild(t);
    }
    const dl = document.createElement("button");
    dl.className = "tab-download";
    dl.textContent = "⤓";
    dl.title = "Download backup JSON";
    dl.onclick = async () => {
      const exp = await buildExport(opts.catalog, opts.catalogUrl);
      downloadExport(exp);
    };
    tabsEl.appendChild(dl);
  };

  const renderMeter = async () => {
    const bytes = await inventoryByteSize();
    const ratio = bytes / STORAGE_CAP_BYTES;
    const fill = meterEl.querySelector(".meter-fill") as HTMLElement;
    const text = meterEl.querySelector(".meter-text") as HTMLElement;
    fill.style.width = `${Math.min(100, ratio * 100).toFixed(1)}%`;
    fill.dataset.state = ratio >= METER_RED_RATIO ? "red"
      : ratio >= METER_YELLOW_RATIO ? "yellow" : "green";
    text.textContent = `${(bytes / 1024).toFixed(1)} KB / ${(STORAGE_CAP_BYTES / 1024).toFixed(0)} KB`;
  };

  const renderShell = () => {
    const rec = records[activePid];
    if (!rec) return;
    if (shellRefs) shellRefs.destroy();
    shellRefs = mountShell(shellRoot, rec, opts.catalog, {
      onIncrement: async (id) => {
        try { await writeRecord(activePid, incrementItem(rec, id)); }
        catch (e) { gmHandleErr(e); shellRefs?.rerender(rec, opts.catalog); }
      },
      onDecrement: async (id) => {
        try { await writeRecord(activePid, decrementItem(rec, id)); }
        catch (e) { gmHandleErr(e); shellRefs?.rerender(rec, opts.catalog); }
      },
      onRemove: async (id) => {
        try { await writeRecord(activePid, removeItem(rec, id)); }
        catch (e) { gmHandleErr(e); shellRefs?.rerender(rec, opts.catalog); }
      },
      onCurrencyChange: async (f, v) => {
        const u = { ...rec, currency: { ...rec.currency, [f]: v } };
        try { await writeRecord(activePid, u); }
        catch (e) { gmHandleErr(e); shellRefs?.rerender(rec, opts.catalog); }
      },
      onAddClick: () => {
        openAddDialog({
          catalog: opts.catalog,
          onAdd: async (id, qty) => {
            try {
              await writeRecord(activePid, addItem(rec, id, qty));
              closeAddDialog();
            } catch (e) { gmHandleErr(e); }
          },
        });
      },
      onDescription: (id, anchor) => showDescription(anchor, byId.get(id) ?? null, id),
      onTransfer: async (id, anchor) => {
        const all = await listInventoryRecords();
        const targets = buildTargets(activePid, all, opts.selfId);
        const ci = byId.get(id);
        const entry = rec.items.find(([eid]) => eid === id);
        if (!entry || entry[1] <= 0) return;
        showTransfer({
          anchor, itemId: id,
          itemName: ci?.name ?? id, itemIcon: ci?.icon,
          maxQty: entry[1], targets,
          onConfirm: async (toPlayerId, qty) => {
            try {
              await transferItem({
                fromPlayerId: activePid, toPlayerId,
                itemId: id, itemName: ci?.name ?? id, qty,
              });
            } catch (e) { gmHandleErr(e); }
          },
        });
      },
    });
  };

  const renderAll = () => {
    renderTabs();
    void renderMeter();
    renderShell();
  };

  const gmHandleErr = (e: unknown) => {
    if (e instanceof OverCapError) {
      showOverCapModal({
        triggeringPlayerName: records[activePid]?.name ?? activePid,
        attempted: e.attempted,
        currentBytes: e.currentBytes,
        cap: e.cap,
      });
      return;
    }
    throw e;
  };

  const unsubMeta = onRoomMetadataChange((next) => {
    records = next;
    if (!records[activePid]) activePid = opts.selfId;
    renderAll();
  });

  const unsubBroadcast = OBR.broadcast.onMessage(
    BROADCAST_CHANNEL, (ev) => {
      const msg = ev.data as BroadcastMessage;
      if (msg.type === "over-cap") {
        showOverCapModal({
          triggeringPlayerName: msg.triggeringPlayerName,
          attempted: msg.attempted,
          currentBytes: msg.currentBytes,
          cap: msg.cap,
        });
      }
    },
  );

  // main.ts already calls ensureRecord(selfId, ...) before mounting,
  // so the GM's tab is guaranteed to exist by the time we read here.
  void (async () => {
    records = await listInventoryRecords();
    renderAll();
  })();

  return () => { unsubMeta(); unsubBroadcast(); shellRefs?.destroy(); };
}

function showOverCapModal(args: {
  triggeringPlayerName: string;
  attempted: string;
  currentBytes: number;
  cap: number;
}) {
  const back = document.createElement("div");
  back.className = "modal-backdrop";
  const m = document.createElement("div");
  m.className = "modal";
  m.innerHTML = `
    <h3>Inventory storage full</h3>
    <p><strong>${escapeHtml(args.triggeringPlayerName)}</strong> tried: ${escapeHtml(args.attempted)}</p>
    <p>Current usage: ${(args.currentBytes/1024).toFixed(2)} KB of ${(args.cap/1024).toFixed(0)} KB</p>
    <button class="ok-btn">Got it</button>
  `;
  back.appendChild(m);
  document.body.appendChild(back);
  (m.querySelector(".ok-btn") as HTMLButtonElement).onclick = () => back.remove();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

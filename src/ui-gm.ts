import OBR from "@owlbear-rodeo/sdk";
import { mountShell } from "./ui-shell";
import { showDescription } from "./ui-description";
import { showTransfer, buildTargets } from "./ui-transfer";
import { openAddDialog, closeAddDialog } from "./ui-add-dialog";
import { openCustomsDialog } from "./ui-customs-dialog";
import { openCustomsPanel, reloadCustomsPanel } from "./ui-customs-panel";
import {
  listInventoryRecords, onCustomsChange, onRoomMetadataChange,
  roomDataByteSize, writeCustoms, writeRecord,
} from "./metadata";
import {
  addItem, incrementItem, decrementItem, removeItem,
} from "./inventory";
import { addCustom } from "./customs";
import { transferItem } from "./transfer";
import { buildExport, downloadExport } from "./export";
import { resolvedCatalog } from "./catalog";
import { escapeHtml } from "./escape";
import {
  BROADCAST_CHANNEL, STORAGE_CAP_BYTES,
  METER_YELLOW_RATIO, METER_RED_RATIO,
} from "./constants";
import { OverCapError } from "./types";
import type {
  CatalogItem, CustomItemsRecord, PlayerInventoryRecord, BroadcastMessage,
} from "./types";

export interface GmViewOpts {
  root: HTMLElement;
  catalog: CatalogItem[];
  catalogUrl: string;
  /** Customs already loaded by main.ts (post-reconciliation). The view
   *  subscribes to onCustomsChange for further updates. */
  initialCustoms: CustomItemsRecord;
  selfId: string;
  selfName: string;
  selfColor: string;
}

export function mountGmView(opts: GmViewOpts): () => void {
  let customs: CustomItemsRecord = opts.initialCustoms;
  let merged = resolvedCatalog(opts.catalog, customs);
  let byId = new Map(merged.map((c) => [c.id, c]));

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
  let mountedShellPid: string | null = null;

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
    const customsBtn = document.createElement("button");
    customsBtn.className = "tab-customs";
    customsBtn.textContent = "✱";
    customsBtn.title = "Manage custom items";
    customsBtn.onclick = () => {
      openCustomsPanel({
        catalog: opts.catalog,
        initialCustoms: customs,
        records,
        onError: gmHandleErr,
      });
    };
    tabsEl.appendChild(customsBtn);

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
    const bytes = await roomDataByteSize();
    const ratio = bytes / STORAGE_CAP_BYTES;
    const fill = meterEl.querySelector(".meter-fill") as HTMLElement;
    const text = meterEl.querySelector(".meter-text") as HTMLElement;
    fill.style.width = `${Math.min(100, ratio * 100).toFixed(1)}%`;
    fill.dataset.state = ratio >= METER_RED_RATIO ? "red"
      : ratio >= METER_YELLOW_RATIO ? "yellow" : "green";
    text.textContent = `${(bytes / 1024).toFixed(1)} KB / ${(STORAGE_CAP_BYTES / 1024).toFixed(0)} KB`;
  };

  const openCreateItem = (prefillName?: string): void => {
    openCustomsDialog({
      resolved: merged,
      prefillName,
      onSave: async (item) => {
        const next = addCustom(customs, item);
        await writeCustoms(next);
        // Local state will refresh via onCustomsChange, but pre-update
        // so the next render after Save reflects it immediately.
        customs = next;
        merged = resolvedCatalog(opts.catalog, customs);
        byId = new Map(merged.map((c) => [c.id, c]));
      },
    });
  };

  const openTransferFor = async (
    id: string, anchor: { x: number; y: number },
  ) => {
    const r = records[activePid];
    if (!r) return;
    const all = await listInventoryRecords();
    const targets = buildTargets(activePid, all, opts.selfId);
    const ci = byId.get(id);
    const entry = r.items.find(([eid]) => eid === id);
    showTransfer({
      anchor,
      itemId: id,
      itemName: ci?.name ?? id,
      itemIcon: ci?.icon,
      maxQty: entry?.[1] ?? 0,
      targets,
      onConfirm: async (toPlayerId, qty) => {
        try {
          await transferItem({
            fromPlayerId: activePid, toPlayerId,
            itemId: id, itemName: ci?.name ?? id, qty,
          });
        } catch (e) { gmHandleErr(e); }
      },
    });
  };

  const renderShell = () => {
    const rec = records[activePid];
    if (!rec) return;
    // Same tab still active → just update content. This preserves the
    // shell's transient UI state (lock toggle, search text, collapsed
    // categories) across metadata changes. Different tab → full remount.
    if (shellRefs && mountedShellPid === activePid) {
      shellRefs.rerender(rec, merged);
      return;
    }
    if (shellRefs) shellRefs.destroy();
    mountedShellPid = activePid;
    shellRefs = mountShell(shellRoot, rec, merged, {
      onIncrement: async (id) => {
        const r = records[activePid]; if (!r) return;
        try { await writeRecord(activePid, incrementItem(r, id)); }
        catch (e) { gmHandleErr(e); shellRefs?.rerender(r, merged); }
      },
      onDecrement: async (id) => {
        const r = records[activePid]; if (!r) return;
        try { await writeRecord(activePid, decrementItem(r, id)); }
        catch (e) { gmHandleErr(e); shellRefs?.rerender(r, merged); }
      },
      onRemove: async (id) => {
        const r = records[activePid]; if (!r) return;
        try { await writeRecord(activePid, removeItem(r, id)); }
        catch (e) { gmHandleErr(e); shellRefs?.rerender(r, merged); }
      },
      onCurrencyChange: async (f, v) => {
        const r = records[activePid]; if (!r) return;
        const u = { ...r, currency: { ...r.currency, [f]: v } };
        try { await writeRecord(activePid, u); }
        catch (e) { gmHandleErr(e); shellRefs?.rerender(r, merged); }
      },
      onAddClick: () => {
        openAddDialog({
          catalog: merged,
          onAdd: async (id, qty) => {
            const r = records[activePid]; if (!r) return;
            try {
              await writeRecord(activePid, addItem(r, id, qty));
              closeAddDialog();
            } catch (e) { gmHandleErr(e); }
          },
          onCreateCustom: (prefill) => {
            // Close the add-dialog so the customs dialog has full focus;
            // the GM can re-open the add-dialog after creating to add it.
            closeAddDialog();
            openCreateItem(prefill);
          },
        });
      },
      onCreateCustomClick: () => openCreateItem(),
      onDescription: (id, anchor) => {
        showDescription(anchor, byId.get(id) ?? null, id, {
          onTransfer: () => { void openTransferFor(id, anchor); },
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
    // The customs panel's reference counts depend on inventory records;
    // refresh it so deletes still surface accurate "in N inventories" text.
    reloadCustomsPanel();
  });

  const unsubCustoms = onCustomsChange((next) => {
    customs = next;
    merged = resolvedCatalog(opts.catalog, customs);
    byId = new Map(merged.map((c) => [c.id, c]));
    renderAll();
    reloadCustomsPanel();
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

  return () => {
    unsubMeta(); unsubCustoms(); unsubBroadcast(); shellRefs?.destroy();
  };
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


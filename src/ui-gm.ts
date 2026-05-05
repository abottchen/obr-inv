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
import { totalWeight } from "./inventory";
import { mountIconSprite, icon as svgIcon } from "./ui-icons";
import { withOverlay } from "./ui-mutate";
import { openMergeDialog } from "./ui-merge";
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

  mountIconSprite();

  // GM layout: a 200px vertical player rail on the left, the active player's
  // shell on the right. The rail hosts head + list + footer (meter + actions),
  // and replaces the legacy top tab strip. Storage meter and Customs/Export
  // buttons live in the rail footer instead of separate strips above the
  // shell, freeing vertical real estate for inventory content.
  const wrap = document.createElement("div");
  wrap.className = "gm-wrap";

  const rail = document.createElement("aside");
  rail.className = "player-rail";

  const railHead = document.createElement("div");
  railHead.className = "rail-head";
  const railTitle = document.createElement("p");
  railTitle.className = "rail-title font-display";
  railTitle.textContent = "Party Records";
  const railSub = document.createElement("p");
  railSub.className = "rail-sub";
  railHead.appendChild(railTitle);
  railHead.appendChild(railSub);
  rail.appendChild(railHead);

  const railList = document.createElement("div");
  railList.className = "rail-list";
  rail.appendChild(railList);

  const railFoot = document.createElement("div");
  railFoot.className = "rail-foot";
  // Meter — Vault label, byte usage, and a thin gilt fill bar that switches
  // colour through warn/bad as the cap fills.
  const meterEl = document.createElement("div");
  meterEl.className = "rail-meter";
  meterEl.innerHTML = `
    <div class="meter-row"><span>Vault</span><span class="meter-text"></span></div>
    <div class="meter-bar"><div class="meter-fill"></div></div>
  `;
  railFoot.appendChild(meterEl);

  const railActions = document.createElement("div");
  railActions.className = "rail-actions";
  const customsBtn = document.createElement("button");
  customsBtn.className = "rail-action";
  customsBtn.title = "Manage custom items";
  customsBtn.appendChild(svgIcon("i-star"));
  customsBtn.appendChild(document.createTextNode("Customs"));
  const mergeBtn = document.createElement("button");
  mergeBtn.className = "rail-action";
  mergeBtn.title = "Merge two player records";
  mergeBtn.appendChild(svgIcon("i-merge"));
  mergeBtn.appendChild(document.createTextNode("Merge"));
  const dlBtn = document.createElement("button");
  dlBtn.className = "rail-action";
  dlBtn.title = "Download backup JSON";
  dlBtn.appendChild(svgIcon("i-download"));
  dlBtn.appendChild(document.createTextNode("Export"));
  railActions.appendChild(customsBtn);
  railActions.appendChild(mergeBtn);
  railActions.appendChild(dlBtn);
  railFoot.appendChild(railActions);
  rail.appendChild(railFoot);

  wrap.appendChild(rail);

  const shellRoot = document.createElement("div");
  shellRoot.className = "gm-shell-host";
  wrap.appendChild(shellRoot);

  opts.root.innerHTML = "";
  opts.root.appendChild(wrap);


  let records: Record<string, PlayerInventoryRecord> = {};
  let activePid = opts.selfId;
  let shellRefs: { rerender: (r: PlayerInventoryRecord, cat: CatalogItem[]) => void; destroy: () => void } | null = null;
  let mountedShellPid: string | null = null;

  // Render the player rail: one .rail-item per inventory record, plus
  // a subtle subtitle reporting fellowship size. Sorting puts the GM
  // last (matches the original tab strip's intent), other players A→Z.
  const renderTabs = () => {
    railList.innerHTML = "";
    const ids = Object.keys(records).sort((a, b) => {
      if (a === opts.selfId) return 1;
      if (b === opts.selfId) return -1;
      return records[a].name.localeCompare(records[b].name);
    });
    railSub.textContent = `${ids.length} in fellowship`;
    for (const pid of ids) {
      const r = records[pid];
      const itemCount = r.items.reduce((acc, [, n]) => acc + (n > 0 ? 1 : 0), 0);
      const w = totalWeight(r.items, opts.catalog);
      const isSelf = pid === opts.selfId;
      const initial = (r.name?.[0] ?? "?").toUpperCase();

      const t = document.createElement("button");
      t.className = "rail-item" + (pid === activePid ? " active" : "");
      t.title = isSelf ? `${r.name} (GM)` : r.name;

      const pip = document.createElement("span");
      pip.className = "rail-pip";
      pip.style.color = r.color;
      pip.textContent = initial;
      t.appendChild(pip);

      const who = document.createElement("span");
      who.className = "rail-who";
      const name = document.createElement("span");
      name.className = "rail-name";
      name.textContent = isSelf ? `${r.name} (GM)` : r.name;
      const stats = document.createElement("span");
      stats.className = "rail-stats font-mono";
      stats.textContent = `${itemCount} items · ${formatRailWeight(w)} lb`;
      who.appendChild(name);
      who.appendChild(stats);
      t.appendChild(who);

      t.onclick = () => { activePid = pid; renderAll(); };
      railList.appendChild(t);
    }
  };

  // Customs / Export buttons in the rail footer — bound once on mount,
  // not per render, since they don't depend on records.
  customsBtn.onclick = () => {
    openCustomsPanel({
      catalog: opts.catalog,
      initialCustoms: customs,
      records,
      onError: gmHandleErr,
    });
  };
  mergeBtn.onclick = () => {
    openMergeDialog({
      records,
      selfId: opts.selfId,
      onError: gmHandleErr,
    });
  };
  dlBtn.onclick = async () => {
    const exp = await buildExport(opts.catalog, opts.catalogUrl);
    downloadExport(exp);
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
        const result = await withOverlay(`Saving custom item "${item.name}"…`, records, (wopts) =>
          writeCustoms(() => ({ w: "", items: next }), wopts),
        );
        if (result === null) return;
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
        const recipientName = all[toPlayerId]?.name ?? "player";
        const itemName = ci?.name ?? id;
        await withOverlay(
          `Transferring ${qty}× ${itemName} to ${recipientName}…`, all, (wopts) =>
            transferItem({ fromPlayerId: activePid, toPlayerId, itemId: id, itemName, qty }, wopts),
        ).catch(gmHandleErr);
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
        await withOverlay(`Updating ${byId.get(id)?.name ?? id}…`, records, (wopts) =>
          writeRecord(activePid, () => incrementItem(r, id), wopts),
        ).catch(gmHandleErr);
      },
      onDecrement: async (id) => {
        const r = records[activePid]; if (!r) return;
        await withOverlay(`Updating ${byId.get(id)?.name ?? id}…`, records, (wopts) =>
          writeRecord(activePid, () => decrementItem(r, id), wopts),
        ).catch(gmHandleErr);
      },
      onRemove: async (id) => {
        const r = records[activePid]; if (!r) return;
        await withOverlay(`Removing ${byId.get(id)?.name ?? id}…`, records, (wopts) =>
          writeRecord(activePid, () => removeItem(r, id), wopts),
        ).catch(gmHandleErr);
      },
      onCurrencyChange: async (f, v) => {
        const r = records[activePid]; if (!r) return;
        await withOverlay("Saving currency…", records, (wopts) =>
          writeRecord(activePid, () => ({ ...r, currency: { ...r.currency, [f]: v } }), wopts),
        ).catch(gmHandleErr);
      },
      onAddClick: () => {
        openAddDialog({
          catalog: merged,
          onAdd: async (id, qty) => {
            const r = records[activePid]; if (!r) return;
            const result = await withOverlay(`Adding ${byId.get(id)?.name ?? id}…`, records, (wopts) =>
              writeRecord(activePid, () => addItem(r, id, qty), wopts),
            ).catch((e) => { gmHandleErr(e); return null; });
            if (result !== null) closeAddDialog();
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
      onDescription: (id, anchor, ctx) => {
        showDescription(anchor, byId.get(id) ?? null, id, {
          onTransfer: () => { void openTransferFor(id, anchor); },
          editControls: {
            count: ctx.count,
            onIncrement: ctx.onIncrement,
            onDecrement: ctx.onDecrement,
            onRemove:    ctx.onRemove,
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
        return;
      }
      if (msg.type === "transfer-received") {
        // Sender doesn't get a self-echo. (The GM's own player record
        // can be the sender when they're acting from their own tab.)
        if (msg.fromPlayerId === opts.selfId) return;
        const text = msg.toPlayerId === opts.selfId
          ? `${msg.fromName} gave you ${msg.quantity}× ${msg.itemName}`
          : `${msg.fromName} just transferred ${msg.quantity}× ${msg.itemName} to ${msg.toName}`;
        OBR.notification?.show?.(text, "INFO")
          ?.catch?.(() => console.warn("notification.show unavailable"));
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

/** Tighter weight format for the rail's per-player stats line. */
function formatRailWeight(w: number): string {
  if (w === 0) return "0";
  if (Number.isInteger(w)) return String(w);
  return w.toFixed(1);
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


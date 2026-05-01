import OBR from "@owlbear-rodeo/sdk";
import { mountShell } from "./ui-shell";
import { showDescription } from "./ui-description";
import { showTransfer, buildTargets } from "./ui-transfer";
import { openAddDialog, closeAddDialog } from "./ui-add-dialog";
import {
  writeRecord, listInventoryRecords, onRoomMetadataChange,
} from "./metadata";
import {
  addItem, incrementItem, decrementItem, removeItem,
} from "./inventory";
import { transferItem } from "./transfer";
import { BROADCAST_CHANNEL } from "./constants";
import type {
  CatalogItem, PlayerInventoryRecord, BroadcastMessage,
} from "./types";
import { OverCapError } from "./types";

export interface PlayerViewOpts {
  root: HTMLElement;
  catalog: CatalogItem[];
  playerId: string;
  initialRecord: PlayerInventoryRecord;
}

export function mountPlayerView(opts: PlayerViewOpts): () => void {
  const byId = new Map(opts.catalog.map((c) => [c.id, c]));
  let current = opts.initialRecord;

  const refs = mountShell(opts.root, current, opts.catalog, {
    onIncrement: async (id) => {
      try { await writeRecord(opts.playerId, incrementItem(current, id)); }
      catch (e) { revertOptimistic(); rethrowIfNotCap(e); }
    },
    onDecrement: async (id) => {
      try { await writeRecord(opts.playerId, decrementItem(current, id)); }
      catch (e) { revertOptimistic(); rethrowIfNotCap(e); }
    },
    onRemove: async (id) => {
      try { await writeRecord(opts.playerId, removeItem(current, id)); }
      catch (e) { revertOptimistic(); rethrowIfNotCap(e); }
    },
    onCurrencyChange: async (f, v) => {
      const updated: PlayerInventoryRecord = {
        ...current, currency: { ...current.currency, [f]: v },
      };
      try { await writeRecord(opts.playerId, updated); }
      catch (e) { revertOptimistic(); rethrowIfNotCap(e); }
    },
    onAddClick: () => {
      openAddDialog({
        catalog: opts.catalog,
        onAdd: async (id, qty) => {
          try {
            await writeRecord(opts.playerId, addItem(current, id, qty));
            closeAddDialog();
          } catch (e) {
            rethrowIfNotCap(e);
          }
        },
      });
    },
    onDescription: (id, anchor) => {
      showDescription(anchor, byId.get(id) ?? null, id);
    },
    onTransfer: async (id, anchor) => {
      const all = await listInventoryRecords();
      const targets = buildTargets(opts.playerId, all);
      const ci = byId.get(id);
      const entry = current.items.find(([eid]) => eid === id);
      if (!entry || entry[1] <= 0) return;
      showTransfer({
        anchor,
        itemId: id,
        itemName: ci?.name ?? id,
        itemIcon: ci?.icon,
        maxQty: entry[1],
        targets,
        onConfirm: async (toPlayerId, qty) => {
          try {
            await transferItem({
              fromPlayerId: opts.playerId,
              toPlayerId,
              itemId: id,
              itemName: ci?.name ?? id,
              qty,
            });
          } catch (e) { rethrowIfNotCap(e); }
        },
      });
    },
  });

  const unsubMeta = onRoomMetadataChange((records) => {
    const me = records[opts.playerId];
    if (!me) return;
    current = me;
    refs.rerender(current, opts.catalog);
  });

  const unsubBroadcast = OBR.broadcast.onMessage(
    BROADCAST_CHANNEL, (ev) => {
      const msg = ev.data as BroadcastMessage;
      if (msg.type === "transfer-received" && msg.toPlayerId === opts.playerId) {
        OBR.notification?.show?.(
          `${msg.fromName} gave you ${msg.quantity}× ${msg.itemName}`,
          "INFO",
        )?.catch?.(() => console.warn("notification.show unavailable"));
      }
    },
  );

  function revertOptimistic() {
    refs.rerender(current, opts.catalog);
  }
  function rethrowIfNotCap(e: unknown) {
    if (!(e instanceof OverCapError)) throw e;
  }

  return () => { unsubMeta(); unsubBroadcast(); refs.destroy(); };
}

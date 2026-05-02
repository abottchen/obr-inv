import OBR from "@owlbear-rodeo/sdk";
import { mountShell } from "./ui-shell";
import { showDescription } from "./ui-description";
import { showTransfer, buildTargets } from "./ui-transfer";
import { openAddDialog, closeAddDialog } from "./ui-add-dialog";
import {
  writeRecord, listInventoryRecords, onCustomsChange, onRoomMetadataChange,
} from "./metadata";
import {
  addItem, incrementItem, decrementItem, removeItem,
} from "./inventory";
import { transferItem } from "./transfer";
import { resolvedCatalog } from "./catalog";
import { BROADCAST_CHANNEL } from "./constants";
import type {
  CatalogItem, CustomItemsRecord, PlayerInventoryRecord, BroadcastMessage,
} from "./types";
import { OverCapError } from "./types";

export interface PlayerViewOpts {
  root: HTMLElement;
  catalog: CatalogItem[];
  initialCustoms: CustomItemsRecord;
  playerId: string;
  initialRecord: PlayerInventoryRecord;
}

export function mountPlayerView(opts: PlayerViewOpts): () => void {
  let customs = opts.initialCustoms;
  let merged = resolvedCatalog(opts.catalog, customs);
  let byId = new Map(merged.map((c) => [c.id, c]));
  let current = opts.initialRecord;

  const openTransferFor = async (
    id: string, anchor: { x: number; y: number },
  ) => {
    const all = await listInventoryRecords();
    const targets = buildTargets(opts.playerId, all);
    const ci = byId.get(id);
    const entry = current.items.find(([eid]) => eid === id);
    showTransfer({
      anchor,
      itemId: id,
      itemName: ci?.name ?? id,
      itemIcon: ci?.icon,
      maxQty: entry?.[1] ?? 0, // showTransfer notifies on 0
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
  };

  const refs = mountShell(opts.root, current, merged, {
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
        catalog: merged,
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

  const unsubMeta = onRoomMetadataChange((records) => {
    const me = records[opts.playerId];
    if (!me) return;
    current = me;
    refs.rerender(current, merged);
  });

  const unsubCustoms = onCustomsChange((next) => {
    customs = next;
    merged = resolvedCatalog(opts.catalog, customs);
    byId = new Map(merged.map((c) => [c.id, c]));
    refs.rerender(current, merged);
  });

  const unsubBroadcast = OBR.broadcast.onMessage(
    BROADCAST_CHANNEL, (ev) => {
      const msg = ev.data as BroadcastMessage;
      if (msg.type !== "transfer-received") return;
      // Sender already knows; don't echo their own action back at them.
      if (msg.fromPlayerId === opts.playerId) return;

      if (msg.toPlayerId === opts.playerId) {
        refs.markReceived(msg.itemId, msg.quantity);
        // The metadata change that follows will diff to "inc"; precedence keeps "received".
        // Kick a render in case the broadcast outpaces the metadata event.
        refs.rerender(current, merged);
        OBR.notification?.show?.(
          `${msg.fromName} gave you ${msg.quantity}× ${msg.itemName}`,
          "INFO",
        )?.catch?.(() => console.warn("notification.show unavailable"));
      } else {
        OBR.notification?.show?.(
          `${msg.fromName} just transferred ${msg.quantity}× ${msg.itemName} to ${msg.toName}`,
          "INFO",
        )?.catch?.(() => console.warn("notification.show unavailable"));
      }
    },
  );

  function revertOptimistic() {
    refs.rerender(current, merged);
  }
  function rethrowIfNotCap(e: unknown) {
    if (!(e instanceof OverCapError)) throw e;
  }

  return () => { unsubMeta(); unsubCustoms(); unsubBroadcast(); refs.destroy(); };
}

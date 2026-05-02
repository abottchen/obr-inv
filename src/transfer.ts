import OBR from "@owlbear-rodeo/sdk";
import { BROADCAST_CHANNEL } from "./constants";
import { applyTransfer } from "./inventory";
import {
  getRecord, writeRecord,
} from "./metadata";
import {
  OverCapError,
} from "./types";
import type {
  OverCapMessage, TransferReceivedMessage,
} from "./types";

interface TransferRequest {
  fromPlayerId: string;
  toPlayerId: string;
  itemId: string;
  itemName: string;
  qty: number;
}

export async function transferItem(req: TransferRequest): Promise<void> {
  const sender = await getRecord(req.fromPlayerId);
  const recipient = await getRecord(req.toPlayerId);
  if (!sender) throw new Error(`Sender ${req.fromPlayerId} has no inventory record`);
  if (!recipient) throw new Error(`Recipient ${req.toPlayerId} has no inventory record`);

  const [newSender, newRecipient] = applyTransfer(
    sender, recipient, req.itemId, req.qty,
  );

  try {
    await writeRecord(req.toPlayerId, newRecipient);
  } catch (err) {
    if (err instanceof OverCapError) {
      const msg: OverCapMessage = {
        type: "over-cap",
        triggeringPlayerId: req.fromPlayerId,
        triggeringPlayerName: sender.name,
        attempted: `transfer ${req.qty}× ${req.itemName} to ${recipient.name}`,
        currentBytes: err.currentBytes,
        cap: err.cap,
      };
      // Broadcast to all clients; GM listeners filter by role.
      await OBR.broadcast.sendMessage(BROADCAST_CHANNEL, msg, { destination: "ALL" });
    }
    throw err;
  }

  try {
    await writeRecord(req.fromPlayerId, newSender);
  } catch (err) {
    // Sender write failed *after* recipient was already credited.
    // Re-read recipient (could have changed concurrently) and back out
    // the qty we just added; if that fails, surface a loud error so
    // operators can reconcile manually rather than silently double-crediting.
    try {
      const fresh = await getRecord(req.toPlayerId);
      if (fresh) {
        const reverted = {
          ...fresh,
          items: fresh.items
            .map(([id, c]) =>
              id === req.itemId ? ([id, c - req.qty] as [string, number]) : ([id, c] as [string, number]),
            )
            .filter(([, c]) => c > 0),
        };
        await writeRecord(req.toPlayerId, reverted);
      }
    } catch (rollbackErr) {
      console.error("[transfer] rollback failed; recipient may be double-credited", {
        req, rollbackErr,
      });
    }
    throw err;
  }

  const note: TransferReceivedMessage = {
    type: "transfer-received",
    fromName: sender.name,
    toPlayerId: req.toPlayerId,
    itemId: req.itemId,
    itemName: req.itemName,
    quantity: req.qty,
  };
  // Broadcast to all clients; recipient listener filters by toPlayerId.
  await OBR.broadcast.sendMessage(BROADCAST_CHANNEL, note, { destination: "ALL" });
}

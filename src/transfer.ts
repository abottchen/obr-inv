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

async function gmPlayerIds(): Promise<string[]> {
  const players = await OBR.party.getPlayers();
  return players.filter((p) => p.role === "GM").map((p) => p.id);
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
      const targets = await gmPlayerIds();
      await OBR.broadcast.sendMessage(BROADCAST_CHANNEL, msg, { destination: targets });
    }
    throw err;
  }

  try {
    await writeRecord(req.fromPlayerId, newSender);
  } catch (err) {
    await writeRecord(req.toPlayerId, recipient).catch(() => {});
    throw err;
  }

  const note: TransferReceivedMessage = {
    type: "transfer-received",
    fromName: sender.name,
    toPlayerId: req.toPlayerId,
    itemName: req.itemName,
    quantity: req.qty,
  };
  await OBR.broadcast.sendMessage(BROADCAST_CHANNEL, note, {
    destination: [req.toPlayerId],
  });
}

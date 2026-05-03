import OBR from "@owlbear-rodeo/sdk";
import { BROADCAST_CHANNEL } from "./constants";
import { atomicMultiUpdate, type AtomicUpdateOptions, type Mutator } from "./atomic";
import { applyTransferIn, applyTransferOut } from "./inventory";
import { getRecord, recordKey } from "./metadata";
import { OverCapError } from "./types";
import type { OverCapMessage, PlayerInventoryRecord, TransferReceivedMessage, WriterStamp } from "./types";

interface TransferRequest {
  fromPlayerId: string;
  toPlayerId: string;
  itemId: string;
  itemName: string;
  qty: number;
}

export async function transferItem(
  req: TransferRequest,
  opts: AtomicUpdateOptions,
): Promise<void> {
  // Read names up-front for the broadcast notification — this read isn't
  // load-bearing for the transfer itself; the mutators below re-read fresh
  // state each attempt.
  const sender = await getRecord(req.fromPlayerId);
  const recipient = await getRecord(req.toPlayerId);
  if (!sender) throw new Error(`Sender ${req.fromPlayerId} has no inventory record`);
  if (!recipient) throw new Error(`Recipient ${req.toPlayerId} has no inventory record`);

  const outMutator: Mutator<PlayerInventoryRecord> = (current) => {
    if (!current) throw new Error(`Sender ${req.fromPlayerId} has no inventory record`);
    return applyTransferOut(current, req.itemId, req.qty);
  };
  const inMutator: Mutator<PlayerInventoryRecord> = (current) => {
    if (!current) throw new Error(`Recipient ${req.toPlayerId} has no inventory record`);
    return applyTransferIn(current, req.itemId, req.qty);
  };

  try {
    await atomicMultiUpdate([
      { key: recordKey(req.fromPlayerId), mutate: outMutator as unknown as Mutator<WriterStamp> },
      { key: recordKey(req.toPlayerId), mutate: inMutator as unknown as Mutator<WriterStamp> },
    ], opts);
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
      await OBR.broadcast.sendMessage(BROADCAST_CHANNEL, msg, { destination: "ALL" });
    }
    throw err;
  }

  const note: TransferReceivedMessage = {
    type: "transfer-received",
    fromPlayerId: req.fromPlayerId,
    fromName: sender.name,
    toPlayerId: req.toPlayerId,
    toName: recipient.name,
    itemId: req.itemId,
    itemName: req.itemName,
    quantity: req.qty,
  };
  await OBR.broadcast.sendMessage(BROADCAST_CHANNEL, note, { destination: "ALL" });
}

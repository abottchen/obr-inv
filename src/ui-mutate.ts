import OBR from "@owlbear-rodeo/sdk";
import { showOverlay, closeOverlay, setOverlayDescription, setOverlayState } from "./ui-overlay";
import { parseWriter } from "./atomic";
import { ConflictError, AbortError } from "./types";
import type { PlayerInventoryRecord } from "./types";

export async function withOverlay<T>(
  description: string,
  records: Record<string, PlayerInventoryRecord>,
  run: (opts: {
    signal: AbortSignal;
    description: string;
    onConflict: (info: { blockerWriter: string; attempt: number }) => void;
  }) => Promise<T>,
): Promise<T | null> {
  const ac = new AbortController();
  showOverlay({ description, onCancel: () => { setOverlayState("cancelling"); ac.abort(); } });
  try {
    const result = await run({
      signal: ac.signal,
      description,
      onConflict: ({ blockerWriter }) => {
        const { playerId } = parseWriter(blockerWriter);
        if (playerId === OBR.player.id) {
          setOverlayDescription("Waiting on your other session…");
        } else {
          const name = playerId ? records[playerId]?.name : null;
          setOverlayDescription(name
            ? `Waiting on update from ${name}…`
            : "Update conflict — retrying…");
        }
      },
    });
    closeOverlay();
    return result;
  } catch (err) {
    closeOverlay();
    if (err instanceof AbortError) {
      OBR.notification?.show?.("Cancelled", "INFO")?.catch?.(() => {});
      return null;
    }
    if (err instanceof ConflictError) {
      const { playerId } = parseWriter(err.lastBlockerWriter ?? "");
      const name = playerId ? records[playerId]?.name : null;
      const msg = name
        ? `Couldn't apply your change — kept conflicting with ${name}'s updates. Please try again.`
        : "Update conflict — please try again.";
      OBR.notification?.show?.(msg, "ERROR")?.catch?.(() => {});
      return null;
    }
    throw err;
  }
}

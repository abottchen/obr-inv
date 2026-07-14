import OBR from "@owlbear-rodeo/sdk";
import { AUTO_HEAL_NAME } from "./constants";
import { listInventoryRecords, ensureRecord } from "./metadata";
import { executeMerge } from "./merge";
import type { PlayerInventoryRecord } from "./types";

const norm = (s: string): string => s.trim().toLowerCase();

function hasContent(rec: PlayerInventoryRecord): boolean {
  const items = rec.items.some(([, n]) => n > 0);
  const c = rec.currency;
  return items || c.pp > 0 || c.gp > 0 || c.sp > 0 || c.cp > 0;
}

export interface HealPlan {
  targetId: string;
  sourceIds: string[];
}

/**
 * Given the target display name, the connected player's live id, and all
 * inventory records, decide which stale records to consolidate onto the live
 * id. Pure — no OBR. Returns null when there is nothing worth doing.
 */
export function planHeal(
  name: string,
  liveId: string,
  records: Record<string, PlayerInventoryRecord>,
): HealPlan | null {
  const target = norm(name);
  const candidates = Object.keys(records).filter(
    (id) => norm(records[id].name) === target,
  );
  const sourceIds = candidates.filter((id) => id !== liveId);
  if (sourceIds.length === 0) return null;
  const liveHasRecord = candidates.includes(liveId);
  // No live record and every stray is empty → nothing worth re-keying;
  // avoid churning a write every session for an empty inventory.
  if (!liveHasRecord && sourceIds.every((id) => !hasContent(records[id]))) {
    return null;
  }
  return { targetId: liveId, sourceIds };
}

interface HealablePlayer { id: string; name: string; color: string; }

// Serialize runs so two rapid party changes don't race on the same records.
let inFlight: Promise<void> | null = null;

/**
 * If the auto-heal target player is connected, consolidate any stray records
 * carrying his name onto his live id. GM-client only; background write (no
 * overlay). Safe to call repeatedly — idempotent once consolidated.
 */
export function runHeal(players: HealablePlayer[]): Promise<void> {
  const next = (inFlight ?? Promise.resolve())
    .catch(() => {})
    .then(() => healOnce(players));
  inFlight = next.catch(() => {});
  return next;
}

async function healOnce(players: HealablePlayer[]): Promise<void> {
  const live = players.find((p) => norm(p.name) === norm(AUTO_HEAL_NAME));
  if (!live) return;

  const records = await listInventoryRecords();
  const plan = planHeal(AUTO_HEAL_NAME, live.id, records);
  if (!plan) return;

  if (!records[live.id]) {
    await ensureRecord(live.id, live.name, live.color);
  }

  let healed = false;
  for (const sourceId of plan.sourceIds) {
    try {
      await executeMerge(plan.targetId, sourceId, {
        description: "auto-heal reconnect",
      });
      healed = true;
    } catch (e) {
      console.warn("[obr-inv] auto-heal merge failed", sourceId, e);
    }
  }

  if (healed) {
    OBR.notification?.show?.(
      `Reunited ${AUTO_HEAL_NAME} with their inventory.`,
      "INFO",
    )?.catch?.(() => console.warn("[obr-inv] notification.show unavailable"));
  }
}

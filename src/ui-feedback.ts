import type { PlayerInventoryRecord } from "./types";

export type PulseKind = "inc" | "dec" | "add" | "remove" | "received";

export interface PulseEntry {
  kind: PulseKind;
  delta?: number;
  startedAt: number;
}

export type PulseMark = Omit<PulseEntry, "startedAt">;

export interface PulseTracker {
  diff(
    prev: PlayerInventoryRecord | null,
    next: PlayerInventoryRecord,
  ): Map<string, PulseMark>;
  mark(marks: Map<string, PulseMark>): void;
  consume(id: string): PulseEntry | null;
}

const DURATIONS: Record<PulseKind, number> = {
  inc: 700,
  dec: 700,
  add: 700,
  remove: 400,
  received: 1500,
};

// Only `received` is special: it must not be downgraded by an `inc` from
// the metadata diff that arrives moments later for the same item. All
// user-initiated kinds are peers — latest mark wins (so dec → remove
// correctly overwrites a still-live dec entry within its 700ms window).
const PRIORITY: Record<PulseKind, number> = {
  remove: 2,
  dec: 2,
  add: 2,
  inc: 2,
  received: 4,
};

export function createPulseTracker(
  now: () => number = Date.now,
): PulseTracker {
  const entries = new Map<string, PulseEntry>();

  return {
    diff(prev, next) {
      const out = new Map<string, PulseMark>();
      if (prev === null) return out;

      const prevMap = new Map(prev.items);
      const nextMap = new Map(next.items);
      const allIds = new Set<string>([...prevMap.keys(), ...nextMap.keys()]);

      // Classify by *presence* in the items array, not by count alone:
      //   - removeItem filters the id out of items entirely → "remove"
      //   - decrementItem clamps at 0 but keeps the id in items → "dec"
      //   - incrementItem on a count-0 ghost → "inc" (the row never went away)
      //   - addItem on a brand-new id → "add"
      for (const id of allIds) {
        const prevHad = prevMap.has(id);
        const nextHas = nextMap.has(id);
        const p = prevMap.get(id) ?? 0;
        const n = nextMap.get(id) ?? 0;

        if (prevHad && !nextHas) {
          out.set(id, { kind: "remove" });
        } else if (!prevHad && nextHas && n > 0) {
          out.set(id, { kind: "add", delta: n });
        } else if (n > p) {
          out.set(id, { kind: "inc", delta: n - p });
        } else if (n < p) {
          out.set(id, { kind: "dec", delta: n - p });
        }
      }
      return out;
    },

    mark(marks) {
      const ts = now();
      for (const [id, m] of marks) {
        const existing = entries.get(id);
        if (existing && existing.startedAt + DURATIONS[existing.kind] > ts) {
          if (PRIORITY[m.kind] < PRIORITY[existing.kind]) continue;
        }
        entries.set(id, { ...m, startedAt: ts });
      }
    },

    consume(id) {
      const entry = entries.get(id);
      if (!entry) return null;
      if (now() - entry.startedAt >= DURATIONS[entry.kind]) {
        entries.delete(id);
        return null;
      }
      return entry;
    },
  };
}

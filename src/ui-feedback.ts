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

const PRIORITY: Record<PulseKind, number> = {
  remove: 1,
  dec: 2,
  add: 3,
  inc: 3,
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

      for (const id of allIds) {
        const p = prevMap.get(id) ?? 0;
        const n = nextMap.get(id) ?? 0;
        if (p === n) continue;
        if (p === 0 && n > 0) {
          out.set(id, { kind: "add", delta: n });
        } else if (n === 0) {
          out.set(id, { kind: "remove" });
        } else if (n > p) {
          out.set(id, { kind: "inc", delta: n - p });
        } else {
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

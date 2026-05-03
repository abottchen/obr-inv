import OBR from "@owlbear-rodeo/sdk";
import { CUSTOMS_KEY, METADATA_KEY_PREFIX } from "./constants";
import type { WriterStamp } from "./types";

const latestWriters = new Map<string, string>();
const waiters = new Set<() => boolean>();
let unsubscribe: (() => void) | null = null;

function ingest(md: Record<string, unknown>): void {
  // OBR fires onMetadataChange on every room metadata change, including
  // OBR's own keys and other extensions'. Filter to keys we own so the
  // tracker doesn't accumulate writer values for keys we never wait on.
  for (const [k, v] of Object.entries(md)) {
    if (k !== CUSTOMS_KEY && !k.startsWith(METADATA_KEY_PREFIX)) continue;
    latestWriters.set(k, (v as WriterStamp | null)?.w ?? "");
  }
  for (const w of [...waiters]) {
    if (w()) waiters.delete(w);
  }
}

export function startEchoTracker(): void {
  if (unsubscribe) return;
  unsubscribe = OBR.room.onMetadataChange(ingest);
}

export function stopEchoTracker(): void {
  unsubscribe?.();
  unsubscribe = null;
  latestWriters.clear();
  waiters.clear();
}

export const __atomicTestHooks = {
  reset(): void { stopEchoTracker(); },
  startTracker(): void { startEchoTracker(); },
};

export function _internal_getLatestWriter(key: string): string | undefined {
  return latestWriters.get(key);
}

export interface AtomicUpdateOptions {
  signal?: AbortSignal;
  description: string;
  onConflict?: (info: { blockerWriter: string; attempt: number }) => void;
}

export type Mutator<T> = (current: T | null) => T | null;

export const ECHO_TIMEOUT_MS = 1000;

function makeWriter(): string {
  return `${OBR.player.id}:${randomNonce()}`;
}

async function waitForEcho(
  keys: string[],
  ourWriter: string,
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Promise<{ ok: true } | { ok: false; blockerWriter: string | null }> {
  const allMatch = () => keys.every((k) => latestWriters.get(k) === ourWriter);
  if (allMatch()) return { ok: true };

  return new Promise((resolve) => {
    let settled = false;
    const predicate = () => {
      if (allMatch()) {
        if (!settled) { settled = true; resolve({ ok: true }); }
        return true;
      }
      return false;
    };
    waiters.add(predicate);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      waiters.delete(predicate);
      const blocker = keys.map((k) => latestWriters.get(k) ?? "")
        .find((w) => w !== ourWriter) ?? null;
      resolve({ ok: false, blockerWriter: blocker });
    }, timeoutMs);
    if (signal) {
      const onAbort = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        waiters.delete(predicate);
        resolve({ ok: false, blockerWriter: null });
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

export async function atomicUpdate<T extends WriterStamp>(
  key: string,
  mutate: Mutator<T>,
  opts: AtomicUpdateOptions,
): Promise<T | null> {
  startEchoTracker();
  const md = await OBR.room.getMetadata();
  const current = (md[key] as T | undefined) ?? null;
  const next = mutate(current);
  const ourWriter = makeWriter();

  if (next === null) {
    await OBR.room.setMetadata({ [key]: undefined });
    return null;
  }

  const stamped = { ...next, w: ourWriter };
  await OBR.room.setMetadata({ [key]: stamped });
  await waitForEcho([key], ourWriter, ECHO_TIMEOUT_MS, opts.signal);
  return stamped;
}

export function parseWriter(w: string): { playerId: string | null; nonce: string } {
  const colon = w.indexOf(":");
  if (colon < 0) return { playerId: null, nonce: w };
  return { playerId: w.slice(0, colon), nonce: w.slice(colon + 1) };
}

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function randomNonce(): string {
  // 8 chars × 62 = ~218 trillion possibilities — collision-free for any
  // realistic concurrent-in-flight write count within a session.
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[buf[i] % 62];
  return out;
}

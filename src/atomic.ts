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

import OBR from "@owlbear-rodeo/sdk";
import { CUSTOMS_KEY, METADATA_KEY_PREFIX } from "./constants";
import type { WriterStamp } from "./types";
import { AbortError, ConflictError } from "./types";

const latestWriters = new Map<string, string>();
const waiters = new Set<() => boolean>();
// Keys currently being waited on — ingest tracks these regardless of prefix,
// so that callers using arbitrary keys (e.g. tests, future features) still get
// echo notifications without relaxing the global filter.
const pendingKeys = new Set<string>();
let unsubscribe: (() => void) | null = null;

function ingest(md: Record<string, unknown>): void {
  // OBR fires onMetadataChange on every room metadata change, including
  // OBR's own keys and other extensions'. Track keys we own (by prefix) plus
  // any keys currently pending an echo — the rest are ignored to avoid
  // accumulating stale writer values for foreign keys.
  for (const [k, v] of Object.entries(md)) {
    if (k !== CUSTOMS_KEY && !k.startsWith(METADATA_KEY_PREFIX) && !pendingKeys.has(k)) continue;
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
  pendingKeys.clear();
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
export const MAX_ATTEMPTS = 3;
export const BACKOFF_MS = [50, 200];

function makeWriter(): string {
  return `${OBR.player.id}:${randomNonce()}`;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => { clearTimeout(t); reject(new AbortError()); };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

async function waitForEcho(
  keys: string[],
  ourWriter: string,
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Promise<{ ok: true } | { ok: false; blockerWriter: string | null }> {
  // Register keys as pending so ingest() tracks them even if they lack our prefix.
  for (const k of keys) pendingKeys.add(k);

  const cleanup = () => { for (const k of keys) pendingKeys.delete(k); };

  const allMatch = () => keys.every((k) => latestWriters.get(k) === ourWriter);
  if (allMatch()) { cleanup(); return { ok: true }; }

  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const predicate = () => {
      if (allMatch()) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          cleanup();
          resolve({ ok: true });
        }
        return true;
      }
      return false;
    };
    waiters.add(predicate);
    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      waiters.delete(predicate);
      cleanup();
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
        cleanup();
        resolve({ ok: false, blockerWriter: null });
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

export async function atomicMultiUpdate(
  updates: Array<{ key: string; mutate: Mutator<WriterStamp> }>,
  opts: AtomicUpdateOptions,
): Promise<void> {
  startEchoTracker();
  let lastBlocker: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (opts.signal?.aborted) throw new AbortError();
    const md = await OBR.room.getMetadata();
    const ourWriter = makeWriter();
    const patch: Record<string, unknown> = {};
    const stampedKeys: string[] = [];
    for (const { key, mutate } of updates) {
      const current = (md[key] as WriterStamp | undefined) ?? null;
      const next = mutate(current);
      patch[key] = next === null ? undefined : { ...next, w: ourWriter };
      if (next !== null) stampedKeys.push(key);
    }
    if (opts.signal?.aborted) throw new AbortError();
    if (stampedKeys.length === 0) {
      await OBR.room.setMetadata(patch);
      return;
    }
    // Register pending keys BEFORE writing so ingest() tracks the echo even
    // when the metadata event fires synchronously (e.g. in tests).
    for (const k of stampedKeys) pendingKeys.add(k);
    await OBR.room.setMetadata(patch);
    const echo = await waitForEcho(stampedKeys, ourWriter, ECHO_TIMEOUT_MS, opts.signal);
    if (echo.ok) return;

    lastBlocker = echo.blockerWriter;
    opts.onConflict?.({ blockerWriter: echo.blockerWriter ?? "", attempt });
    if (attempt < MAX_ATTEMPTS) await sleep(BACKOFF_MS[attempt - 1], opts.signal);
  }

  throw new ConflictError(MAX_ATTEMPTS, lastBlocker);
}

export async function atomicUpdate<T extends WriterStamp>(
  key: string,
  mutate: Mutator<T>,
  opts: AtomicUpdateOptions,
): Promise<T | null> {
  let result: T | null = null;
  await atomicMultiUpdate([
    {
      key,
      mutate: (current) => {
        const next = mutate(current as T | null);
        result = next as T | null;
        return next;
      },
    },
  ], opts);
  // result holds the pre-stamp value from the mutator; apply the real writer
  // from the echo tracker so callers see the fully-stamped record.
  if (result !== null) {
    const w = latestWriters.get(key);
    if (w !== undefined) result = { ...result, w };
  }
  return result;
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

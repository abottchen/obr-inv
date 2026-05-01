import { vi } from "vitest";

const store = new Map<string, unknown>();
const broadcasts: Array<{ channel: string; data: unknown; destination?: "REMOTE" | "LOCAL" | "ALL" }> = [];
const broadcastListeners: Record<string, Array<(ev: { data: unknown }) => void>> = {};
let role: "PLAYER" | "GM" = "PLAYER";
let selfId = "player-self";
let selfName = "Self";
let selfColor = "#888888";
let players: Array<{ id: string; name: string; color: string; role: "PLAYER" | "GM" }> = [];
const metadataListeners: Array<(m: Record<string, unknown>) => void> = [];

export const OBR = {
  isAvailable: true,
  ready: vi.fn(async (cb: () => void) => cb()),
  onReady: vi.fn((cb: () => void) => { void cb(); }),
  room: {
    getMetadata: vi.fn(async () => Object.fromEntries(store)),
    setMetadata: vi.fn(async (patch: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) store.delete(k);
        else store.set(k, v);
      }
      const snapshot = Object.fromEntries(store);
      metadataListeners.forEach((l) => l(snapshot));
    }),
    onMetadataChange: vi.fn((cb: (m: Record<string, unknown>) => void) => {
      metadataListeners.push(cb);
      return () => {
        const i = metadataListeners.indexOf(cb);
        if (i >= 0) metadataListeners.splice(i, 1);
      };
    }),
  },
  player: {
    getRole: vi.fn(async () => role),
    getName: vi.fn(async () => selfName),
    getColor: vi.fn(async () => selfColor),
    get id() { return selfId; },
    onChange: vi.fn(() => () => {}),
  },
  party: { getPlayers: vi.fn(async () => players) },
  broadcast: {
    sendMessage: vi.fn(
      async (channel: string, data: unknown, opts?: { destination?: "REMOTE" | "LOCAL" | "ALL" }) => {
        broadcasts.push({ channel, data, destination: opts?.destination });
        for (const l of broadcastListeners[channel] ?? []) l({ data });
      },
    ),
    onMessage: vi.fn((channel: string, cb: (ev: { data: unknown }) => void) => {
      if (!broadcastListeners[channel]) broadcastListeners[channel] = [];
      broadcastListeners[channel].push(cb);
      return () => {
        const arr = broadcastListeners[channel] ?? [];
        const i = arr.indexOf(cb);
        if (i >= 0) arr.splice(i, 1);
      };
    }),
  },
  notification: { show: vi.fn(async (_msg: string, _level: string) => {}) },
};

export const __testHooks = {
  reset() {
    store.clear();
    broadcasts.length = 0;
    for (const k of Object.keys(broadcastListeners)) delete broadcastListeners[k];
    players = [];
    role = "PLAYER";
    selfId = "player-self";
    selfName = "Self";
    selfColor = "#888888";
    metadataListeners.length = 0;
    OBR.room.getMetadata.mockClear();
    OBR.room.setMetadata.mockClear();
    OBR.room.onMetadataChange.mockClear();
    OBR.player.getRole.mockClear();
    OBR.player.getName.mockClear();
    OBR.player.getColor.mockClear();
    OBR.party.getPlayers.mockClear();
    OBR.broadcast.sendMessage.mockClear();
    OBR.broadcast.onMessage.mockClear();
    OBR.notification.show.mockClear();
  },
  setRole(r: "PLAYER" | "GM") { role = r; },
  setSelf(id: string, name: string, color: string) {
    selfId = id; selfName = name; selfColor = color;
  },
  setParty(p: typeof players) { players = p; },
  store,
  broadcasts,
};

vi.mock("@owlbear-rodeo/sdk", () => ({ default: OBR, OBR }));

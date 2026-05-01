import { RARITIES } from "./constants";

export type Rarity = typeof RARITIES[number];

export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  rarity?: Rarity | null;
  weight?: number | null;
  [extra: string]: unknown;
}

export type InventoryEntry = [itemId: string, count: number];

export interface Currency { pp: number; gp: number; sp: number; cp: number; }

export interface PlayerInventoryRecord {
  name: string;
  color: string;
  items: InventoryEntry[];
  currency: Currency;
}

export interface ExtensionConfig {
  catalogUrl: string;
}

export interface TransferReceivedMessage {
  type: "transfer-received";
  fromName: string;
  toPlayerId: string;
  itemName: string;
  quantity: number;
}

export interface OverCapMessage {
  type: "over-cap";
  triggeringPlayerId: string;
  triggeringPlayerName: string;
  attempted: string;
  currentBytes: number;
  cap: number;
}

export type BroadcastMessage = TransferReceivedMessage | OverCapMessage;

export class OverCapError extends Error {
  constructor(
    public readonly currentBytes: number,
    public readonly cap: number,
    public readonly attempted: string,
  ) {
    super(`Inventory write would exceed cap (${currentBytes}/${cap}): ${attempted}`);
    this.name = "OverCapError";
  }
}

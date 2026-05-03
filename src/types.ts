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

/**
 * Custom (ad-hoc) items live in room metadata under CUSTOMS_KEY and
 * are structurally identical to CatalogItem. The alias documents
 * intent at call sites and lets us evolve the two independently
 * later without a migration.
 */
export type CustomItem = CatalogItem;
export type CustomItemsRecord = CustomItem[];

export type InventoryEntry = [itemId: string, count: number];

export interface Currency { pp: number; gp: number; sp: number; cp: number; }

export interface WriterStamp {
  /**
   * "<playerId>:<nonce>" stamped by the atomic helper on every write.
   * Empty string for legacy records (synthesized on read).
   */
  w: string;
}

export interface PlayerInventoryRecord extends WriterStamp {
  name: string;
  color: string;
  items: InventoryEntry[];
  currency: Currency;
}

export interface CustomItemsEnvelope extends WriterStamp {
  items: CustomItem[];
}

export interface ExtensionConfig {
  catalogUrl: string;
}

export interface TransferReceivedMessage {
  type: "transfer-received";
  fromPlayerId: string;
  fromName: string;
  toPlayerId: string;
  toName: string;
  itemId: string;
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

export class ConflictError extends Error {
  constructor(
    public readonly attempts: number,
    public readonly lastBlockerWriter: string | null,
  ) {
    super(`Could not commit after ${attempts} attempts`);
    this.name = "ConflictError";
  }
}

export class AbortError extends Error {
  constructor(message = "Operation cancelled") {
    super(message);
    this.name = "AbortError";
  }
}

import { clampToFrame } from "./frame";
import type { PlayerInventoryRecord } from "./types";

let active: HTMLElement | null = null;
let outsideHandler: ((e: MouseEvent) => void) | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;

export interface TransferTarget { id: string; name: string; color: string; }

export interface ShowTransferOpts {
  anchor: { x: number; y: number };
  itemId: string;
  itemName: string;
  itemIcon?: string;
  maxQty: number;
  targets: TransferTarget[];
  onConfirm: (toPlayerId: string, qty: number) => Promise<void> | void;
}

export function showTransfer(opts: ShowTransferOpts): void {
  closeTransfer();
  if (opts.targets.length === 0 || opts.maxQty <= 0) return;

  const pop = document.createElement("div");
  pop.className = "popover transfer-popover";

  const h = document.createElement("h4");
  h.textContent = `Transfer ${opts.itemName}`;
  pop.appendChild(h);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `qty: <input class="transfer-qty" type="number" min="1" max="${opts.maxQty}" value="1" /> (max ${opts.maxQty})`;
  pop.appendChild(meta);

  const list = document.createElement("div");
  list.className = "transfer-list";
  for (const t of opts.targets) {
    const b = document.createElement("button");
    b.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${escapeAttr(t.color)}"></span> → ${escape(t.name)}`;
    b.onclick = async () => {
      const q = parseInt(
        (pop.querySelector(".transfer-qty") as HTMLInputElement).value, 10,
      );
      const qty = Math.max(1, Math.min(opts.maxQty, isNaN(q) ? 1 : q));
      const target = t.id;
      closeTransfer();
      await opts.onConfirm(target, qty);
    };
    list.appendChild(b);
  }
  pop.appendChild(list);

  document.body.appendChild(pop);
  const r = pop.getBoundingClientRect();
  const { x, y } = clampToFrame({
    x: opts.anchor.x, y: opts.anchor.y, width: r.width, height: r.height,
  });
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;

  active = pop;
  outsideHandler = (e: MouseEvent) => {
    if (active && !active.contains(e.target as Node)) closeTransfer();
  };
  escHandler = (e: KeyboardEvent) => { if (e.key === "Escape") closeTransfer(); };
  setTimeout(() => {
    document.addEventListener("mousedown", outsideHandler!);
    document.addEventListener("keydown", escHandler!);
  }, 0);
}

export function closeTransfer(): void {
  if (active) active.remove();
  active = null;
  if (outsideHandler) document.removeEventListener("mousedown", outsideHandler);
  if (escHandler) document.removeEventListener("keydown", escHandler);
  outsideHandler = null;
  escHandler = null;
}

export function buildTargets(
  fromPlayerId: string,
  records: Record<string, PlayerInventoryRecord>,
  excludeGmId?: string,
): TransferTarget[] {
  return Object.entries(records)
    .filter(([id]) => id !== fromPlayerId && id !== excludeGmId)
    .map(([id, rec]) => ({ id, name: rec.name, color: rec.color }));
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}
function escapeAttr(s: string): string { return escape(s); }

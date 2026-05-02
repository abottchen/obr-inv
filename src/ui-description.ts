import { clampToFrame } from "./frame";
import { isSafeIconUrl } from "./escape";
import type { CatalogItem } from "./types";

let active: HTMLElement | null = null;
let outsideHandler: ((e: MouseEvent) => void) | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;

export interface DescriptionOpts {
  /** When provided, the popover renders a "Transfer…" button that
   *  closes the popover and invokes this callback. Omit for read-only
   *  contexts (e.g. browsing the catalog in the add-to-inventory dialog). */
  onTransfer?: () => void;
}

export function showDescription(
  anchor: { x: number; y: number }, item: CatalogItem | null,
  fallbackId?: string, opts?: DescriptionOpts,
): void {
  closeDescription();
  const pop = document.createElement("div");
  pop.className = "popover description-popover";
  if (item?.rarity) pop.dataset.rarity = item.rarity;

  const header = document.createElement("div");
  header.className = "desc-header";

  if (item?.icon && isSafeIconUrl(item.icon)) {
    const ic = document.createElement("div");
    ic.className = "desc-icon";
    ic.style.backgroundImage = `url("${item.icon}")`;
    header.appendChild(ic);
  }

  const title = document.createElement("div");
  title.className = "desc-title";
  title.textContent = item?.name ?? `[${fallbackId ?? "?"}] (missing from catalog)`;
  if (item?.rarity) title.dataset.rarity = item.rarity;
  header.appendChild(title);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "popover-close";
  close.textContent = "✕";
  close.title = "Close";
  close.onclick = closeDescription;
  header.appendChild(close);

  pop.appendChild(header);

  if (item && (item.rarity || typeof item.weight === "number")) {
    const meta = document.createElement("div");
    meta.className = "meta";
    const parts: string[] = [];
    if (item.rarity) parts.push(item.rarity);
    if (typeof item.weight === "number") parts.push(`${item.weight} lb`);
    meta.textContent = parts.join(" · ");
    pop.appendChild(meta);
  }

  const desc = document.createElement("div");
  desc.className = "desc";
  desc.textContent = item?.description ?? "Item missing from catalog.";
  pop.appendChild(desc);

  if (opts?.onTransfer) {
    const actions = document.createElement("div");
    actions.className = "desc-actions";
    const transferBtn = document.createElement("button");
    transferBtn.type = "button";
    transferBtn.className = "desc-transfer";
    transferBtn.textContent = "Transfer…";
    transferBtn.onclick = () => {
      const cb = opts.onTransfer;
      closeDescription();
      cb?.();
    };
    actions.appendChild(transferBtn);
    pop.appendChild(actions);
  }

  // Right-click anywhere inside the popover dismisses it. (Right-clicking
  // outside is already handled by the mousedown-outside listener below.)
  pop.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    closeDescription();
  });

  document.body.appendChild(pop);
  const r = pop.getBoundingClientRect();
  const { x, y } = clampToFrame({
    x: anchor.x, y: anchor.y, width: r.width, height: r.height,
  });
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;

  active = pop;
  outsideHandler = (e: MouseEvent) => {
    if (active && !active.contains(e.target as Node)) closeDescription();
  };
  escHandler = (e: KeyboardEvent) => { if (e.key === "Escape") closeDescription(); };
  setTimeout(() => {
    document.addEventListener("mousedown", outsideHandler!);
    document.addEventListener("keydown", escHandler!);
  }, 0);
}

export function closeDescription(): void {
  if (active) active.remove();
  active = null;
  if (outsideHandler) document.removeEventListener("mousedown", outsideHandler);
  if (escHandler) document.removeEventListener("keydown", escHandler);
  outsideHandler = null;
  escHandler = null;
}

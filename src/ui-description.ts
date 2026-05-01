import { clampToFrame } from "./frame";
import type { CatalogItem } from "./types";

let active: HTMLElement | null = null;
let outsideHandler: ((e: MouseEvent) => void) | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;

export function showDescription(
  anchor: { x: number; y: number }, item: CatalogItem | null, fallbackId?: string,
): void {
  closeDescription();
  const pop = document.createElement("div");
  pop.className = "popover description-popover";

  const title = document.createElement("h4");
  if (item?.icon) {
    const i = document.createElement("div");
    i.className = "inv-icon";
    i.style.backgroundImage = `url("${item.icon}")`;
    title.appendChild(i);
  }
  const span = document.createElement("span");
  span.textContent = item?.name ?? `[${fallbackId ?? "?"}] (missing from catalog)`;
  if (item?.rarity) span.style.color = `var(--rarity-${(item.rarity as string).replace(" ", "-")})`;
  title.appendChild(span);
  pop.appendChild(title);

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

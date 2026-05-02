import { clampToFrame } from "./frame";
import type { CatalogItem } from "./types";
import { appendIconImage } from "./ui-icon";
import { icon as svgIcon } from "./ui-icons";

let active: HTMLElement | null = null;
let outsideHandler: ((e: MouseEvent) => void) | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;

/**
 * Discrete zoom levels for the description popover. 1.0 is the
 * baseline; 0.85 a tighter pass for users who want to see more at
 * once; up through 1.75 for accessibility / shared-screen readability.
 * Persisted per-browser in localStorage so the next popover opens at
 * the user's last setting.
 */
const ZOOM_LEVELS = [0.85, 1.0, 1.15, 1.3, 1.5, 1.75] as const;
const DEFAULT_ZOOM = 1.0;
const ZOOM_KEY = "obr-inv:descZoom";

function snapToLevel(z: number): number {
  // Pick the closest defined level — guards against legacy / hand-edited
  // localStorage values that don't match the current step list.
  let best = DEFAULT_ZOOM;
  let bestDelta = Infinity;
  for (const level of ZOOM_LEVELS) {
    const d = Math.abs(level - z);
    if (d < bestDelta) { bestDelta = d; best = level; }
  }
  return best;
}

function readZoom(): number {
  try {
    const raw = localStorage.getItem(ZOOM_KEY);
    if (raw == null) return DEFAULT_ZOOM;
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return DEFAULT_ZOOM;
    return snapToLevel(n);
  } catch {
    return DEFAULT_ZOOM;
  }
}

function writeZoom(z: number): void {
  try { localStorage.setItem(ZOOM_KEY, String(z)); }
  catch (e) { console.warn("[obr-inv] localStorage write failed for desc zoom", e); }
}

function stepZoom(current: number, dir: 1 | -1): number {
  const idx = ZOOM_LEVELS.indexOf(snapToLevel(current) as typeof ZOOM_LEVELS[number]);
  const nextIdx = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, idx + dir));
  return ZOOM_LEVELS[nextIdx];
}

/**
 * Cap the popover's CSS box so (zoom × box) fits inside the iframe
 * viewport with a small padding on each side.
 *
 * The previous CSS-only attempt — `max-height: calc((100vh - 8px) /
 * var(--popover-zoom, 1))` — relied on viewport units NOT being
 * pre-scaled by `zoom`, which is browser-specific. Doing the math in
 * JS against window.innerWidth/innerHeight (always physical viewport
 * pixels) avoids that ambiguity entirely.
 *
 * Combined with `overflow-y: auto` on the popover (set in CSS), the
 * card stays inside the iframe at every zoom level and scrolls within
 * itself if a long description still doesn't fit.
 */
function applyDimensionsCap(pop: HTMLElement, zoom: number): void {
  const pad = 4;
  // Lower bound (120px) keeps the popover usable even on absurdly tiny
  // iframes; the original 340 max-width remains the upper bound at
  // zoom 1.0 since (innerWidth - 8) / 1 typically exceeds 340.
  const maxW = Math.max(120, Math.min(340, Math.floor((window.innerWidth  - 2 * pad) / zoom)));
  const maxH = Math.max(120, Math.floor((window.innerHeight - 2 * pad) / zoom));
  pop.style.maxWidth  = `${maxW}px`;
  pop.style.maxHeight = `${maxH}px`;
}

export interface DescriptionOpts {
  /** When provided, the popover renders a "Transfer…" button that
   *  closes the popover and invokes this callback. Omit for read-only
   *  contexts (e.g. browsing the catalog in the add-to-inventory dialog). */
  onTransfer?: () => void;
  /** When provided, the popover renders − / count / + and trash edit
   *  controls. Always set on inventory-mounted shells (the popover is
   *  the sole edit surface); omit only for read-only contexts such as
   *  catalog browsing in the add-to-inventory dialog. */
  editControls?: {
    count: number;
    onIncrement: () => void;
    onDecrement: () => void;
    onRemove: () => void;
  };
}

export function showDescription(
  anchor: { x: number; y: number }, item: CatalogItem | null,
  fallbackId?: string, opts?: DescriptionOpts,
): void {
  closeDescription();
  const pop = document.createElement("div");
  pop.className = "popover description-popover";
  if (item?.rarity) pop.dataset.rarity = item.rarity;

  // Apply persisted zoom before append so getBoundingClientRect below
  // reads the zoomed dimensions and clampToFrame keeps the popover in
  // the iframe even at the largest step. CSS uses
  // `zoom: var(--popover-zoom, 1)` on .description-popover.
  let zoom = readZoom();
  pop.style.setProperty("--popover-zoom", String(zoom));
  applyDimensionsCap(pop, zoom);

  const header = document.createElement("div");
  header.className = "desc-header";

  if (item?.icon) {
    const ic = document.createElement("div");
    ic.className = "desc-icon";
    if (appendIconImage(ic, item.icon)) header.appendChild(ic);
  }

  // Title block: small tagline above (category · rarity) gives a sense of
  // place, then the name in display font with rarity tint inherited from
  // .desc-title[data-rarity="..."] selectors.
  const titleBlock = document.createElement("div");
  titleBlock.className = "desc-titleblock";
  if (item && (item.category || item.rarity)) {
    const tagline = document.createElement("div");
    tagline.className = "desc-tagline";
    const parts: string[] = [];
    if (item.category) parts.push(item.category);
    if (item.rarity)   parts.push(item.rarity);
    tagline.textContent = parts.join(" · ");
    titleBlock.appendChild(tagline);
  }
  const title = document.createElement("div");
  title.className = "desc-title";
  title.textContent = item?.name ?? `[${fallbackId ?? "?"}] (missing from catalog)`;
  if (item?.rarity) title.dataset.rarity = item.rarity;
  titleBlock.appendChild(title);
  header.appendChild(titleBlock);

  // Trailing controls cluster: zoom out / zoom in / close. Sized to
  // match the existing close button so the row stays compact.
  const ctrls = document.createElement("div");
  ctrls.className = "desc-ctrls";

  const zOut = document.createElement("button");
  zOut.type = "button";
  zOut.className = "desc-zoom-btn";
  zOut.title = "Zoom out";
  zOut.appendChild(svgIcon("i-zoom-out"));
  ctrls.appendChild(zOut);

  const zIn = document.createElement("button");
  zIn.type = "button";
  zIn.className = "desc-zoom-btn";
  zIn.title = "Zoom in";
  zIn.appendChild(svgIcon("i-zoom-in"));
  ctrls.appendChild(zIn);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "popover-close";
  close.appendChild(svgIcon("i-x"));
  close.title = "Close";
  close.onclick = closeDescription;
  ctrls.appendChild(close);

  header.appendChild(ctrls);

  // Update zoom buttons' disabled state to reflect the current level
  // so the user gets a visual hint when they've hit the floor or ceiling.
  const refreshZoomBtns = () => {
    zOut.disabled = zoom <= ZOOM_LEVELS[0];
    zIn.disabled  = zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
  };
  refreshZoomBtns();

  // Zoom click handler — steps the level, persists, applies the CSS
  // variable, and re-clamps the popover position so growing toward the
  // bottom-right doesn't push it past the iframe edge.
  const applyZoom = (next: number) => {
    if (next === zoom) return;
    zoom = next;
    pop.style.setProperty("--popover-zoom", String(zoom));
    applyDimensionsCap(pop, zoom);
    writeZoom(zoom);
    refreshZoomBtns();
    // Re-measure post-zoom and clamp from the popover's current
    // rendered position. clampToFrame works in viewport pixels, so we
    // feed it r.{left,top,width,height} and then divide the result by
    // zoom — same reason as the initial placement below: CSS `zoom`
    // scales style.top/left, so the rendered position is style × zoom.
    const r = pop.getBoundingClientRect();
    const { x, y } = clampToFrame({ x: r.left, y: r.top, width: r.width, height: r.height });
    pop.style.left = `${x / zoom}px`;
    pop.style.top  = `${y / zoom}px`;
  };
  zOut.onclick = (e) => { e.stopPropagation(); applyZoom(stepZoom(zoom, -1)); };
  zIn.onclick  = (e) => { e.stopPropagation(); applyZoom(stepZoom(zoom,  1)); };

  pop.appendChild(header);

  // Three-up meta strip — weight / rarity / category as labelled cells.
  // Each cell only renders if its value exists, so a custom item with
  // no weight gets a two-cell strip instead of an empty slot.
  if (item && (typeof item.weight === "number" || item.rarity || item.category)) {
    const meta = document.createElement("div");
    meta.className = "meta meta-strip";
    const cell = (k: string, v: string) => {
      const el = document.createElement("div");
      el.className = "meta-cell";
      const kl = document.createElement("span"); kl.className = "k"; kl.textContent = k;
      const vl = document.createElement("span"); vl.className = "v"; vl.textContent = v;
      el.appendChild(kl); el.appendChild(vl);
      return el;
    };
    if (typeof item.weight === "number") meta.appendChild(cell("Weight", `${item.weight} lb`));
    if (item.rarity)                     meta.appendChild(cell("Rarity", item.rarity));
    if (item.category)                   meta.appendChild(cell("Type",   item.category));
    pop.appendChild(meta);
  }

  const desc = document.createElement("div");
  desc.className = "desc";
  desc.textContent = item?.description ?? "Item missing from catalog.";
  pop.appendChild(desc);

  // Show the actions row when there's anything to put in it: edit
  // controls or a transfer button.
  if (opts?.editControls || opts?.onTransfer) {
    const actions = document.createElement("div");
    actions.className = "desc-actions";

    if (opts.editControls) {
      const ec = opts.editControls;
      // Local optimistic count: the underlying handler is async, the metadata
      // round-trip won't propagate back to the popover (it's detached from
      // the shell rerender cycle). Tracking locally makes the count cell
      // reflect the user's clicks immediately and pulse where they're looking.
      let localCount = ec.count;

      const dec = document.createElement("button");
      dec.type = "button"; dec.className = "btn-step";
      dec.dataset.action = "dec";
      dec.textContent = "−"; dec.title = "Decrease";
      actions.appendChild(dec);

      const cntWrap = document.createElement("span");
      cntWrap.className = "desc-count-wrap";
      const cnt = document.createElement("span");
      cnt.className = "desc-count";
      cnt.textContent = `×${localCount}`;
      cntWrap.appendChild(cnt);
      const delta = document.createElement("span");
      delta.className = "desc-delta";
      cntWrap.appendChild(delta);
      actions.appendChild(cntWrap);

      const inc = document.createElement("button");
      inc.type = "button"; inc.className = "btn-step";
      inc.dataset.action = "inc";
      inc.textContent = "+"; inc.title = "Increase";
      actions.appendChild(inc);

      const rm = document.createElement("button");
      rm.type = "button"; rm.className = "btn-x";
      rm.dataset.action = "remove";
      rm.appendChild(svgIcon("i-trash")); rm.title = "Delete this item";
      rm.onclick = () => {
        const cb = ec.onRemove;
        closeDescription();
        cb();
      };
      actions.appendChild(rm);

      const pulse = (kind: "inc" | "dec", deltaText: string) => {
        // Restamp via reflow so rapid clicks re-trigger the CSS animation.
        delete cnt.dataset.pulse;
        delete delta.dataset.pulse;
        void cnt.offsetWidth;
        cnt.dataset.pulse = kind;
        delta.textContent = deltaText;
        delta.dataset.pulse = kind;
      };
      inc.onclick = () => {
        localCount += 1;
        cnt.textContent = `×${localCount}`;
        pulse("inc", "+1");
        ec.onIncrement();
      };
      dec.onclick = () => {
        if (localCount <= 0) return;
        localCount -= 1;
        cnt.textContent = `×${localCount}`;
        pulse("dec", "−1");
        ec.onDecrement();
      };
    }

    if (opts.onTransfer) {
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
    }

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
  // CSS `zoom` scales the element's positional offsets too, so the
  // rendered top/left is style.top/left × zoom. Divide here so the
  // rendered position lands at (x, y) — the value clampToFrame just
  // computed against the unscaled viewport.
  pop.style.left = `${x / zoom}px`;
  pop.style.top = `${y / zoom}px`;

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

/**
 * Inline SVG icon sprite. Mounted once per shell instance via `mountIconSprite`,
 * then referenced from anywhere in the shell with <use href="#icon-id">.
 * Centralises stroke style + viewBox so icons feel like one set, and lets the
 * shell drop emoji glyphs that don't pick up `currentColor` for theming.
 */
const SPRITE_ID = "obr-inv-icons";

const SPRITE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" id="${SPRITE_ID}" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
  <defs>
    <symbol id="i-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="7"/>
      <path d="m20 20-3.5-3.5"/>
    </symbol>
    <symbol id="i-collapse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 4v6H3M15 20v-6h6M9 4l-6 6M15 20l6-6"/>
    </symbol>
    <symbol id="i-expand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9V3h6M21 15v6h-6M3 9l6-6M21 15l-6 6"/>
    </symbol>
    <symbol id="i-list" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13"/>
      <circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>
    </symbol>
    <symbol id="i-grid" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </symbol>
    <symbol id="i-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2"/>
      <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
    </symbol>
    <symbol id="i-unlock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2"/>
      <path d="M8 11V7a4 4 0 0 1 7-2.6"/>
    </symbol>
    <symbol id="i-download" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 4v12M6 14l6 6 6-6M4 22h16"/>
    </symbol>
    <symbol id="i-star" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m12 2 3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7Z"/>
    </symbol>
    <symbol id="i-trash" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13c0 1 1 2 2 2h6c1 0 2-1 2-2l1-13M10 11v7M14 11v7"/>
    </symbol>
    <symbol id="i-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <path d="M12 5v14M5 12h14"/>
    </symbol>
    <symbol id="i-minus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <path d="M5 12h14"/>
    </symbol>
    <symbol id="i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M6 6l12 12M6 18 18 6"/>
    </symbol>
    <symbol id="i-weight" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 9h14l-1.5 11c0 1-1 2-2 2H8.5c-1 0-2-1-2-2L5 9Z"/>
      <circle cx="12" cy="6" r="3"/>
    </symbol>
    <symbol id="i-brand" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 7c-3-2-7-2-10-1v18c3-1 7-1 10 1 3-2 7-2 10-1V6c-3-1-7-1-10 1Z"/>
      <path d="M16 7v19"/>
      <path d="M9 11h3M9 15h3M9 19h3M20 11h3M20 15h3M20 19h3"/>
    </symbol>
  </defs>
</svg>
`.trim();

/**
 * Inserts the icon sprite into the document once. Subsequent calls are no-ops.
 * <use href="#icon-id"> in the same document picks up the symbols.
 */
export function mountIconSprite(): void {
  if (document.getElementById(SPRITE_ID)) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = SPRITE_SVG;
  const svg = wrap.firstElementChild;
  if (svg) document.body.appendChild(svg);
}

/**
 * Build a `<svg><use href="#icon-id"/></svg>` element, sized via CSS by the
 * caller (typically `width: 1em; height: 1em;` on a wrapping rule).
 */
export function icon(id: string, extraClass = ""): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", `ic ${extraClass}`.trim());
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const use = document.createElementNS(NS, "use");
  use.setAttribute("href", `#${id}`);
  svg.appendChild(use);
  return svg;
}

/**
 * Replace an existing icon's symbol target without rebuilding the element.
 * Used by the lock toggle, which flips between i-lock and i-unlock on click.
 */
export function setIcon(svg: SVGSVGElement, id: string): void {
  const use = svg.querySelector("use");
  if (use) use.setAttribute("href", `#${id}`);
}

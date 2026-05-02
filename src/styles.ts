import { THEME, RARITY_COLORS, CURRENCY_COLORS } from "./constants";

const BASE_CSS = `
:root {
  --bg-0: ${THEME.bg0}; --bg-1: ${THEME.bg1}; --bg-2: ${THEME.bg2};
  --border: ${THEME.border}; --text: ${THEME.text}; --text-dim: ${THEME.textDim};
  --accent: ${THEME.accent}; --accent-soft: ${THEME.accentSoft};
  --ok: ${THEME.ok}; --warn: ${THEME.warn}; --bad: ${THEME.bad};
  --rarity-common: ${RARITY_COLORS.common};
  --rarity-uncommon: ${RARITY_COLORS.uncommon};
  --rarity-rare: ${RARITY_COLORS.rare};
  --rarity-very-rare: ${RARITY_COLORS["very rare"]};
  --rarity-legendary: ${RARITY_COLORS.legendary};
  --ccy-pp: ${CURRENCY_COLORS.pp};
  --ccy-gp: ${CURRENCY_COLORS.gp};
  --ccy-sp: ${CURRENCY_COLORS.sp};
  --ccy-cp: ${CURRENCY_COLORS.cp};

  /* Font stacks. Display + mono families load from public/fonts/ via
   * @font-face in index.html. Each falls back to the platform default if
   * the WOFF2 fails (corporate firewall, offline first-run, etc.). */
  --font-body: "Manrope", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: "Fraunces", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --font-feature-display: "ss01" on, "ss02" on;
}
* { box-sizing: border-box; }
html, body, #root { margin: 0; padding: 0; height: 100%; overflow: hidden; }
body {
  /* Layered atmosphere: faint gilt + ember radial highlights, a fine
   * 135deg leather grain, a base oxblood gradient. Effect is subtle —
   * legible at every zoom, no banding at low contrast. */
  background:
    radial-gradient(circle at 30% 20%, rgba(232,207,134,0.025) 0%, transparent 35%),
    radial-gradient(circle at 70% 70%, rgba(196,90,44,0.018) 0%, transparent 40%),
    repeating-linear-gradient(135deg,
      rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px,
      rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 3px),
    linear-gradient(180deg, var(--bg-1) 0%, var(--bg-0) 100%);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 13px; line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}
button { font-family: inherit; }
input { font-family: inherit; }

/* Display font helper — applied to item names, category headers,
 * brand mark, primary action labels. Uses the WONK + SOFT axes for
 * a touch of Fraunces character at large sizes. */
.font-display {
  font-family: var(--font-display);
  font-variation-settings: "opsz" 36, "wght" 500, "SOFT" 30;
  letter-spacing: -0.005em;
}
.font-display-lg {
  font-family: var(--font-display);
  font-variation-settings: "opsz" 144, "wght" 500, "SOFT" 30, "WONK" 1;
  letter-spacing: -0.01em;
}

/* Tabular monospace — counts, currency values, weight, byte meters. */
.font-mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}

/* Custom scrollbars: thin, leather-toned, invisible track. */
* {
  scrollbar-width: thin;
  scrollbar-color: ${THEME.border} transparent;
}
*::-webkit-scrollbar { width: 8px; height: 8px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
  border: 2px solid var(--bg-1);
}
*::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--border) 70%, var(--accent) 30%);
}

/* Selection picks up the gilt accent rather than the OS default blue. */
::selection {
  background: color-mix(in srgb, var(--accent) 45%, transparent);
  color: var(--text);
}
`;

export function injectStyles(css: string, id: string): void {
  if (document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

export function injectBaseStyles(): void {
  injectStyles(BASE_CSS, "obr-inv-base-styles");
}

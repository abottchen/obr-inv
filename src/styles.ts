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
}
* { box-sizing: border-box; }
html, body, #root { margin: 0; padding: 0; height: 100%; overflow: hidden; }
body {
  background: var(--bg-0); color: var(--text);
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 13px; line-height: 1.4;
}
button { font-family: inherit; }
input { font-family: inherit; }
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

import OBR from "@owlbear-rodeo/sdk";
import { fetchCatalog } from "./catalog";
import { ensureRecord, getRecord } from "./metadata";
import { mountPlayerView } from "./ui-player";
import { mountGmView } from "./ui-gm";
import { injectBaseStyles, injectStyles } from "./styles";
import { LIST_CSS } from "./styles-list";
import { DIALOG_CSS } from "./styles-dialog";
import { DEFAULT_CATALOG_URL, CONFIG_KEY } from "./constants";
import type { ExtensionConfig } from "./types";

OBR.onReady(async () => {
  injectBaseStyles();
  injectStyles(LIST_CSS, "obr-inv-list-styles");
  injectStyles(DIALOG_CSS, "obr-inv-dialog-styles");

  const root = document.getElementById("root");
  if (!root) return;

  const role = await OBR.player.getRole();
  const selfId = OBR.player.id;
  const selfName = await OBR.player.getName();
  const selfColor = await OBR.player.getColor();

  const md = await OBR.room.getMetadata();
  const cfg = md[CONFIG_KEY] as ExtensionConfig | undefined;
  const catalogUrl = cfg?.catalogUrl ?? DEFAULT_CATALOG_URL;

  let catalog;
  try {
    catalog = await fetchCatalog(catalogUrl);
  } catch (err) {
    console.error("[obr-inv] catalog fetch failed", err);
    root.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-dim)">Couldn't load item catalog. Inventory display is paused — try reopening.</div>`;
    return;
  }

  await ensureRecord(selfId, selfName, selfColor);

  if (role === "GM") {
    mountGmView({
      root, catalog, catalogUrl,
      selfId, selfName, selfColor,
    });
  } else {
    const initial = await getRecord(selfId);
    if (!initial) return;
    mountPlayerView({
      root, catalog, playerId: selfId, initialRecord: initial,
    });
  }
});

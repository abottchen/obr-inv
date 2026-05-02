import OBR from "@owlbear-rodeo/sdk";
import { fetchCatalog } from "./catalog";
import {
  ensureRecord, getCustoms, getRecord, writeCustoms,
} from "./metadata";
import { mountPlayerView } from "./ui-player";
import { mountGmView } from "./ui-gm";
import { injectBaseStyles, injectStyles } from "./styles";
import { LIST_CSS } from "./styles-list";
import { DIALOG_CSS } from "./styles-dialog";
import { FEEDBACK_CSS } from "./styles-feedback";
import { DEFAULT_CATALOG_URL, CONFIG_KEY } from "./constants";
import { reconcileCustoms } from "./customs";
import type { CatalogItem, CustomItemsRecord, ExtensionConfig } from "./types";

OBR.onReady(async () => {
  injectBaseStyles();
  injectStyles(LIST_CSS, "obr-inv-list-styles");
  injectStyles(DIALOG_CSS, "obr-inv-dialog-styles");
  injectStyles(FEEDBACK_CSS, "obr-inv-feedback-styles");

  const root = document.getElementById("root");
  if (!root) return;

  const role = await OBR.player.getRole();
  const selfId = OBR.player.id;
  const selfName = await OBR.player.getName();
  const selfColor = await OBR.player.getColor();

  const md = await OBR.room.getMetadata();
  const cfg = md[CONFIG_KEY] as ExtensionConfig | undefined;
  const catalogUrl = cfg?.catalogUrl ?? DEFAULT_CATALOG_URL;

  let catalog: CatalogItem[];
  try {
    catalog = await fetchCatalog(catalogUrl);
  } catch (err) {
    console.error("[obr-inv] catalog fetch failed", err);
    root.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-dim)">Couldn't load item catalog. Inventory display is paused — try reopening.</div>`;
    return;
  }

  await ensureRecord(selfId, selfName, selfColor);

  // Promotion-completion reconciliation (§6.1): on GM boot, if any
  // custom's id has appeared in the published catalog, drop it from
  // metadata. Players don't have authority over the customs key, so
  // they don't run this. Per-key write queue serializes if two GMs
  // are present; the second pass is a no-op.
  let customs: CustomItemsRecord = await getCustoms();
  if (role === "GM" && customs.length > 0) {
    const { survivors, removed } = reconcileCustoms(catalog, customs);
    if (removed.length > 0) {
      try {
        await writeCustoms(survivors);
        customs = survivors;
        console.info(
          `[obr-inv] Removed ${removed.length} promoted custom item${removed.length === 1 ? "" : "s"}: ${removed.map((c) => c.name).join(", ")}`,
        );
      } catch (err) {
        console.warn("[obr-inv] reconciliation write failed", err);
      }
    }
  }

  if (role === "GM") {
    mountGmView({
      root, catalog, catalogUrl,
      initialCustoms: customs,
      selfId, selfName, selfColor,
    });
  } else {
    const initial = await getRecord(selfId);
    if (!initial) return;
    mountPlayerView({
      root, catalog,
      initialCustoms: customs,
      playerId: selfId, initialRecord: initial,
    });
  }
});

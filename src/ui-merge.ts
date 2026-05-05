import { escapeHtml } from "./escape";
import { executeMerge } from "./merge";
import { withOverlay } from "./ui-mutate";
import type { PlayerInventoryRecord } from "./types";

// ── Auto-detect claim banner ────────────────────────────────────────

export interface ClaimBannerOpts {
  orphans: Array<{ id: string; record: PlayerInventoryRecord }>;
  selfId: string;
  records: Record<string, PlayerInventoryRecord>;
}

export function showClaimBanner(opts: ClaimBannerOpts): void {
  closeClaimBanner();

  const total = summariseRecords(opts.orphans.map((o) => o.record));
  const banner = document.createElement("div");
  banner.className = "claim-banner";
  banner.id = "obr-inv-claim-banner";

  const text = document.createElement("div");
  text.className = "claim-text";
  text.innerHTML = `Previous inventory found — <strong>${escapeHtml(total)}</strong>`;
  banner.appendChild(text);

  const actions = document.createElement("div");
  actions.className = "claim-actions";

  const dismiss = document.createElement("button");
  dismiss.className = "claim-btn-dismiss";
  dismiss.textContent = "Dismiss";
  dismiss.onclick = closeClaimBanner;

  const claim = document.createElement("button");
  claim.className = "claim-btn-claim";
  claim.textContent = "Claim Items";
  claim.onclick = async () => {
    closeClaimBanner();
    for (const orphan of opts.orphans) {
      await withOverlay(
        `Merging old inventory…`,
        opts.records,
        (wopts) => executeMerge(opts.selfId, orphan.id, wopts),
      );
    }
  };

  actions.appendChild(dismiss);
  actions.appendChild(claim);
  banner.appendChild(actions);
  document.body.appendChild(banner);
}

export function closeClaimBanner(): void {
  document.getElementById("obr-inv-claim-banner")?.remove();
}

// ── GM merge dialog ─────────────────────────────────────────────────

export interface MergeDialogOpts {
  records: Record<string, PlayerInventoryRecord>;
  selfId: string;
  onError: (e: unknown) => void;
}

export function openMergeDialog(opts: MergeDialogOpts): void {
  closeMergeDialog();

  const ids = Object.keys(opts.records).sort((a, b) => {
    if (a === opts.selfId) return 1;
    if (b === opts.selfId) return -1;
    return opts.records[a].name.localeCompare(opts.records[b].name);
  });

  if (ids.length < 2) {
    return;
  }

  let sourceId: string | null = null;
  let targetId: string | null = null;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.id = "obr-inv-merge-dialog";

  const dialog = document.createElement("div");
  dialog.className = "modal merge-dialog";

  const header = document.createElement("div");
  header.className = "merge-dialog-header";
  header.innerHTML = `<h3>Merge Records</h3>`;
  const closeBtn = document.createElement("button");
  closeBtn.className = "popover-close";
  closeBtn.innerHTML = "&#x2715;";
  closeBtn.onclick = closeMergeDialog;
  header.appendChild(closeBtn);
  dialog.appendChild(header);

  const body = document.createElement("div");
  body.className = "merge-dialog-body";

  const sourceSection = document.createElement("div");
  sourceSection.className = "merge-section";
  const sourceLabel = document.createElement("div");
  sourceLabel.className = "merge-section-label";
  sourceLabel.textContent = "Absorb from";
  sourceSection.appendChild(sourceLabel);
  const sourceList = document.createElement("div");
  sourceList.className = "merge-list";
  sourceSection.appendChild(sourceList);
  body.appendChild(sourceSection);

  const targetSection = document.createElement("div");
  targetSection.className = "merge-section merge-section-target";
  const targetLabel = document.createElement("div");
  targetLabel.className = "merge-section-label";
  targetLabel.textContent = "Merge into";
  targetSection.appendChild(targetLabel);
  const targetList = document.createElement("div");
  targetList.className = "merge-list";
  targetSection.appendChild(targetList);
  body.appendChild(targetSection);

  const preview = document.createElement("div");
  preview.className = "merge-preview";
  body.appendChild(preview);

  dialog.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "merge-actions";
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn-cancel";
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = closeMergeDialog;
  const mergeBtn = document.createElement("button");
  mergeBtn.className = "btn-save";
  mergeBtn.textContent = "Merge";
  mergeBtn.disabled = true;
  actions.appendChild(cancelBtn);
  actions.appendChild(mergeBtn);
  dialog.appendChild(actions);

  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  function render() {
    renderPlayerList(sourceList, ids, opts.records, opts.selfId, sourceId, targetId, (id) => {
      sourceId = sourceId === id ? null : id;
      if (targetId === sourceId) targetId = null;
      render();
    });

    targetSection.style.display = sourceId ? "" : "none";
    if (sourceId) {
      const targetIds = ids.filter((id) => id !== sourceId);
      renderPlayerList(targetList, targetIds, opts.records, opts.selfId, targetId, sourceId, (id) => {
        targetId = targetId === id ? null : id;
        render();
      });
    }

    if (sourceId && targetId) {
      const src = opts.records[sourceId];
      const tgt = opts.records[targetId];
      const summary = summariseRecords([src]);
      preview.style.display = "";
      preview.innerHTML =
        `<strong>${escapeHtml(summary)}</strong> will be moved from ` +
        `<strong>${escapeHtml(src.name)}</strong> into ` +
        `<strong>${escapeHtml(tgt.name)}</strong>.<br>` +
        `The source record will be permanently removed.`;
      mergeBtn.disabled = false;
    } else {
      preview.style.display = "none";
      mergeBtn.disabled = true;
    }
  }

  mergeBtn.onclick = async () => {
    if (!sourceId || !targetId) return;
    const src = sourceId;
    const tgt = targetId;
    const srcName = opts.records[src]?.name ?? src;
    const tgtName = opts.records[tgt]?.name ?? tgt;
    closeMergeDialog();
    try {
      await withOverlay(
        `Merging ${srcName} into ${tgtName}…`,
        opts.records,
        (wopts) => executeMerge(tgt, src, wopts),
      );
    } catch (e) {
      opts.onError(e);
    }
  };

  backdrop.onclick = (e) => {
    if (e.target === backdrop) closeMergeDialog();
  };

  render();
}

export function closeMergeDialog(): void {
  document.getElementById("obr-inv-merge-dialog")?.remove();
}

// ── Shared helpers ──────────────────────────────────────────────────

function renderPlayerList(
  container: HTMLElement,
  ids: string[],
  records: Record<string, PlayerInventoryRecord>,
  selfId: string,
  selectedId: string | null,
  excludeId: string | null,
  onSelect: (id: string) => void,
): void {
  container.innerHTML = "";
  for (const pid of ids) {
    if (pid === excludeId) continue;
    const r = records[pid];
    if (!r) continue;
    const btn = document.createElement("button");
    btn.className = pid === selectedId ? "selected" : "";
    const isSelf = pid === selfId;
    const itemCount = r.items.reduce((acc, [, n]) => acc + (n > 0 ? 1 : 0), 0);
    const label = isSelf ? `${r.name} (GM)` : r.name;

    btn.innerHTML =
      `<span class="merge-pip" style="color:${escapeHtml(r.color)}">${escapeHtml((r.name?.[0] ?? "?").toUpperCase())}</span>` +
      `<span class="merge-who">` +
      `<span class="merge-name">${escapeHtml(label)}</span>` +
      `<span class="merge-stats">${itemCount} items${currencyLine(r)}</span>` +
      `</span>`;
    btn.onclick = () => onSelect(pid);
    container.appendChild(btn);
  }
}

function currencyLine(r: PlayerInventoryRecord): string {
  const parts: string[] = [];
  if (r.currency.pp > 0) parts.push(`${r.currency.pp} pp`);
  if (r.currency.gp > 0) parts.push(`${r.currency.gp} gp`);
  if (r.currency.sp > 0) parts.push(`${r.currency.sp} sp`);
  if (r.currency.cp > 0) parts.push(`${r.currency.cp} cp`);
  return parts.length > 0 ? ` · ${parts.join(", ")}` : "";
}

function summariseRecords(records: PlayerInventoryRecord[]): string {
  let items = 0;
  let pp = 0, gp = 0, sp = 0, cp = 0;
  for (const r of records) {
    items += r.items.reduce((acc, [, n]) => acc + (n > 0 ? 1 : 0), 0);
    pp += r.currency.pp;
    gp += r.currency.gp;
    sp += r.currency.sp;
    cp += r.currency.cp;
  }
  const parts: string[] = [];
  if (items > 0) parts.push(`${items} item${items === 1 ? "" : "s"}`);
  if (pp > 0) parts.push(`${pp} pp`);
  if (gp > 0) parts.push(`${gp} gp`);
  if (sp > 0) parts.push(`${sp} sp`);
  if (cp > 0) parts.push(`${cp} cp`);
  return parts.join(", ") || "empty inventory";
}

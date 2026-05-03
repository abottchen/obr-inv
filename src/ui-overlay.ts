export interface ShowOverlayOpts {
  description: string;
  onCancel: () => void;
}

export const GRACE_MS = 200;
export const MIN_VISIBLE_MS = 400;
const HARD_CAP_MS = 5000;

let backdrop: HTMLElement | null = null;
let pop: HTMLElement | null = null;
let textEl: HTMLElement | null = null;
let cancelBtn: HTMLButtonElement | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;
let hardCapTimer: ReturnType<typeof setTimeout> | null = null;
let graceTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let shownAt: number | null = null;
let pendingDescription = "";
let cancelHandler: (() => void) | null = null;

export function showOverlay(opts: ShowOverlayOpts): void {
  hardReset();

  pendingDescription = opts.description;
  cancelHandler = opts.onCancel;

  backdrop = document.createElement("div");
  backdrop.className = "atomic-overlay-backdrop atomic-overlay-backdrop--invisible";
  document.body.appendChild(backdrop);

  escHandler = (e) => { if (e.key === "Escape") cancelHandler?.(); };
  document.addEventListener("keydown", escHandler);

  hardCapTimer = setTimeout(() => cancelHandler?.(), HARD_CAP_MS);
  graceTimer = setTimeout(() => { graceTimer = null; mountPopup(); }, GRACE_MS);
}

function mountPopup(): void {
  if (!backdrop) return;
  backdrop.classList.remove("atomic-overlay-backdrop--invisible");

  pop = document.createElement("div");
  pop.className = "atomic-overlay";

  const spinner = document.createElement("div");
  spinner.className = "atomic-overlay__spinner";
  pop.appendChild(spinner);

  textEl = document.createElement("div");
  textEl.className = "atomic-overlay__text";
  textEl.textContent = pendingDescription;
  pop.appendChild(textEl);

  cancelBtn = document.createElement("button");
  cancelBtn.className = "atomic-overlay__cancel";
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => cancelHandler?.();
  pop.appendChild(cancelBtn);

  document.body.appendChild(pop);
  shownAt = Date.now();
}

export function setOverlayDescription(text: string): void {
  pendingDescription = text;
  if (textEl) textEl.textContent = text;
}

export function setOverlayState(state: "working" | "cancelling"): void {
  if (state === "cancelling") {
    pendingDescription = "Cancelling…";
    if (textEl) textEl.textContent = "Cancelling…";
    if (cancelBtn) cancelBtn.disabled = true;
  } else {
    if (cancelBtn) cancelBtn.disabled = false;
  }
}

export function closeOverlay(): void {
  if (closeTimer) return;

  if (hardCapTimer) { clearTimeout(hardCapTimer); hardCapTimer = null; }
  if (escHandler) {
    document.removeEventListener("keydown", escHandler);
    escHandler = null;
  }
  cancelHandler = null;
  if (cancelBtn) {
    cancelBtn.disabled = true;
    cancelBtn.onclick = null;
  }

  if (graceTimer) {
    clearTimeout(graceTimer);
    graceTimer = null;
    teardown();
    return;
  }

  if (pop && shownAt !== null) {
    const elapsed = Date.now() - shownAt;
    if (elapsed >= MIN_VISIBLE_MS) {
      teardown();
    } else {
      closeTimer = setTimeout(() => { closeTimer = null; teardown(); }, MIN_VISIBLE_MS - elapsed);
    }
    return;
  }

  teardown();
}

function hardReset(): void {
  if (hardCapTimer) { clearTimeout(hardCapTimer); hardCapTimer = null; }
  if (graceTimer) { clearTimeout(graceTimer); graceTimer = null; }
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  if (escHandler) {
    document.removeEventListener("keydown", escHandler);
    escHandler = null;
  }
  teardown();
}

function teardown(): void {
  pop?.remove();
  backdrop?.remove();
  pop = null;
  backdrop = null;
  textEl = null;
  cancelBtn = null;
  shownAt = null;
  cancelHandler = null;
  pendingDescription = "";
}

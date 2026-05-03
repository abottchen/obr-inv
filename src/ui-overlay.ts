export interface ShowOverlayOpts {
  description: string;
  onCancel: () => void;
}

const HARD_CAP_MS = 5000;

let backdrop: HTMLElement | null = null;
let pop: HTMLElement | null = null;
let textEl: HTMLElement | null = null;
let cancelBtn: HTMLButtonElement | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;
let hardCapTimer: ReturnType<typeof setTimeout> | null = null;
let hardCapHandler: (() => void) | null = null;

export function showOverlay(opts: ShowOverlayOpts): void {
  closeOverlay();

  backdrop = document.createElement("div");
  backdrop.className = "atomic-overlay-backdrop";
  document.body.appendChild(backdrop);

  pop = document.createElement("div");
  pop.className = "atomic-overlay";

  const spinner = document.createElement("div");
  spinner.className = "atomic-overlay__spinner";
  pop.appendChild(spinner);

  textEl = document.createElement("div");
  textEl.className = "atomic-overlay__text";
  textEl.textContent = opts.description;
  pop.appendChild(textEl);

  cancelBtn = document.createElement("button");
  cancelBtn.className = "atomic-overlay__cancel";
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => opts.onCancel();
  pop.appendChild(cancelBtn);

  document.body.appendChild(pop);

  escHandler = (e) => { if (e.key === "Escape") opts.onCancel(); };
  document.addEventListener("keydown", escHandler);

  hardCapHandler = () => opts.onCancel();
  hardCapTimer = setTimeout(() => { hardCapHandler?.(); }, HARD_CAP_MS);
}

export function setOverlayDescription(text: string): void {
  if (textEl) textEl.textContent = text;
}

export function setOverlayState(state: "working" | "cancelling"): void {
  if (!cancelBtn || !textEl) return;
  if (state === "cancelling") {
    cancelBtn.disabled = true;
    textEl.textContent = "Cancelling…";
  } else {
    cancelBtn.disabled = false;
  }
}

export function closeOverlay(): void {
  if (hardCapTimer) { clearTimeout(hardCapTimer); hardCapTimer = null; }
  hardCapHandler = null;
  if (escHandler) {
    document.removeEventListener("keydown", escHandler);
    escHandler = null;
  }
  pop?.remove();
  backdrop?.remove();
  pop = null;
  backdrop = null;
  textEl = null;
  cancelBtn = null;
}

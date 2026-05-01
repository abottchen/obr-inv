import { RARITIES } from "./constants";
import { generateUnusedItemId, distinctCategories } from "./customs";
import { isSafeIconUrl } from "./escape";
import type { CatalogItem, CustomItem, Rarity } from "./types";
import { OverCapError } from "./types";

export interface CustomsDialogOpts {
  /** The merged catalog (remote ∪ existing customs) — used for ID
   *  collision avoidance and category combobox seeding. */
  resolved: CatalogItem[];
  /** When set, the dialog is in edit mode and prefills from this item. */
  initial?: CustomItem;
  /** When the form prefills the name field on open (used by the
   *  add-dialog empty-state CTA "Create '<query>' as custom item"). */
  prefillName?: string;
  /** Save handler. Returns/throws to surface storage-cap or network
   *  errors back to the dialog so the user can retry. */
  onSave: (item: CustomItem) => Promise<void>;
}

let active: HTMLElement | null = null;

export function openCustomsDialog(opts: CustomsDialogOpts): void {
  closeCustomsDialog();

  const isEdit = !!opts.initial;
  const existingIds = new Set<string>(opts.resolved.map((c) => c.id));
  // In edit mode the item's own id should not count as "in use" for
  // the regenerate-on-collision helper (we never regenerate on edit).
  const initialId = opts.initial?.id ?? generateUnusedItemId(existingIds);

  const back = document.createElement("div");
  back.className = "modal-backdrop";
  back.addEventListener("mousedown", (e) => {
    if (e.target === back) closeCustomsDialog();
  });

  const modal = document.createElement("div");
  modal.className = "modal customs-dialog";

  // Header
  const header = document.createElement("div");
  header.className = "customs-dialog-header";
  const h = document.createElement("h3");
  h.textContent = isEdit ? "Edit custom item" : "Create custom item";
  header.appendChild(h);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "dialog-close";
  close.textContent = "✕";
  close.title = "Close";
  close.onclick = closeCustomsDialog;
  header.appendChild(close);
  modal.appendChild(header);

  // Error row (hidden until needed)
  const errorRow = document.createElement("div");
  errorRow.className = "customs-error";
  errorRow.style.display = "none";
  modal.appendChild(errorRow);

  // Form body
  const form = document.createElement("form");
  form.className = "customs-form";
  form.addEventListener("submit", (e) => e.preventDefault());

  const nameInput = labeledInput(form, "Name", "name", {
    required: true, maxLength: 120,
    initial: opts.initial?.name ?? opts.prefillName ?? "",
  });

  // Category combobox: typeable input + datalist for autocomplete.
  const categoryInput = labeledCombobox(form, "Category", "category", {
    required: true, maxLength: 60,
    initial: opts.initial?.category ?? "",
    options: distinctCategories(opts.resolved),
  });

  const descLabel = document.createElement("label");
  descLabel.className = "customs-field";
  const descTitle = document.createElement("span");
  descTitle.className = "customs-label";
  descTitle.textContent = "Description *";
  descLabel.appendChild(descTitle);
  const descInput = document.createElement("textarea");
  descInput.className = "customs-input customs-textarea";
  descInput.rows = 4;
  descInput.maxLength = 2000;
  descInput.required = true;
  descInput.value = opts.initial?.description ?? "";
  descLabel.appendChild(descInput);
  form.appendChild(descLabel);

  const iconInput = labeledInput(form, "Image URL (optional)", "icon", {
    initial: opts.initial?.icon ?? "",
    placeholder: "https://...",
  });

  // Rarity / weight live on a single row
  const inlineRow = document.createElement("div");
  inlineRow.className = "customs-inline";
  form.appendChild(inlineRow);

  const rarityLabel = document.createElement("label");
  rarityLabel.className = "customs-field customs-inline-cell";
  const rarityTitle = document.createElement("span");
  rarityTitle.className = "customs-label";
  rarityTitle.textContent = "Rarity (optional)";
  rarityLabel.appendChild(rarityTitle);
  const raritySel = document.createElement("select");
  raritySel.className = "customs-input";
  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "(none)";
  raritySel.appendChild(noneOpt);
  for (const r of RARITIES) {
    const o = document.createElement("option");
    o.value = r;
    o.textContent = r;
    raritySel.appendChild(o);
  }
  raritySel.value = opts.initial?.rarity ?? "";
  rarityLabel.appendChild(raritySel);
  inlineRow.appendChild(rarityLabel);

  const weightLabel = document.createElement("label");
  weightLabel.className = "customs-field customs-inline-cell";
  const weightTitle = document.createElement("span");
  weightTitle.className = "customs-label";
  weightTitle.textContent = "Weight (optional)";
  weightLabel.appendChild(weightTitle);
  const weightInput = document.createElement("input");
  weightInput.className = "customs-input";
  weightInput.type = "number";
  weightInput.min = "0";
  weightInput.step = "0.01";
  weightInput.value = (opts.initial?.weight ?? "").toString();
  weightLabel.appendChild(weightInput);
  inlineRow.appendChild(weightLabel);

  // Actions
  const actions = document.createElement("div");
  actions.className = "customs-actions";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn-cancel";
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = closeCustomsDialog;
  actions.appendChild(cancelBtn);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn-save";
  saveBtn.textContent = "Save";
  saveBtn.disabled = true;
  actions.appendChild(saveBtn);
  form.appendChild(actions);

  modal.appendChild(form);
  back.appendChild(modal);
  document.body.appendChild(back);

  const validate = (): boolean => {
    const url = iconInput.value.trim();
    const ok =
      nameInput.value.trim().length > 0
      && categoryInput.value.trim().length > 0
      && descInput.value.trim().length > 0
      && (url === "" || isSafeIconUrl(url));
    saveBtn.disabled = !ok;
    return ok;
  };

  nameInput.addEventListener("input", validate);
  categoryInput.addEventListener("input", validate);
  descInput.addEventListener("input", validate);
  iconInput.addEventListener("input", validate);
  validate();

  saveBtn.onclick = async () => {
    if (!validate()) return;
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    errorRow.style.display = "none";
    errorRow.textContent = "";

    const rarity = raritySel.value === ""
      ? null : (raritySel.value as Rarity);
    const weightRaw = weightInput.value.trim();
    let weight: number | null = null;
    if (weightRaw !== "") {
      const n = parseFloat(weightRaw);
      weight = Number.isFinite(n) && n >= 0 ? n : null;
    }

    const item: CustomItem = {
      id: initialId,
      name: nameInput.value.trim(),
      category: categoryInput.value.trim(),
      icon: iconInput.value.trim(),
      description: descInput.value.trim(),
      rarity,
      weight,
    };

    try {
      await opts.onSave(item);
      closeCustomsDialog();
    } catch (err) {
      cancelBtn.disabled = false;
      saveBtn.disabled = false;
      if (err instanceof OverCapError) {
        showError(errorRow,
          "Storage full — remove items or another player's gear before saving.");
      } else {
        showError(errorRow, "Couldn't save — try again.");
      }
      console.warn("[customs] save failed", err);
    }
  };

  active = back;
  document.addEventListener("keydown", onKeydown);
  // Focus first field for keyboard users.
  setTimeout(() => nameInput.focus(), 0);
}

export function closeCustomsDialog(): void {
  if (active) active.remove();
  active = null;
  document.removeEventListener("keydown", onKeydown);
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") closeCustomsDialog();
}

function showError(row: HTMLElement, msg: string): void {
  row.textContent = msg;
  row.style.display = "block";
}

interface InputOpts {
  required?: boolean;
  maxLength?: number;
  initial?: string;
  placeholder?: string;
}

function labeledInput(
  parent: HTMLElement, label: string, name: string, opts: InputOpts,
): HTMLInputElement {
  const wrap = document.createElement("label");
  wrap.className = "customs-field";
  const span = document.createElement("span");
  span.className = "customs-label";
  span.textContent = opts.required ? `${label} *` : label;
  wrap.appendChild(span);
  const inp = document.createElement("input");
  inp.className = "customs-input";
  inp.type = "text";
  inp.name = name;
  if (opts.maxLength) inp.maxLength = opts.maxLength;
  if (opts.required) inp.required = true;
  if (opts.placeholder) inp.placeholder = opts.placeholder;
  inp.value = opts.initial ?? "";
  wrap.appendChild(inp);
  parent.appendChild(wrap);
  return inp;
}

interface ComboOpts extends InputOpts {
  options: string[];
}

function labeledCombobox(
  parent: HTMLElement, label: string, name: string, opts: ComboOpts,
): HTMLInputElement {
  const inp = labeledInput(parent, label, name, opts);
  const listId = `customs-${name}-options-${Math.random().toString(36).slice(2, 8)}`;
  inp.setAttribute("list", listId);
  const datalist = document.createElement("datalist");
  datalist.id = listId;
  for (const v of opts.options) {
    const o = document.createElement("option");
    o.value = v;
    datalist.appendChild(o);
  }
  inp.parentElement!.appendChild(datalist);
  return inp;
}

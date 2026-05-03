import { describe, it, expect, beforeEach, vi } from "vitest";
import { showOverlay, closeOverlay, setOverlayDescription, setOverlayState } from "../src/ui-overlay";

describe("ui-overlay", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("shows description and cancel button on showOverlay", () => {
    showOverlay({ description: "Working…", onCancel: () => {} });
    expect(document.querySelector(".atomic-overlay__text")?.textContent).toBe("Working…");
    expect(document.querySelector(".atomic-overlay__cancel")).toBeTruthy();
  });

  it("calls onCancel when cancel button clicked", () => {
    const onCancel = vi.fn();
    showOverlay({ description: "Working…", onCancel });
    (document.querySelector(".atomic-overlay__cancel") as HTMLButtonElement).click();
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel on Escape keydown", () => {
    const onCancel = vi.fn();
    showOverlay({ description: "Working…", onCancel });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("setOverlayDescription updates the visible text", () => {
    showOverlay({ description: "Working…", onCancel: () => {} });
    setOverlayDescription("Waiting on Bob…");
    expect(document.querySelector(".atomic-overlay__text")?.textContent).toBe("Waiting on Bob…");
  });

  it("setOverlayState 'cancelling' disables the cancel button and updates text", () => {
    showOverlay({ description: "Working…", onCancel: () => {} });
    setOverlayState("cancelling");
    const btn = document.querySelector(".atomic-overlay__cancel") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("closeOverlay removes the overlay and backdrop", () => {
    showOverlay({ description: "Working…", onCancel: () => {} });
    closeOverlay();
    expect(document.querySelector(".atomic-overlay")).toBeNull();
    expect(document.querySelector(".atomic-overlay-backdrop")).toBeNull();
  });

  it("closeOverlay clears the Escape listener", () => {
    const onCancel = vi.fn();
    showOverlay({ description: "Working…", onCancel });
    closeOverlay();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onCancel).not.toHaveBeenCalled();
  });
});

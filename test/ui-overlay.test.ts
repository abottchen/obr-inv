import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  showOverlay,
  closeOverlay,
  setOverlayDescription,
  setOverlayState,
  GRACE_MS,
  MIN_VISIBLE_MS,
} from "../src/ui-overlay";

describe("ui-overlay", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });
  afterEach(() => {
    closeOverlay();
    vi.runAllTimers();
    vi.useRealTimers();
  });

  describe("phase 1 — invisible block", () => {
    it("inserts the backdrop immediately to block input", () => {
      showOverlay({ description: "Working…", onCancel: () => {} });
      expect(document.querySelector(".atomic-overlay-backdrop")).toBeTruthy();
    });

    it("does not render the spinner popup before the grace period elapses", () => {
      showOverlay({ description: "Working…", onCancel: () => {} });
      vi.advanceTimersByTime(GRACE_MS - 1);
      expect(document.querySelector(".atomic-overlay")).toBeNull();
      expect(document.querySelector(".atomic-overlay__spinner")).toBeNull();
    });

    it("calls onCancel on Escape during the grace period", () => {
      const onCancel = vi.fn();
      showOverlay({ description: "Working…", onCancel });
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe("phase 2 — visible spinner", () => {
    it("renders the popup with description, spinner, and cancel after the grace period", () => {
      showOverlay({ description: "Working…", onCancel: () => {} });
      vi.advanceTimersByTime(GRACE_MS);
      expect(document.querySelector(".atomic-overlay__text")?.textContent).toBe("Working…");
      expect(document.querySelector(".atomic-overlay__spinner")).toBeTruthy();
      expect(document.querySelector(".atomic-overlay__cancel")).toBeTruthy();
    });

    it("renders the latest description when it was updated during grace", () => {
      showOverlay({ description: "Working…", onCancel: () => {} });
      setOverlayDescription("Waiting on Bob…");
      vi.advanceTimersByTime(GRACE_MS);
      expect(document.querySelector(".atomic-overlay__text")?.textContent).toBe("Waiting on Bob…");
    });

    it("calls onCancel when the cancel button is clicked", () => {
      const onCancel = vi.fn();
      showOverlay({ description: "Working…", onCancel });
      vi.advanceTimersByTime(GRACE_MS);
      (document.querySelector(".atomic-overlay__cancel") as HTMLButtonElement).click();
      expect(onCancel).toHaveBeenCalled();
    });

    it("setOverlayDescription updates visible text after the popup is shown", () => {
      showOverlay({ description: "Working…", onCancel: () => {} });
      vi.advanceTimersByTime(GRACE_MS);
      setOverlayDescription("Waiting on Bob…");
      expect(document.querySelector(".atomic-overlay__text")?.textContent).toBe("Waiting on Bob…");
    });

    it("setOverlayState 'cancelling' disables the cancel button", () => {
      showOverlay({ description: "Working…", onCancel: () => {} });
      vi.advanceTimersByTime(GRACE_MS);
      setOverlayState("cancelling");
      const btn = document.querySelector(".atomic-overlay__cancel") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  describe("close behavior", () => {
    it("close before grace removes the backdrop and never renders the popup", () => {
      showOverlay({ description: "Working…", onCancel: () => {} });
      closeOverlay();
      expect(document.querySelector(".atomic-overlay-backdrop")).toBeNull();
      vi.advanceTimersByTime(GRACE_MS + 100);
      expect(document.querySelector(".atomic-overlay")).toBeNull();
      expect(document.querySelector(".atomic-overlay-backdrop")).toBeNull();
    });

    it("close inside the min-visible window defers teardown until min-visible elapses", () => {
      showOverlay({ description: "Working…", onCancel: () => {} });
      vi.advanceTimersByTime(GRACE_MS);
      closeOverlay();
      expect(document.querySelector(".atomic-overlay")).toBeTruthy();
      vi.advanceTimersByTime(MIN_VISIBLE_MS - 1);
      expect(document.querySelector(".atomic-overlay")).toBeTruthy();
      vi.advanceTimersByTime(1);
      expect(document.querySelector(".atomic-overlay")).toBeNull();
      expect(document.querySelector(".atomic-overlay-backdrop")).toBeNull();
    });

    it("close after min-visible has elapsed removes everything immediately", () => {
      showOverlay({ description: "Working…", onCancel: () => {} });
      vi.advanceTimersByTime(GRACE_MS + MIN_VISIBLE_MS + 10);
      closeOverlay();
      expect(document.querySelector(".atomic-overlay")).toBeNull();
      expect(document.querySelector(".atomic-overlay-backdrop")).toBeNull();
    });

    it("close clears the Escape listener immediately even when teardown is deferred", () => {
      const onCancel = vi.fn();
      showOverlay({ description: "Working…", onCancel });
      vi.advanceTimersByTime(GRACE_MS);
      closeOverlay();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(onCancel).not.toHaveBeenCalled();
    });

    it("a new showOverlay during a deferred close hard-resets the lingering popup", () => {
      showOverlay({ description: "First", onCancel: () => {} });
      vi.advanceTimersByTime(GRACE_MS);
      closeOverlay();
      // Mid deferred close — start a new overlay
      showOverlay({ description: "Second", onCancel: () => {} });
      // Old popup should be gone, new one should be in phase 1 (no popup yet)
      expect(document.querySelectorAll(".atomic-overlay").length).toBe(0);
      expect(document.querySelector(".atomic-overlay-backdrop")).toBeTruthy();
      vi.advanceTimersByTime(GRACE_MS);
      expect(document.querySelector(".atomic-overlay__text")?.textContent).toBe("Second");
    });
  });
});

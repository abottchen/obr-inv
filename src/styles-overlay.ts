export const OVERLAY_CSS = `
.atomic-overlay-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(20, 16, 11, 0.55);
  z-index: 9000;
  pointer-events: all;
}
.atomic-overlay-backdrop--invisible {
  background: transparent;
}
.atomic-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 18px 22px;
  min-width: 280px;
  max-width: 80%;
  z-index: 9001;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}
.atomic-overlay__spinner {
  width: 28px; height: 28px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: atomic-spin 0.8s linear infinite;
}
@keyframes atomic-spin {
  to { transform: rotate(360deg); }
}
.atomic-overlay__text {
  color: var(--text);
  text-align: center;
  font-family: var(--font-body);
  font-size: 14px;
}
.atomic-overlay__cancel {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-family: var(--font-body);
}
.atomic-overlay__cancel:hover {
  border-color: var(--accent);
  color: var(--text);
}
.atomic-overlay__cancel:disabled {
  opacity: 0.5;
  cursor: default;
}
`;

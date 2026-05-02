export const FEEDBACK_CSS = `
.inv-row { position: relative; }
.inv-delta {
  position: absolute; right: 0; top: -2px;
  font-size: 11px; font-weight: 700; pointer-events: none;
  opacity: 0;
}
.inv-delta:empty { display: none; }

/* Standard glow (inc / add positive, dec negative) */
.inv-row[data-pulse="inc"], .inv-row[data-pulse="add"] {
  animation: feedback-glow 700ms ease-out;
}
.inv-row[data-pulse="dec"] {
  animation: feedback-glow-neg 700ms ease-out;
}
@keyframes feedback-glow {
  0%   { box-shadow: none; }
  25%  { box-shadow: 0 0 0 2px var(--accent), 0 0 16px rgba(124,77,255,0.5); }
  100% { box-shadow: none; }
}
@keyframes feedback-glow-neg {
  0%   { box-shadow: none; }
  25%  { box-shadow: 0 0 0 2px var(--warn), 0 0 14px rgba(252,211,77,0.3); }
  100% { box-shadow: none; }
}

/* Count pulse */
.inv-row[data-pulse="inc"] .inv-count,
.inv-row[data-pulse="add"] .inv-count,
.inv-row[data-pulse="received"] .inv-count {
  animation: feedback-count-pos 500ms ease-out;
}
.inv-row[data-pulse="dec"] .inv-count {
  animation: feedback-count-neg 500ms ease-out;
}
@keyframes feedback-count-pos {
  0%   { transform: scale(1); }
  20%  { color: #fff; text-shadow: 0 0 10px var(--accent); transform: scale(1.18); }
  100% { transform: scale(1); }
}
@keyframes feedback-count-neg {
  0%   { transform: scale(1); }
  20%  { color: var(--warn); transform: scale(0.88); }
  100% { transform: scale(1); }
}

/* Floating delta */
.inv-row[data-pulse="inc"] .inv-delta,
.inv-row[data-pulse="add"] .inv-delta,
.inv-row[data-pulse="received"] .inv-delta {
  animation: feedback-float 800ms ease-out;
  color: var(--accent);
}
.inv-row[data-pulse="dec"] .inv-delta {
  animation: feedback-float 800ms ease-out;
  color: var(--warn);
}
@keyframes feedback-float {
  0%   { opacity: 0; transform: translateY(0); }
  20%  { opacity: 1; }
  100% { opacity: 0; transform: translateY(-18px); }
}

/* Received (louder) */
.inv-row[data-pulse="received"] {
  animation: feedback-glow-louder 1500ms ease-out;
}
.inv-row[data-pulse="received"] .inv-name {
  animation: feedback-name-flash 1500ms ease-out;
}
@keyframes feedback-glow-louder {
  0%   { box-shadow: none; }
  15%  { box-shadow: 0 0 0 2px var(--accent), 0 0 20px rgba(124,77,255,0.7); }
  35%  { box-shadow: 0 0 0 1px rgba(124,77,255,0.3), 0 0 8px rgba(124,77,255,0.2); }
  55%  { box-shadow: 0 0 0 2px var(--accent), 0 0 16px rgba(124,77,255,0.55); }
  100% { box-shadow: none; }
}
@keyframes feedback-name-flash {
  0%   { color: inherit; }
  15%  { color: #fff; text-shadow: 0 0 6px rgba(124,77,255,0.5); }
  100% { color: inherit; }
}

/* Add: layer collapse-in onto the standard glow */
.inv-row[data-pulse="add"] {
  animation:
    feedback-glow 700ms ease-out,
    feedback-row-enter 350ms ease-out;
}
@keyframes feedback-row-enter {
  0%   {
    max-height: 0; opacity: 0;
    padding-top: 0; padding-bottom: 0;
    margin-top: 0; margin-bottom: 0;
    transform: translateY(-4px);
  }
  100% {
    max-height: 60px; opacity: 1;
    transform: translateY(0);
  }
}

/* Remove: pulse-then-collapse, hold final state */
.inv-row[data-pulse="remove"] {
  animation: feedback-row-leave 400ms ease-in forwards;
  overflow: hidden;
}
@keyframes feedback-row-leave {
  0% {
    max-height: 60px; opacity: 1;
    box-shadow: 0 0 0 2px var(--warn), 0 0 14px rgba(252,211,77,0.3);
  }
  25% {
    max-height: 60px; opacity: 1;
  }
  100% {
    max-height: 0; opacity: 0;
    padding-top: 0; padding-bottom: 0;
    margin-top: 0; margin-bottom: 0;
    box-shadow: none;
  }
}

/* Reduced motion: drop transforms, keep informational color */
@media (prefers-reduced-motion: reduce) {
  .inv-row[data-pulse] { animation-duration: 0ms !important; }
  .inv-row[data-pulse="received"] {
    animation: feedback-glow-louder 800ms ease-out !important;
  }
  .inv-row[data-pulse="received"] .inv-name { animation: none !important; }
  .inv-row[data-pulse="inc"] .inv-count,
  .inv-row[data-pulse="add"] .inv-count,
  .inv-row[data-pulse="received"] .inv-count {
    animation: feedback-color-pos 350ms ease-out !important;
  }
  .inv-row[data-pulse="dec"] .inv-count {
    animation: feedback-color-neg 350ms ease-out !important;
  }
  .inv-delta { display: none !important; }
}
@keyframes feedback-color-pos {
  0%   { color: inherit; }
  20%  { color: var(--accent); }
  100% { color: inherit; }
}
@keyframes feedback-color-neg {
  0%   { color: inherit; }
  20%  { color: var(--warn); }
  100% { color: inherit; }
}
`;

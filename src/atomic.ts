export function parseWriter(w: string): { playerId: string | null; nonce: string } {
  const colon = w.indexOf(":");
  if (colon < 0) return { playerId: null, nonce: w };
  return { playerId: w.slice(0, colon), nonce: w.slice(colon + 1) };
}

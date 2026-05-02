import { isSafeIconUrl } from "./escape";

// Catalog icons (e.g. 5e.tools weapons) are often markedly non-square. With
// object-fit:contain in a square host, a 2:1 scimitar renders at 100% × 50%,
// leaving the silhouette small and surrounded by empty space. Rotating 45°
// places the long axis on the host's diagonal, which both reads as more
// substantial and — for ratios past ~2.4:1 — actually increases the rendered
// pixel size. Scale = √2·R/(R+1) is the largest factor that keeps the rotated
// bounding box inside the host.
const ROTATE_THRESHOLD = 1.4;

export function appendIconImage(
  host: HTMLElement, url: string,
): HTMLImageElement | null {
  if (!isSafeIconUrl(url)) return null;
  const img = document.createElement("img");
  img.className = "icon-img";
  img.alt = "";
  img.decoding = "async";
  img.loading = "lazy";
  img.addEventListener("load", () => fitNonSquareIcon(img), { once: true });
  img.src = url;
  host.appendChild(img);
  return img;
}

function fitNonSquareIcon(img: HTMLImageElement): void {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return;
  const ratio = w / h;
  if (ratio > ROTATE_THRESHOLD) {
    const scale = (Math.SQRT2 * ratio) / (ratio + 1);
    img.style.transform = `rotate(-45deg) scale(${scale.toFixed(3)})`;
  } else if (ratio < 1 / ROTATE_THRESHOLD) {
    const inv = 1 / ratio;
    const scale = (Math.SQRT2 * inv) / (inv + 1);
    img.style.transform = `rotate(45deg) scale(${scale.toFixed(3)})`;
  }
}

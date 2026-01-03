// modules/images.js
import { getImageBlob, putImageBlob } from "./imageStore.js";

// Endast format du faktiskt använder
export const IMAGE_EXTS = [".jpg", ".jpeg"];

// ===== Naming conventions (SINGLE SOURCE OF TRUTH)
export function imageNameCandidates(fullName) {
  const s = String(fullName ?? "").trim().replace(/\s+/g, " ");
  if (!s) return [];

  const parts = s.split(" ");
  const out = [];

  out.push(s); // full name
  if (parts.length >= 2) out.push(parts.slice(0, 2).join(" "));
  out.push(parts[0]); // first name

  return [...new Set(out)];
}

// (valfritt) hjälpa: sätt src och undvik objectURL-läckor
function setObjectUrl(imgEl, blob) {
  try {
    if (imgEl.__objectUrl) URL.revokeObjectURL(imgEl.__objectUrl);
  } catch {}
  const url = URL.createObjectURL(blob);
  imgEl.__objectUrl = url;
  imgEl.src = url;
}

// ===== Unified image setter (OneDrive + IndexedDB cache)
export async function setImgForNpc({
  imgEl,
  npc,
  imageResolver = null,
  onImageRefResolved = null,
}) {
  imgEl.classList.remove("missing");
  imgEl.alt = npc?.Name || "";

  // 0) Om NPC redan har en sparad ref: försök visa från IndexedDB direkt
  const ref0 = npc?.imageRef;
  if (ref0?.driveId && ref0?.itemId) {
    const cacheKey = `${ref0.driveId}:${ref0.itemId}`;
    const cachedBlob = await getImageBlob(cacheKey);
    if (cachedBlob) {
      setObjectUrl(imgEl, cachedBlob);
      return;
    }
    // annars fall back till resolver (om finns)
  }

  // 1) Utan resolver kan vi inte hämta nya bilder
  const canResolve =
    typeof imageResolver?.getNpcImageRef === "function" &&
    typeof imageResolver?.getDownloadUrlByItemId === "function";

  if (!canResolve) {
    imgEl.removeAttribute("src");
    imgEl.classList.add("missing");
    return;
  }

  // 2) Resolver finns: hitta ref (driveId+itemId), cachea blob, spara ref på npc
  const origin = npc?.Origin || "";
  const names = imageNameCandidates(npc?.Name);

  for (const name of names) {
    try {
      const ref = await imageResolver.getNpcImageRef(origin, name);
      if (!ref?.driveId || !ref?.itemId) continue;

      // Spara ref på NPC (så den kan cachas i localStorage)
      npc.imageRef = { driveId: ref.driveId, itemId: ref.itemId };
      if (typeof onImageRefResolved === "function") onImageRefResolved(npc);

      const cacheKey = `${ref.driveId}:${ref.itemId}`;

      // 2a) Har vi blob redan?
      const cachedBlob = await getImageBlob(cacheKey);
      if (cachedBlob) {
        setObjectUrl(imgEl, cachedBlob);
        return;
      }

      // 2b) Hämta blob och lägg i IndexedDB
      const url = await imageResolver.getDownloadUrlByItemId(ref.itemId);
      if (!url) continue;

      const res = await fetch(url);
      if (!res.ok) continue;

      const blob = await res.blob();
      await putImageBlob(cacheKey, blob);

      setObjectUrl(imgEl, blob);
      return;
    } catch {
      // prova nästa kandidat
    }
  }

  // Ingen bild hittades
  imgEl.removeAttribute("src");
  imgEl.classList.add("missing");
}

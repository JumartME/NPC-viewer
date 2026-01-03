// modules/images.js

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

  // unika, i ordning
  return [...new Set(out)];
}

// ===== Bygger lokala bild-URL:er (oförändrat beteende)
export function imageUrlsForNpc(npc) {
  const urls = [];
  const names = imageNameCandidates(npc.Name);

  for (const name of names) {
    for (const ext of IMAGE_EXTS) {
      if (npc.Origin) {
        urls.push(`./img/${npc.Origin}/${name}${ext}`);
      } else {
        urls.push(`./img/${name}${ext}`);
      }
    }
  }

  return urls.map(encodeURI);
}

// ===== Klassisk fallback med onerror (din gamla logik, samlad)
export function setImgWithFallback(imgEl, urls, altText = "") {
  let i = 0;
  imgEl.alt = altText;
  imgEl.classList.remove("missing");

  imgEl.onerror = () => {
    if (i >= urls.length) {
      imgEl.removeAttribute("src");
      imgEl.classList.add("missing");
      return;
    }
    imgEl.src = urls[i++];
  };

  // starta
  imgEl.onerror();
}

// ===== Unified image setter (lokal ELLER OneDrive)
export async function setImgForNpc({ imgEl, npc, imageResolver = null }) {
  imgEl.classList.remove("missing");
  imgEl.alt = npc?.Name || "";

  // Om ingen resolver: visa missing direkt (ingen lokal URL, ingen fetch)
  if (!imageResolver?.getNpcImageUrl) {
    imgEl.removeAttribute("src");
    imgEl.classList.add("missing");
    return;
  }

  const names = imageNameCandidates(npc.Name);
  for (const name of names) {
    try {
      const url = await imageResolver.getNpcImageUrl(npc.Origin, name);
      if (url) {
        imgEl.src = url;
        return;
      }
    } catch {
      // ignore, prova nästa kandidat
    }
  }

  // Fanns ingen bild i OneDrive
  imgEl.removeAttribute("src");
  imgEl.classList.add("missing");
}

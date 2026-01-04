// modules/images.js
import { getImageBlob, putImageBlob } from "./imageStore.js";


// ---- OneDrive image download queue + stats (for 1000+ NPCs) ----
const IMG_STATS = (window.__imgStats ||= {
  queued: 0,
  inFlight: 0,
  loaded: 0,
  failed: 0,
  missing:0,
  lastError: null,
});

function bumpStatus() {
  // overlay
  const overlay = document.getElementById("imgProgressOverlay");
  const textEl = document.getElementById("imgProgressText");

  const active = (IMG_STATS.queued + IMG_STATS.inFlight) > 0;

  if (overlay) {
    overlay.classList.toggle("hidden", !active);
  }

  const lines = [
    `Loaded: ${IMG_STATS.loaded}`,
    `Failed: ${IMG_STATS.failed}`,
    `Missing: ${IMG_STATS.missing}`,
    `In-flight: ${IMG_STATS.inFlight}`,
    `Queued: ${IMG_STATS.queued}`,
  ];

  if (IMG_STATS.lastError) lines.push(`Last error: ${IMG_STATS.lastError}`);

  const msg = lines.join("\n");

  if (textEl) textEl.textContent = msg;

  // (valfritt) uppdatera även din vanliga statusrad om du vill
  const statusEl = document.getElementById("status");
  if (statusEl && active) {
    statusEl.textContent = `Images: ${IMG_STATS.loaded} loaded, ${IMG_STATS.failed} failed, ${IMG_STATS.missing} missing, ${IMG_STATS.inFlight} in-flight, ${IMG_STATS.queued} queued`;
  }
}

// Enkel semaphore för att begränsa samtidiga fetches
function createSemaphore(limit = 6) {
  let active = 0;
  const queue = [];
  const runNext = () => {
    if (active >= limit) return;
    const job = queue.shift();
    if (!job) return;
    active++;
    IMG_STATS.inFlight = active;
    bumpStatus();
    Promise.resolve()
      .then(job.fn)
      .then(job.resolve, job.reject)
      .finally(() => {
        active--;
        IMG_STATS.inFlight = active;
        bumpStatus();
        runNext();
      });
  };
  return {
    enqueue(fn) {
      IMG_STATS.queued++;
      bumpStatus();
      return new Promise((resolve, reject) => {
        queue.push({
          fn: async () => {
            IMG_STATS.queued--;
            bumpStatus();
            return fn();
          },
          resolve,
          reject,
        });
        runNext();
      });
    },
  };
}

const onedriveSemaphore = createSemaphore(6);

// Retry med backoff vid 429/503 (Graph throttling)
async function fetchWithRetry(url, opts = {}, tries = 4) {
  let lastErr = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, opts);
      if (res.status === 429 || res.status === 503) {
        const ra = res.headers.get("Retry-After");
        const waitMs = ra ? (Number(ra) * 1000) : (500 * Math.pow(2, attempt));
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt)));
    }
  }
  throw lastErr || new Error("fetch failed after retries");
}


// Endast format du faktiskt använder
export const IMAGE_EXTS = [".jpg", ".jpeg", ".png"];

// ===== Token helpers for multi-image matching
function stripDiacritics(s) {
  try {
    return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    return s;
  }
}

export function tokenizeForImage(s) {
  return stripDiacritics(String(s ?? ""))
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(/[\s_-]+/g)
    .filter(Boolean);
}

function stripExt(fileName) {
  const s = String(fileName ?? "");
  return s.replace(/\.(jpg|jpeg|png)$/i, "");
}

function startsWithTokens(haystack, needle) {
  if (!needle?.length) return false;
  if (!haystack || haystack.length < needle.length) return false;
  for (let i = 0; i < needle.length; i++) {
    if (haystack[i] !== needle[i]) return false;
  }
  return true;
}

// Match ALL filenames (within an Origin folder) that belong to an NPC.
// Returns filenames sorted with "primary" first.
export function matchImageFileNames(fileNames = [], npcName = "") {
  const npcTokens = tokenizeForImage(npcName);
  if (!npcTokens.length) return [];

  // 1 token: match first token; >1 tokens: match full prefix
  const needle = npcTokens.length === 1 ? [npcTokens[0]] : npcTokens;

  const matches = [];
  for (const fn of fileNames) {
    const base = stripExt(fn);
    const tokens = tokenizeForImage(base);
    if (startsWithTokens(tokens, needle)) {
      matches.push({ fileName: fn, tokens });
    }
  }

  // primary first: shortest token count first, then filename
  matches.sort((a, b) => {
    const d = a.tokens.length - b.tokens.length;
    if (d !== 0) return d;
    return a.fileName.localeCompare(b.fileName);
  });

  return matches.map((m) => m.fileName);
}

// ===== Naming conventions (SINGLE SOURCE OF TRUTH)
export function imageNameCandidates(fullName) {
  const s = String(fullName ?? "").trim().replace(/\s+/g, " ");
  if (!s) return [];
  const parts = s.split(" ");
  const out = [s];
  if (parts.length >= 2) out.push(parts.slice(0, 2).join(" "));
  out.push(parts[0]);
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

// ===== Resolve images for an NPC (multi-image aware)
export async function ensureNpcImages({
  npc,
  imageResolver = null,
  onImageRefResolved = null,
} = {}) {
  if (!npc) return { images: [], primary: null };

  if (Array.isArray(npc._images) && npc._primaryImage) {
    return { images: npc._images, primary: npc._primaryImage };
  }

  const origin = npc?.Origin || "";
  const name = npc?.Name || "";

  // === Local-folder resolver ===
  if (imageResolver?.getNpcImageUrls && imageResolver?.kind === "local-folder") {
    const urls = await imageResolver.getNpcImageUrls(origin, name);
    const images = (urls || []).map((url) => ({ kind: "local", url }));
    const primary = images[0] || null;
    npc._images = images;
    npc._primaryImage = primary;
    return { images, primary };
  }

  // Back-compat local: single url
  if (imageResolver?.getNpcImageUrl && imageResolver?.kind === "local-folder") {
    const url = await imageResolver.getNpcImageUrl(origin, name);
    const images = url ? [{ kind: "local", url }] : [];
    const primary = images[0] || null;
    npc._images = images;
    npc._primaryImage = primary;
    return { images, primary };
  }

  // === OneDrive resolver ===
  const canResolveOneDrive =
    !!imageResolver?.getDownloadUrlByItemId &&
    (!!imageResolver?.getNpcImageRefs || !!imageResolver?.getNpcImageRef);

  if (!canResolveOneDrive) {
    npc._images = [];
    npc._primaryImage = null;
    return { images: [], primary: null };
  }

  // Prefer multi-ref API
  let refs = [];
  if (imageResolver?.getNpcImageRefs) {
    refs = await imageResolver.getNpcImageRefs(origin, name);
  } else {
    // back-compat: try name candidates one-by-one
    const names = imageNameCandidates(name);
    for (const n of names) {
      const ref = await imageResolver.getNpcImageRef(origin, n);
      if (ref?.driveId && ref?.itemId) {
        refs = [ref];
        break;
      }
    }
  }

  const images = (refs || [])
    .filter((r) => r?.driveId && r?.itemId)
    .map((r) => ({
      kind: "onedrive",
      driveId: r.driveId,
      itemId: r.itemId,
      fileName: r.fileName || "",
    }));

  const primary = images[0] || null;
  npc._images = images;
  npc._primaryImage = primary;

  // Keep old single imageRef for export/backwards compatibility (primary only)
  if (primary?.kind === "onedrive") {
    npc.imageRef = { driveId: primary.driveId, itemId: primary.itemId };
    onImageRefResolved?.(npc);
  }

  return { images, primary };
}

export async function setImgForImageEntry({
  imgEl,
  entry,
  imageResolver = null,
} = {}) {
  imgEl.classList.remove("missing");

  if (!entry) {
    imgEl.removeAttribute("src");
    imgEl.classList.add("missing");
    return;
  }

  // Local url
  if (entry.kind === "local") {
    imgEl.src = entry.url;
    return;
  }

  // OneDrive item -> IndexedDB cached blob -> downloadUrl -> fetch -> cache
  if (entry.kind === "onedrive") {
    if (!entry.driveId || !entry.itemId) {
      IMG_STATS.missing++;
      IMG_STATS.lastError = "Missing driveId/itemId on OneDrive entry";
      bumpStatus();
      imgEl.removeAttribute("src");
      imgEl.classList.add("missing");
      return;
    }

    const cacheKey = `${entry.driveId}:${entry.itemId}`;

    const cachedBlob = await getImageBlob(cacheKey);
    if (cachedBlob) {
      setObjectUrl(imgEl, cachedBlob);
      return;
    }

    if (!imageResolver?.getDownloadUrlByItemId) {
      IMG_STATS.missing++
      bumpStatus();
      imgEl.removeAttribute("src");
      imgEl.classList.add("missing");
      return;
    }

    const url = await imageResolver.getDownloadUrlByItemId(entry.itemId);
    if (!url) {
      IMG_STATS.missing++;
      bumpStatus();
      imgEl.removeAttribute("src");
      imgEl.classList.add("missing");
      return;
    }

    let res;
    try {
      res = await onedriveSemaphore.enqueue(() => fetchWithRetry(url));
    } catch (e) {
      IMG_STATS.failed++;
      IMG_STATS.lastError = `${res.status} ${res.statusText}`;
      bumpStatus();
      imgEl.removeAttribute("src");
      imgEl.classList.add("missing");
      return;
    }

    const blob = await res.blob();
    await putImageBlob(cacheKey, blob);
    setObjectUrl(imgEl, blob);
    IMG_STATS.loaded++;
    bumpStatus();
    return;
  }

  imgEl.removeAttribute("src");
  imgEl.classList.add("missing");
}

// Backwards-compatible: sets PRIMARY image for an NPC
export async function setImgForNpc({
  imgEl,
  npc,
  imageResolver = null,
  onImageRefResolved = null,
} = {}) {
  imgEl.alt = npc?.Name || "";
  const { primary } = await ensureNpcImages({ npc, imageResolver, onImageRefResolved });
  await setImgForImageEntry({ imgEl, entry: primary, imageResolver });
}

export async function loadNpcPrimaryIntoImg({ imgEl, npc, imageResolver, onImageRefResolved }) {
  // Förhindra dubbel-laddning
  if (imgEl.dataset.imgLoaded === "1") return;
  imgEl.dataset.imgLoaded = "1";

  await setImgForNpc({ imgEl, npc, imageResolver, onImageRefResolved });
}

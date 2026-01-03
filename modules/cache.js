// modules/cache.js
// Ansvar: localStorage-cache för NPC-data

export const CACHE_KEY = "npcviewer:singlefile:v1";

export function saveCache(obj) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
}

export function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearCache() {
  localStorage.removeItem(CACHE_KEY);
}

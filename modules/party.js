// modules/party.js
// Ansvar: party-state i localStorage + helpers

export const PARTY_KEY = "npcviewer:party:v1";

// ---- Storage helpers
export function loadPartyIds() {
  try {
    const raw = localStorage.getItem(PARTY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePartyIds(ids) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  localStorage.setItem(PARTY_KEY, JSON.stringify(unique));
}

// ---- Queries
export function inParty(npcId) {
  return loadPartyIds().includes(npcId);
}

// ---- Mutations
export function addToParty(npcId) {
  const ids = loadPartyIds();
  if (ids.includes(npcId)) return;
  savePartyIds([...ids, npcId]);
}

export function removeFromParty(npcId) {
  const ids = loadPartyIds();
  savePartyIds(ids.filter((x) => x !== npcId));
}

export function clearPartyAll() {
  savePartyIds([]);
}

// ---- UI helper (ren, inga DOM-refs hårdkodade)
export function updatePartyCount({ countEl, subtitleEl } = {}) {
  const ids = loadPartyIds();
  if (countEl) countEl.textContent = String(ids.length);
  if (subtitleEl) {
    subtitleEl.textContent = `${ids.length} member${ids.length === 1 ? "" : "s"}`;
  }
}

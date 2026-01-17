// modules/partiesStore.js

const PARTIES_KEY = "npcviewer.parties";

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(PARTIES_KEY)) || [];
  } catch {
    return [];
  }
}

function saveAll(parties) {
  localStorage.setItem(PARTIES_KEY, JSON.stringify(parties));
}

export function getParties() {
  return loadAll();
}

export function saveParty({ id, name, npcIds }) {
  const parties = loadAll();
  const now = new Date().toISOString();

  const idx = parties.findIndex(p => p.id === id);
  const party = { id, name, npcIds, updatedAt: now };

  if (idx >= 0) parties[idx] = party;
  else parties.push(party);

  saveAll(parties);
  return party;
}

export function deleteParty(id) {
  const parties = loadAll().filter(p => p.id !== id);
  saveAll(parties);
}

export function getParty(id) {
  return loadAll().find(p => p.id === id) || null;
}

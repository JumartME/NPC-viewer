// app.js
import { createOneDriveClient } from "./OneDrive/onedrive.js";

import {
  parseXlsxBuffer,
  rowsToJson,
} from "./modules/parse.js";

import {
  saveCache,
  loadCache,
  clearCache,
} from "./modules/cache.js";

import {
  clearPartyAll,
  updatePartyCount,
} from "./modules/party.js";

import {
  renderList,
  openNpcModal,
} from "./modules/render.js";

import { initActionUI } from "./modules/action.js";
import { initDiceUI } from "./modules/dice.js";
import { initPartyView } from "./modules/partyView.js";

import {
  initFiltersUI,
  matchesFilters,
  sortNpcs,
  wireRelationCheckboxes,
} from "./modules/filters.js";

import { clearImageStore } from "./modules/imageStore.js";


let actionUI = null;
let partyView = null;
window.__npc = window.__npc || {};

// === OneDrive (Personal / Consumer) ===
const ENTRA_CLIENT_ID = "8ae55991-a03a-4d52-b43c-5fb67ebe2ba6";

const oneDrive = createOneDriveClient({
  clientId: ENTRA_CLIENT_ID,
  pickerBaseUrl: "https://onedrive.live.com/picker",
});

// set after OneDrive load
let imageResolver = null;

function openNpc(npc) {
  openNpcModal({ npc, imageResolver, onImageRefResolved: scheduleSaveCache, onPartyChanged });
  actionUI?.setNpc?.(npc);
  
}
// ---------- DOM ----------
const els = {
  traitsGrid: document.getElementById("traitsGrid"),
  actChar: document.getElementById("actChar"),
  actSkill: document.getElementById("actSkill"),
  actRoll: document.getElementById("actRoll"),
  actResult: document.getElementById("actResult"),
  status: document.getElementById("status"),
  count: document.getElementById("count"),
  list: document.getElementById("list"),
  randomNpc: document.getElementById("randomNpc"),
  gender: document.getElementById("gender"),
  clear: document.getElementById("clear"),
  q: document.getElementById("q"),
  origin: document.getElementById("origin"),
  concept: document.getElementById("concept"),
  reputation: document.getElementById("reputation"),
  relAll: document.getElementById("relAll"),
  relationCbs: Array.from(document.querySelectorAll(".rel-cb")),
  sort: document.getElementById("sort"),
};

function setStatus(msg) {
  if (els.status) els.status.textContent = msg || "";
}

// ---------- DATA ----------
let dataset = [];
let view = [];


let saveTimer = null;

function scheduleSaveCache() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveCache({
      updatedAt: new Date().toISOString(),
      count: dataset.length,
      npcs: dataset,
    });
  }, 400);
}

// ---------- UI ----------
function onPartyChanged() {
  updatePartyCount({
    countEl: document.getElementById("partyCount"),
    subtitleEl: document.getElementById("partySubtitle"),
  });

  // uppdatera listknappar + eventuell öppen npc-modal
  render();

  // uppdatera party-modalen om den finns
  partyView?.render?.();
}

function render() {
  const filtered = dataset.filter((n) => matchesFilters({ els, npc: n }));
  view = sortNpcs({ els, arr: filtered });

  if (els.count) els.count.textContent = `${view.length} shown / ${dataset.length} total`;

  renderList({
    listEl: els.list,
    dataset: view,
    imageResolver,
    onOpenModal: (i) => openNpc(view[i]),
    onImageRefResolved: scheduleSaveCache,
    onPartyChanged,
  });

}

function applyData(json) {
  dataset = json?.npcs ? json.npcs : [];
  initFiltersUI({ els, dataset });

  render();

  window.__npc = window.__npc || {};
  window.__npc.dataset = dataset;
  window.__npc.view = view;
  window.__npc.imageResolver = imageResolver;

  if (json) setStatus(`Loaded ${json.count} NPCs (cached: ${json.updatedAt})`);
  else setStatus("No cached data. Load from OneDrive to begin.");
}


// ---------- WIRING ----------
wireRelationCheckboxes({ els, onChange: render });

updatePartyCount({
  countEl: document.getElementById("partyCount"),
  subtitleEl: document.getElementById("partySubtitle"),
});

document.getElementById("btnOneDrive")?.addEventListener("click", async () => {
  try {
    const url = prompt(
      "Klistra in OneDrive-länk till mappen (eller till data.xlsx):"
    );
    if (!url) return;

    const { json, imageResolver: resolver } =
    await oneDrive.loadFromOneDriveLink({
        shareUrl: url,
        parseXlsxBuffer,
        rowsToJson,
        setStatus,
    });

    imageResolver = resolver;   // <-- måste ske före applyData
    saveCache(json);
    applyData(json);
    partyView?.setImageResolver?.(imageResolver);

    setStatus(`Loaded ${json.count} NPCs from OneDrive ✔`);
  } catch (e) {
    console.error(e);
    alert(e?.message || String(e));
  }
});

document.getElementById("btnLogout")?.addEventListener("click", async () => {
  try { await oneDrive.logout(); alert("Logged out."); }
  catch (e) { console.error(e); alert("Logout failed.\n" + (e?.message || String(e))); }
});

els.clear?.addEventListener("click", async () => {
  clearCache();
  await clearImageStore();
  imageResolver = null;
  applyData(null);
});


[els.q, els.gender, els.origin, els.concept, els.reputation, els.sort].forEach((el) => {
  el?.addEventListener("input", render);
  el?.addEventListener("change", render);
});



const cached = loadCache();
applyData(cached);

initDiceUI();

// init action UI
actionUI = initActionUI();

// init party view
const findNpcById = (id) => dataset.find(n => n.id === id) || null;

partyView = initPartyView({
  clearPartyAllFn: clearPartyAll,
  getNpcById: findNpcById,
  imageResolver,
  onOpenNpc: (npc) => openNpc(npc),
  onPartyChanged,
});

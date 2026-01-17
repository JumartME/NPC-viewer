// app.js
import { createOneDriveClient } from "./OneDrive/onedrive.js";
import { saveRootHandle, loadRootHandle, ensureHandlePermission } from "./modules/fsHandleStore.js";
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

import { renderList, openNpcModal } from "./modules/render/index.js";

import { initActionUI } from "./modules/action.js";
import { initDiceUI } from "./modules/dice.js";
import { initPartyView } from "./modules/partyView.js";

import {
  initFiltersUI,
  matchesFilters,
  sortNpcs,
  wireRelationCheckboxes,
} from "./modules/filters.js";

import { initDataPanel } from "./modules/dataPanel.js";

import { clearImageStore } from "./modules/imageStore.js";

import { exportNpcsToXlsx } from "./modules/exportXlsx.js";

import { pickLocalRootFolder, loadBundleFromLocalFolder } from "./modules/localFolder.js";

let actionUI = null;
let partyView = null;
window.__npc = window.__npc || {};

// === OneDrive (Personal / Consumer) ===
const ENTRA_CLIENT_ID = "8ae55991-a03a-4d52-b43c-5fb67ebe2ba6";
const redirectUri = window.location.origin + window.location.pathname

const oneDrive = createOneDriveClient({
  clientId: ENTRA_CLIENT_ID,
  pickerBaseUrl: "https://onedrive.live.com/picker",
  redirectUri
});

// set after OneDrive load
let imageResolver = null;

async function tryReconnectLocalFolderAndReloadExcel() {
  try {
    const rootHandle = await loadRootHandle();
    if (!rootHandle) return false;

    // Kräver ofta att användaren redan gett permission tidigare
    const ok = await ensureHandlePermission(rootHandle, "read");
    if (!ok) return false;

    setStatus("Reloading local data.xlsx...");

    // ✅ Läs om Excel + bygg imageResolver igen
    const { json, imageResolver: resolver } = await loadBundleFromLocalFolder({
      rootHandle,
      parseXlsxBuffer,
      rowsToJson,
      setStatus,
    });

    // Sätt resolver + data
    setImageResolver(resolver);
    saveCache(json);
    applyData(json);
    partyView?.setImageResolver?.(resolver);
    onPartyChanged?.();

    setStatus(`Reloaded ${json.count} NPCs from local folder ✔`);
    return true;
  } catch (e) {
    console.warn("Local folder reload failed:", e);
    return false;
  }
}



function openNpc(npc) {
  openNpcModal({
    npc,
    imageResolver,
    onImageRefResolved: (npc) => scheduleSaveCache(),
    onPartyChanged,
    onNpcChanged: () => {
      scheduleSaveCache();
      render(); // uppdatera listan (namnfärg/pills osv)
    },
  });

  actionUI?.setNpc?.(npc);
}

// ---------- DOM ----------
const els = {
  charsGrid: document.getElementById("charsGrid"),
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
  group: document.getElementById("group"),
};

function setStatus(msg) {
  if (els.status) els.status.textContent = msg || "";
}

function pickRandomFrom(arr) {
  if (!arr || arr.length === 0) return null;
  const i = Math.floor(Math.random() * arr.length);
  return arr[i] ?? null;
}

function openRandomNpc() {
  // Välj från current view (dvs filtrerat/sorterat), annars hela datasetet
  const source = (view && view.length) ? view : dataset;
  const npc = pickRandomFrom(source);
  if (!npc) {
    alert("Inga NPCs att välja från ännu. Ladda data först.");
    return;
  }
  openNpc(npc);
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
document.getElementById("btnLocalFolder")?.addEventListener("click", async () => {
  try {
    const rootHandle = await pickLocalRootFolder();

    const { json, imageResolver: resolver } = await loadBundleFromLocalFolder({
      rootHandle,
      parseXlsxBuffer,
      rowsToJson,
      setStatus,
    });

    await saveRootHandle(rootHandle); // ✅ rätt

    imageResolver = resolver;
    saveCache(json);
    applyData(json);
    partyView?.setImageResolver?.(imageResolver);

    setStatus(`Loaded ${json.count} NPCs from local folder ✔`);
  } catch (e) {
    console.error(e);
    alert(e?.message || String(e));
  }
});

els.randomNpc?.addEventListener("click", openRandomNpc);


wireRelationCheckboxes({ els, onChange: render });

updatePartyCount({
  countEl: document.getElementById("partyCount"),
  subtitleEl: document.getElementById("partySubtitle"),
});

function onPartyChanged() {
  updatePartyCount({
    countEl: document.getElementById("partyCount"),
    subtitleEl: document.getElementById("partySubtitle"),
  });
  partyView?.render?.();
  render(); // uppdaterar Party+/In Party i listan
}

// Viktigt: panelen måste kunna sätta imageResolver + meddela partyView
function setImageResolver(r) {
  imageResolver = r;
  partyView?.setImageResolver?.(r);

  window.__npc = window.__npc || {};
  window.__npc.imageResolver = r;
}

function applyDataFromJson(json) {
  applyData(json);
}

const SKILL_KEYS = [
  "Arts","Athletics","Ballistics","Boating","Brawl","Communication","Crafting",
  "Culture","Domestics","Driving","Empathy","Games","Gymnastics","Insight",
  "Knowledge","Medicine","Melee","Navigation","Observation","Performance",
  "Piloting","Riding","Science","Stealth","Style","Survival","Technology"
];

initDataPanel({
  getDataset: () => dataset,
  getView: () => view,

  setStatus,
  applyDataFromJson,
  setImageResolver,
  onPartyChanged,

  oneDrive,
  parseXlsxBuffer,
  rowsToJson,
  saveCache,

  clearAll: async () => {
    clearCache();
    await clearImageStore();
    setImageResolver(null);
    applyDataFromJson(null);
    onPartyChanged();
  },

  exportNpcsToXlsx,
  skillKeys: SKILL_KEYS,
});


/*document.getElementById("btnOneDrive")?.addEventListener("click", async () => {
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
*/

[els.q, els.gender, els.origin, els.concept, els.reputation, els.group, els.sort].forEach((el) => {
  el?.addEventListener("input", render);
  el?.addEventListener("change", render);
});



const cached = loadCache();
applyData(cached);
tryReconnectLocalFolderAndReloadExcel();

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

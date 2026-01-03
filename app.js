// app.js
import { createOneDriveClient } from "./OneDrive/onedrive.js";
import {
  imageNameCandidates,
  setImgForNpc,
} from "./modules/images.js";

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
  inParty,
  addToParty,
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

let actionUI = null;
let partyView = null;
window.__npc = window.__npc || {};

// === OneDrive (Personal / Consumer) ===
const ENTRA_CLIENT_ID = "8ae55991-a03a-4d52-b43c-5fb67ebe2ba6";

const oneDrive = createOneDriveClient({
  clientId: "8ae55991-a03a-4d52-b43c-5fb67ebe2ba6",
  pickerBaseUrl: "https://onedrive.live.com/picker",
});

// set after OneDrive load
let imageResolver = null;

function openNpc(npc) {
  openNpcModal({ npc, imageResolver });
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
let modal = null;

const CHARACTERISTICS = [
  "Intelligence","Perception","Will","Wits",
  "Agility","Dexterity","Stamina","Strength",
  "Expression","Instinct","Presence","Wisdom"
];

// ---------- HELPERS ----------
function titleCase(s) { const t = clean(s); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : ""; }

function uniqueSorted(arr) {
  const s = new Set(arr.filter(Boolean));
  return Array.from(s).sort((a,b)=>a.localeCompare(b));
}
function setOptions(select, values, allLabel) {
  select.innerHTML = "";
  const all = document.createElement("option");
  all.value = "";
  all.textContent = allLabel;
  select.appendChild(all);
  values.forEach(v => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  });
}

function toNumber(v) {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// ---------- UI ----------
function nameClass(n) {
  if (n.Reputation === "Player") return "text-warning";
  if (n.Reputation === "Hostile") return "text-danger";
  if (n.Relation === "Recruited") return "text-success";
  if (n.Relation === "Met") return "text-primary";
  if (n.Relation === "Defeated") return "text-body-secondary";
  return "text-muted";
}

function initFilters() {
  setOptions(els.origin, uniqueSorted(dataset.map(n => n.Origin)), "All Origins");
  setOptions(els.reputation, ["Hostile","Friendly","Neutral","Player"], "All Reputation");
  setOptions(els.concept, uniqueSorted(dataset.map(n => n.Concept)), "All Concepts");
  setOptions(els.gender, uniqueSorted(dataset.map(n => n.Gender)), "All Genders");

  els.sort.innerHTML = "";
  [
    ["name_asc","Name (A–Z)"],
    ["name_desc","Name (Z–A)"],
    ["origin_asc","Origin (A–Z)"],
  ].forEach(([v,label]) => {
    const o = document.createElement("option");
    o.value = v; o.textContent = label;
    els.sort.appendChild(o);
  });
  els.sort.value = "name_asc";
}

function matches(n) {
  const q = els.q.value.trim().toLowerCase();
  const origin = els.origin.value;
  const rep = els.reputation.value;
  const concept = els.concept.value;
  const gender = els.gender.value;

  if (q && !n.Name.toLowerCase().includes(q)) return false;
  if (origin && n.Origin !== origin) return false;
  if (rep && n.Reputation !== rep) return false;
  if (concept && n.Concept !== concept) return false;
  if (gender && n.Gender !== gender) return false;

  if (!els.relAll.checked) {
    const selected = els.relationCbs.filter(cb => cb.checked).map(cb => cb.value);
    if (selected.length > 0 && !selected.includes(n.Relation)) return false;
  }
  return true;
}

function sortNpcs(arr) {
  const mode = els.sort.value;
  const copy = arr.slice();
  copy.sort((a,b)=>{
    if (mode === "name_asc") return a.Name.localeCompare(b.Name);
    if (mode === "name_desc") return b.Name.localeCompare(a.Name);
    if (mode === "origin_asc") {
      const c = (a.Origin||"").localeCompare(b.Origin||"");
      return c !== 0 ? c : a.Name.localeCompare(b.Name);
    }
    return a.Name.localeCompare(b.Name);
  });
  return copy;
}

function render() {
  const filtered = dataset.filter(matches);
  view = sortNpcs(filtered);

  if (els.count) els.count.textContent = `${view.length} shown / ${dataset.length} total`;

    renderList({
    listEl: els.list,
    dataset: view,
    imageResolver, // <-- viktigt
    onOpenModal: (i) => openNpc(view[i]),
    });


  updatePartyCount({
    countEl: document.getElementById("partyCount"),
    subtitleEl: document.getElementById("partySubtitle"),
  });
}


function pill(text, cls) {
  const t = clean(text);
  if (!t) return "";
  return `<span class="badge rounded-pill ${cls}">${t.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}</span>`;
}


function kv(container, pairs) {
  container.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const [k,v] of pairs) {
    const val = clean(v);
    if (!val) continue;
    const row = document.createElement("div");
    row.className = "row g-2";
    const kc = document.createElement("div");
    kc.className = "col-5 col-xl-4 k";
    kc.textContent = k;
    const vc = document.createElement("div");
    vc.className = "col-7 col-xl-8 v";
    vc.textContent = val;
    row.appendChild(kc); row.appendChild(vc);
    frag.appendChild(row);
  }
  container.appendChild(frag);
}

function renderTraitsGrid(n) {
  els.traitsGrid.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const k of CHARACTERISTICS) {
    const row = document.createElement("div");
    row.className = "trait-item";
    const kc = document.createElement("div");
    kc.className = "k"; kc.textContent = k;
    const vc = document.createElement("div");
    vc.className = "v"; vc.textContent = String(toNumber(n[k]));
    row.appendChild(kc); row.appendChild(vc);
    frag.appendChild(row);
  }
  els.traitsGrid.appendChild(frag);
}

function applyData(json) {
  dataset = json?.npcs ? json.npcs : [];
  initFilters();
  render();

  // debug/state exposure (VIKTIGT)
  window.__npc = window.__npc || {};
  window.__npc.dataset = dataset;
  window.__npc.view = view;
  window.__npc.imageResolver = imageResolver;

  if (json) setStatus(`Loaded ${json.count} NPCs (cached: ${json.updatedAt})`);
  else setStatus("No cached data. Load from OneDrive to begin.");
}

// ---------- WIRING ----------

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

els.clear?.addEventListener("click", () => {
  clearCache();
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
});

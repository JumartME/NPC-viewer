// app.js
import { createOneDriveClient } from "./OneDrive/onedrive.js";

const CACHE_KEY = "npcviewer:singlefile:v1";
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
const PARTY_KEY = "npcviewer:party:v1";
let partyModal = null;

// === OneDrive (Personal / Consumer) ===
const ENTRA_CLIENT_ID = "DIN_CLIENT_ID_HÄR";

const oneDrive = createOneDriveClient({
  clientId: ENTRA_CLIENT_ID,
  authority: "https://login.microsoftonline.com/consumers",
  pickerBaseUrl: "https://onedrive.live.com/picker",
  pickerScopes: ["OneDrive.ReadOnly"],
  // funkar både github pages och localhost (viktigt för redirect_uri)
  redirectUri: new URL("./", window.location.href).href,
});

// set after OneDrive load
let imageResolver = null;

// ---------- PARTY ----------
function loadPartyIds() {
  try {
    const raw = localStorage.getItem(PARTY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Bad party storage, resetting:", e);
    return [];
  }
}

function savePartyIds(ids) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  localStorage.setItem(PARTY_KEY, JSON.stringify(unique));
  updatePartyCount();
}

function updatePartyCount() {
  const ids = loadPartyIds();
  const el = document.getElementById("partyCount");
  if (el) el.textContent = String(ids.length);
}

function inParty(npcId) {
  return loadPartyIds().includes(npcId);
}
function addToParty(npcId) {
  const ids = loadPartyIds();
  if (ids.includes(npcId)) return;
  savePartyIds([...ids, npcId]);
}
function removeFromParty(npcId) {
  const ids = loadPartyIds();
  savePartyIds(ids.filter((x) => x !== npcId));
}
function clearPartyAll() {
  savePartyIds([]);
}

// ---------- DOM ----------
const els = {
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

  modalEl: document.getElementById("npcModal"),
  modalTitle: document.getElementById("modalTitle"),
  modalSubtitle: document.getElementById("modalSubtitle"),
  modalImg: document.getElementById("modalImg"),
  kvIdentity: document.getElementById("kvIdentity"),
  kvGear: document.getElementById("kvGear"),
  descBox: document.getElementById("descBox"),
  skillsBox: document.getElementById("skillsBox"),
  modalFooter: document.getElementById("modalFooter"),
  modalPartyBtn: document.getElementById("modalPartyBtn"),
  kvCombat: document.getElementById("kvCombat"),
  kvVitals: document.getElementById("kvVitals"),
  modalBadges: document.getElementById("modalBadges"),
  traitsGrid: document.getElementById("traitsGrid"),

  openDice: document.getElementById("openDice"),
  diceModalEl: document.getElementById("diceModal"),
  rollD12: document.getElementById("rollD12"),
  d12Value: document.getElementById("d12Value"),

  actChar: document.getElementById("actChar"),
  actSkill: document.getElementById("actSkill"),
  actRoll: document.getElementById("actRoll"),
  actResult: document.getElementById("actResult"),
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
function clean(v) { return String(v ?? "").trim(); }
function titleCase(s) { const t = clean(s); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : ""; }
function normEnum(v, allowedLower, fallback) {
  const s = clean(v).toLowerCase();
  if (!s) return fallback;
  return allowedLower.indexOf(s) >= 0 ? titleCase(s) : fallback;
}
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

function saveCache(obj) { localStorage.setItem(CACHE_KEY, JSON.stringify(obj)); }
function loadCache() {
  try { const raw = localStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function clearCache() { localStorage.removeItem(CACHE_KEY); }

function toNumber(v) {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function parseSkillsMap(skillsText) {
  const text = String(skillsText ?? "").trim();
  const map = new Map();
  if (!text) return map;

  const parts = text.split(/[,;\n]+/g).map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    const m = part.match(/^(.+?)\s*:\s*(-?\d+(?:[.,]\d+)?)\s*$/);
    if (!m) continue;
    const name = m[1].trim();
    const val = Number(m[2].replace(",", "."));
    if (!name || !Number.isFinite(val)) continue;
    map.set(name, val);
  }
  return map;
}

// ----- IMAGE: local fallback + OneDrive override -----
function buildLocalImageUrls(n) {
  const urls = [];
  const bases = Array.isArray(n.imageBaseUrls) ? n.imageBaseUrls : (n.imageBaseUrl ? [n.imageBaseUrl] : []);
  for (const base of bases) for (const ext of IMAGE_EXTS) urls.push(encodeURI(base + ext));
  return urls;
}

async function resolveOneDriveImageUrl(n) {
  if (!imageResolver?.getNpcImageUrl) return null;
  try { return await imageResolver.getNpcImageUrl(n.Origin, n.Name); }
  catch { return null; }
}

function setImgWithFallback(imgEl, urls, altText) {
  let i = 0;
  imgEl.alt = altText || "";
  imgEl.classList.remove("missing");
  imgEl.onerror = () => {
    if (i >= urls.length) {
      imgEl.removeAttribute("src");
      imgEl.classList.add("missing");
      return;
    }
    imgEl.src = urls[i++];
  };
  imgEl.onerror();
}

function setImgForNpc(imgEl, n, { preferOneDrive = true } = {}) {
  const localUrls = buildLocalImageUrls(n);
  if (localUrls.length) setImgWithFallback(imgEl, localUrls, n.Name);

  if (!preferOneDrive) return;
  resolveOneDriveImageUrl(n).then((url) => {
    if (url) {
      imgEl.classList.remove("missing");
      imgEl.src = url;
    }
  });
}

// ---------- XLSX ----------
function isSeparatorRow(row) {
  const name = clean(row.Name);
  if (!name) return false;

  const fieldsToCheck = [
    "Gender","Age","Species","Concept","Description","Origin",
    "Equipment","Armor","Shield","Weapon","Magic","Special",
    "Healing","Agility","Strength","Dexterity","Stamina","Intelligence",
    "Perception","Will","Wits","Expression","Instinct","Presence","Wisdom",
    "Skills","Size","Health","Spirit","MP","wpn","arm","Reputation","Relation"
  ];

  for (const f of fieldsToCheck) if (clean(row[f]) !== "") return false;
  return true;
}

function imageNameCandidates(fullName) {
  const s = clean(fullName).replace(/\s+/g, " ");
  if (!s) return [];
  const parts = s.split(" ");
  const candidates = [];
  candidates.push(s);
  if (parts.length >= 2) candidates.push(parts.slice(0,2).join(" "));
  candidates.push(parts[0]);
  return [...new Set(candidates)];
}

function rowToNpc(row) {
  const Name = clean(row.Name);
  if (!Name) return null;
  if (isSeparatorRow(row)) return null;

  const Origin = clean(row.Origin);
  const Reputation = normEnum(row.Reputation, ["hostile","friendly","neutral","player"], "Neutral");
  const Relation = normEnum(row.Relation, ["unknown","met","recruited","defeated","imprisoned"], "Unknown");

  // local fallback paths (om du kör lokalt med GMCC/refs)
  const imgCandidates = imageNameCandidates(Name);
  const imageBaseUrls = imgCandidates.map(c => Origin ? `./GMCC/refs/${Origin}/${c}` : `./GMCC/refs/${c}`);

  return {
    id: Name.toLowerCase().replace(/\s+/g, "-"),
    Name, Origin, Reputation, Relation, imageBaseUrls,
    Gender: clean(row.Gender),
    Age: clean(row.Age),
    Species: clean(row.Species),
    Concept: clean(row.Concept),
    Description: clean(row.Description),
    Equipment: clean(row.Equipment),
    Armor: clean(row.Armor),
    Shield: clean(row.Shield),
    Weapon: clean(row.Weapon),
    Magic: clean(row.Magic),
    Special: clean(row.Special),
    Healing: clean(row.Healing),
    Agility: clean(row.Agility),
    Strength: clean(row.Strength),
    Dexterity: clean(row.Dexterity),
    Stamina: clean(row.Stamina),
    Intelligence: clean(row.Intelligence),
    Perception: clean(row.Perception),
    Will: clean(row.Will),
    Wits: clean(row.Wits),
    Expression: clean(row.Expression),
    Instinct: clean(row.Instinct),
    Presence: clean(row.Presence),
    Wisdom: clean(row.Wisdom),
    Skills: clean(row.Skills),
    Size: clean(row.Size),
    Health: clean(row.Health),
    Spirit: clean(row.Spirit),
    MP: clean(row.MP),
    wpn: clean(row.wpn),
    arm: clean(row.arm),
  };
}

async function parseXlsxBuffer(buf) {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

function rowsToJson(rows) {
  const npcs = (rows || []).map(rowToNpc).filter(Boolean);
  return { updatedAt: new Date().toISOString(), count: npcs.length, npcs };
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

function pill(text, cls) {
  const t = clean(text);
  if (!t) return "";
  return `<span class="badge rounded-pill ${cls}">${t.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}</span>`;
}

function buildRow(n, idx) {
  const card = document.createElement("div");
  card.className = "npc-card npc-row";
  card.dataset.index = String(idx);
  card.role = "button";
  card.tabIndex = 0;

  const thumb = document.createElement("div");
  thumb.className = "thumb";

  const img = document.createElement("img");
  img.className = "img";
  img.alt = n.Name;

  setImgForNpc(img, n, { preferOneDrive: true });

  const mid = document.createElement("div");
  mid.className = "npc-mid";

  const name = document.createElement("div");
  name.className = "npc-name " + nameClass(n);
  name.textContent = n.Name;

  const meta = document.createElement("div");
  meta.className = "npc-meta";
  meta.textContent = [n.Species, n.Description].filter(Boolean).join(" • ");

  mid.appendChild(name);
  if (meta.textContent) mid.appendChild(meta);

  const partyBtn = document.createElement("button");
  partyBtn.type = "button";
  partyBtn.className = "btn btn-sm party-btn " + (inParty(n.id) ? "btn-outline-secondary" : "btn-outline-primary");
  partyBtn.textContent = inParty(n.id) ? "In Party" : "Party+";
  partyBtn.disabled = inParty(n.id);

  partyBtn.addEventListener("click",(e)=>{
    e.stopPropagation();
    addToParty(n.id);
    render();
    updatePartyCount();
  });

  const bottom = document.createElement("div");
  bottom.className = "npc-bottom";

  const leftPills = document.createElement("div");
  leftPills.className = "npc-pills-left";
  leftPills.innerHTML = pill(n.Origin, "text-bg-light border") + pill(n.Concept, "text-bg-light border");

  bottom.appendChild(leftPills);

  card.appendChild(thumb);
  thumb.appendChild(img);
  card.appendChild(mid);
  card.appendChild(partyBtn);
  card.appendChild(bottom);

  card.addEventListener("click", () => openModal(idx));
  return card;
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

let currentNpcForAction = null;
function populateActionUI(n) {
  currentNpcForAction = n;
  els.actChar.innerHTML = "";
  for (const k of CHARACTERISTICS) {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = `${k} (${toNumber(n[k])})`;
    els.actChar.appendChild(opt);
  }

  els.actSkill.innerHTML = "";
  const skillsMap = parseSkillsMap(n.Skills);
  const keys = Array.from(skillsMap.keys()).sort((a,b)=>a.localeCompare(b));
  if (keys.length === 0) {
    const opt = document.createElement("option");
    opt.value = ""; opt.textContent = "No skills found";
    opt.disabled = true; opt.selected = true;
    els.actSkill.appendChild(opt);
  } else {
    for (const sk of keys) {
      const opt = document.createElement("option");
      opt.value = sk;
      opt.textContent = `${sk} (${skillsMap.get(sk)})`;
      els.actSkill.appendChild(opt);
    }
  }
}

function fillNpcModal(n) {
  els.modalTitle.textContent = n.Name;
  els.modalSubtitle.textContent = [n.Species, n.Origin, n.Concept].filter(Boolean).join(" • ");
  setImgForNpc(els.modalImg, n, { preferOneDrive: true });

  kv(els.kvIdentity, [["Gender",n.Gender],["Age",n.Age],["Species",n.Species],["Origin",n.Origin],["Concept",n.Concept]]);
  renderTraitsGrid(n);
  els.skillsBox.textContent = clean(n.Skills) || "—";
  kv(els.kvVitals, [["Size",n.Size],["Health",n.Health],["Spirit",n.Spirit],["MP",n.MP]]);
  kv(els.kvCombat, [["Special",n.Special],["Magic",n.Magic],["Healing",n.Healing],["Wpn",n.wpn],["Arm",n.arm]]);
  kv(els.kvGear, [["Equipment",n.Equipment],["Weapon",n.Weapon],["Armor",n.Armor],["Shield",n.Shield]]);
  els.descBox.textContent = clean(n.Description) || "—";

  els.modalPartyBtn.textContent = inParty(n.id) ? "In Party" : "Add to Party";
  els.modalPartyBtn.disabled = inParty(n.id);
  els.modalPartyBtn.onclick = () => { addToParty(n.id); render(); fillNpcModal(n); };

  populateActionUI(n);
}

function openModal(idx) {
  const n = view[idx];
  if (!n) return;
  fillNpcModal(n);
  modal = bootstrap.Modal.getOrCreateInstance(els.modalEl);
  modal.show();
}

function render() {
  const filtered = dataset.filter(matches);
  view = sortNpcs(filtered);
  els.count.textContent = `${view.length} shown / ${dataset.length} total`;
  els.list.innerHTML = "";
  view.forEach((n,i)=>els.list.appendChild(buildRow(n,i)));
}

function applyData(json) {
  dataset = json?.npcs ? json.npcs : [];
  initFilters();
  render();
  if (json) setStatus(`Loaded ${json.count} NPCs (cached: ${json.updatedAt})`);
  else setStatus("No cached data. Load from OneDrive to begin.");
}

// ---------- WIRING ----------
updatePartyCount();

document.getElementById("btnOneDrive")?.addEventListener("click", async () => {
  try {
    setStatus("Open OneDrive folder picker...");
    const { driveId, folderId } = await oneDrive.pickFolder();

    setStatus("Loading data.xlsx + img/ ...");
    const { json, imageResolver: resolver } = await oneDrive.loadRootFolderBundle({
      rootDriveId: driveId,
      rootFolderId: folderId,
      parseXlsxBuffer,
      rowsToJson,
      setStatus,
    });

    imageResolver = resolver;
    saveCache(json);
    applyData(json);
    setStatus(`Loaded ${json.count} NPCs from OneDrive ✔`);
  } catch (e) {
    console.error(e);
    setStatus("OneDrive load failed.");
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

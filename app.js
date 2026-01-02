// app.js
const CACHE_KEY = "npcviewer:singlefile:v1";
const IMAGE_EXTS = [".jpg", ".jpeg"];
const PARTY_KEY = "npcviewer:party:v1";
let partyModal = null;

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
    const sub = document.getElementById("partySubtitle");
    if (sub) sub.textContent = `${ids.length} member${ids.length === 1 ? "" : "s"}`;
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
    savePartyIds(ids.filter(x => x !== npcId));
}

function clearPartyAll() {
    savePartyIds([]);
}
const els = {
    status: document.getElementById("status"),
    count: document.getElementById("count"),
    list: document.getElementById("list"),
    randomNpc: document.getElementById("randomNpc"),
    gender: document.getElementById("gender"),
    
    fileXlsx: document.getElementById("fileXlsx"),
    clear: document.getElementById("clear"),
    
    q: document.getElementById("q"),
    origin: document.getElementById("origin"),
    concept: document.getElementById("concept"),
    reputation: document.getElementById("reputation"),
    relAll: document.getElementById("relAll"),
    relationCbs: Array.from(document.querySelectorAll(".rel-cb")),
    sort: document.getElementById("sort"),
    
    // modal
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
    
    
    // DICE
    openDice: document.getElementById("openDice"),
    diceModalEl: document.getElementById("diceModal"),
    rollD12: document.getElementById("rollD12"),
    d12Value: document.getElementById("d12Value"),
    
    actChar: document.getElementById("actChar"),
    actSkill: document.getElementById("actSkill"),
    actRoll: document.getElementById("actRoll"),
    actResult: document.getElementById("actResult"),
    
};

document.getElementById("viewParty")?.addEventListener("click", () => {
    partyModal = bootstrap.Modal.getOrCreateInstance(document.getElementById("partyModal"));
    renderPartyView();
    partyModal.show();
});

document.getElementById("clearParty")?.addEventListener("click", () => {
    clearPartyAll();
    renderPartyView();
    render();
});

let dataset = [];
let view = [];
let modal = null;

function updateModalPartyButton(n) {
    if (!els.modalPartyBtn) return;
    const already = inParty(n.id);
    
    els.modalPartyBtn.textContent = already ? "In Party" : "Add to Party";
    els.modalPartyBtn.disabled = already;
    els.modalPartyBtn.className = "btn " + (already ? "btn-outline-secondary" : "btn-primary");
    
    els.modalPartyBtn.onclick = () => {
        addToParty(n.id);
        updateModalPartyButton(n);
        render();
    };
}

function rollD12() {
    return Math.floor(Math.random() * 12) + 1; // 1..12
}

function toNumber(v) {
    const s = String(v ?? "").trim();
    if (!s) return 0;
    // handle "3", "3.0", "3,0"
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
}

// Parse skills from common formats inside n.Skills text:
// Examples it can handle:
// "Stealth 2, Athletics 1"
// "Stealth: 2; Athletics: 1"
// "Stealth=2\nAthletics=1"
function parseSkillsMap(skillsText) {
    const text = String(skillsText ?? "").trim();
    const map = new Map();
    if (!text) return map;
    
    // Split on commas or newlines: "Stealth: 3, Athletics: 2"
    const parts = text
    .split(/[,;\n]+/g)
    .map(p => p.trim())
    .filter(Boolean);
    
    for (const part of parts) {
        // Match "Name: 3" (allow spaces)
        const m = part.match(/^(.+?)\s*:\s*(-?\d+(?:[.,]\d+)?)\s*$/);
        if (!m) continue;
        
        const name = m[1].trim();
        const val = Number(m[2].replace(",", "."));
        if (!name || !Number.isFinite(val)) continue;
        
        map.set(name, val);
    }
    
    return map;
}

const CHARACTERISTICS = [
    "Intelligence","Perception","Will","Wits",
    "Agility","Dexterity","Stamina","Strength",
    "Expression","Instinct","Presence","Wisdom"
];


function setStatus(msg) { els.status.textContent = msg || ""; }
function clean(v) { return String(v ?? "").trim(); }
function titleCase(s) {
    const t = clean(s);
    return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : "";
}
function normEnum(v, allowedLower, fallback) {
    const s = clean(v).toLowerCase();
    if (!s) return fallback;
    return allowedLower.indexOf(s) >= 0 ? titleCase(s) : fallback;
}
function uniqueSorted(arr) {
    const s = new Set(arr.filter(Boolean));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
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

function saveCache(obj) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
}
function loadCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}
function clearCache() {
    localStorage.removeItem(CACHE_KEY);
}

// Skip separator rows: Name filled but all other columns empty
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
    for (let i = 0; i < fieldsToCheck.length; i++) {
        if (clean(row[fieldsToCheck[i]]) !== "") return false;
    }
    return true;
}

function imageNameCandidates(fullName) {
    const s = clean(fullName).replace(/\s+/g, " ");
    if (!s) return [];
    
    const parts = s.split(" ");
    const candidates = [];
    
    // 0) hela namnet först (för de filer som har två+ ord)
    candidates.push(s);
    
    // 2) två första ord (om finns)
    if (parts.length >= 2) candidates.push(parts.slice(0, 2).join(" "));
    
    // 3) första ordet (vanligaste)
    candidates.push(parts[0]);
    
    // Unika i ordning
    return [...new Set(candidates)];
}

function makeKeys(origin, name) {
    const o = clean(origin);
    const base = imageBaseName(name);
    if (!base) return [];
    
    return IMAGE_EXTS.map(ext =>
        o ? `${o}/${base}${ext}` : `${base}${ext}`
    );
}

function rowToNpc(row) {
    const Name = clean(row.Name);
    if (!Name) return null;
    if (isSeparatorRow(row)) return null;
    
    const Origin = clean(row.Origin);
    const Reputation = normEnum(row.Reputation, ["hostile","friendly","neutral","player"], "Neutral");
    const Relation = normEnum(row.Relation, ["unknown","met","recruited","defeated","imprisoned"], "Unknown");
    
    const imgCandidates = imageNameCandidates(Name);
    
    const imageBaseUrls = imgCandidates.map(c =>
        Origin ? `./GMCC/refs/${Origin}/${c}` : `./GMCC/refs/${c}`
    );
    
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
        MagicStat: clean(row["Magic "] || ""),
    };
}

async function parseXlsx(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    const npcs = rows.map(rowToNpc).filter(Boolean);
    return { updatedAt: new Date().toISOString(), count: npcs.length, npcs };
}

function nameClass(n) {
    // Hostile overrides
    if (n.Reputation === "Player") return "text-warning";
    if (n.Reputation === "Hostile") return "text-danger";
    if (n.Relation === "Recruited") return "text-success";
    if (n.Relation === "Met") return "text-primary";
    if (n.Relation === "Defeated") return "text-body-secondary";
    return "text-muted";
}

function initFilters() {
    setOptions(els.origin, uniqueSorted(dataset.map(n => n.Origin)), "All Origins");
    setOptions(els.reputation, ["Hostile","Friendly","Neutral", "Player"], "All Reputation");
    setOptions(els.concept, uniqueSorted(dataset.map(n => n.Concept)), "All Concepts");
    setOptions(els.gender, uniqueSorted(dataset.map(n => n.Gender)), "All Genders");
    
    els.sort.innerHTML = "";
    [
        ["name_asc", "Name (A–Z)"],
        ["name_desc", "Name (Z–A)"],
        ["origin_asc", "Origin (A–Z)"],
        ["relation", "Relation"],
        ["reputation", "Reputation"],
        ["concept_asc", "Concept (A–Z)"],
        
    ].forEach(([v, label]) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = label;
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
    
    // Relation (checkboxar)
    // Om "Visa alla" är ikryssad -> inget relationsfilter
    if (!els.relAll.checked) {
        const selected = els.relationCbs
        .filter(cb => cb.checked)
        .map(cb => cb.value);
        
        // Om något är valt: NPC måste matcha ett av dem
        if (selected.length > 0 && !selected.includes(n.Relation)) {
            return false;
        }
        
        // Om inget är valt (borde inte hända pga sync), visa allt
    }
    
    return true;
}

function syncRelationAll() {
    const anyChecked = els.relationCbs.some(cb => cb.checked);
    
    if (!anyChecked) {
        // Inga valda -> Visa alla ska vara på
        els.relAll.checked = true;
    }
}
const REL_ORDER = ["Recruited", "Met", "Unknown", "Imprisoned","Defeated"];
const REP_ORDER = ["Player", "Friendly", "Neutral", "Hostile"];
function sortKeyRelation(n) { const i = REL_ORDER.indexOf(n.Relation); return i < 0 ? 999 : i; }
function sortKeyReputation(n) { const i = REP_ORDER.indexOf(n.Reputation); return i < 0 ? 999 : i; }



function sortNpcs(arr) {
    const mode = els.sort.value;
    const copy = arr.slice();
    copy.sort((a, b) => {
        if (mode === "name_asc") return a.Name.localeCompare(b.Name);
        if (mode === "name_desc") return b.Name.localeCompare(a.Name);
        if (mode === "origin_asc") {
            const c = (a.Origin || "").localeCompare(b.Origin || "");
            return c !== 0 ? c : a.Name.localeCompare(b.Name);
        }
        if (mode === "relation") {
            const c = sortKeyRelation(a) - sortKeyRelation(b);
            return c !== 0 ? c : a.Name.localeCompare(b.Name);
        }
        if (mode === "reputation") {
            const c = sortKeyReputation(a) - sortKeyReputation(b);
            return c !== 0 ? c : a.Name.localeCompare(b.Name);
        }
        if (mode === "concept_asc") {
            const c = (a.Concept || "").localeCompare(b.Concept || "");
            return c !== 0 ? c : a.Name.localeCompare(b.Name);
        }
        
        return a.Name.localeCompare(b.Name);
    });
    return copy;
}

function pill(text, cls) {
    const t = clean(text);
    if (!t) return "";
    return `<span class="badge rounded-pill ${cls}">${escapeHtml(t)}</span>`;
}

function escapeHtml(s) {
    return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    
    // (keep your existing image fallback logic here)
    const urls = [];
    const bases = Array.isArray(n.imageBaseUrls) ? n.imageBaseUrls : (n.imageBaseUrl ? [n.imageBaseUrl] : []);
    for (const base of bases) for (const ext of IMAGE_EXTS) urls.push(encodeURI(base + ext));
    let attempt = 0;
    img.onerror = () => {
        if (attempt >= urls.length) {
            img.removeAttribute("src");
            img.classList.add("missing");
            img.alt = `${n.Name} (missing image)`;
            return;
        }
        img.src = urls[attempt++];
    };
    img.onerror();
    
    // middle text
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
    
    // Party button
    const partyBtn = document.createElement("button");
    partyBtn.type = "button";
    partyBtn.className = "btn btn-sm party-btn " + (inParty(n.id) ? "btn-outline-secondary" : "btn-outline-primary");
    partyBtn.textContent = inParty(n.id) ? "In Party" : "Party+";
    partyBtn.disabled = inParty(n.id);
    
    partyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        addToParty(n.id);
        render();
        updatePartyCount();
    });
    
    // bottom pills
    const bottom = document.createElement("div");
    bottom.className = "npc-bottom";
    
    const leftPills = document.createElement("div");
    leftPills.className = "npc-pills-left";
    leftPills.innerHTML = pill(n.Origin, "text-bg-light border") + pill(n.Concept, "text-bg-light border");
    
    const rightPills = document.createElement("div");
    rightPills.className = "npc-pills-right";
    rightPills.innerHTML =
    pill(
        n.Reputation,
        n.Reputation === "Player" ? "text-bg-warning"
        : n.Reputation === "Hostile" ? "text-bg-danger"
        : n.Reputation === "Friendly" ? "text-bg-success"
        : "text-bg-secondary"
    ) +
    pill(
        n.Relation,
        n.Relation === "Recruited" ? "text-bg-success"
        : n.Relation === "Met" ? "text-bg-primary"
        : n.Relation === "Imprisoned" ? "text-bg-warning"
        : n.Relation === "Defeated" ? "text-bg-dark"
        : "text-bg-secondary"
    );
    
    bottom.appendChild(leftPills);
    bottom.appendChild(rightPills);
    
    // assemble (order matters less now, CSS grid places them)
    card.appendChild(thumb);
    thumb.appendChild(img)
    card.appendChild(mid);
    card.appendChild(partyBtn);
    card.appendChild(bottom);
    
    // open modal
    card.addEventListener("click", () => openModal(idx));
    img.addEventListener("click", (e) => { e.stopPropagation(); openModal(idx); });
    
    card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openModal(idx);
        }
    });
    
    return card;
}

function kv(container, pairs) {
    container.innerHTML = "";
    const frag = document.createDocumentFragment();
    
    pairs.forEach(([k, v]) => {
        const val = clean(v);
        if (!val) return;
        
        const row = document.createElement("div");
        row.className = "row g-2";
        
        const kc = document.createElement("div");
        kc.className = "col-5 col-xl-4 k";
        kc.textContent = k;
        
        const vc = document.createElement("div");
        vc.className = "col-7 col-xl-8 v";
        vc.textContent = val;
        
        row.appendChild(kc);
        row.appendChild(vc);
        frag.appendChild(row);
    });
    
    container.appendChild(frag);
}

function fillNpcModal(n) {
    els.modalTitle.textContent = n.Name;
    
    // Badges directly under the name
    els.modalBadges.innerHTML =
    pill(
        n.Reputation,
        n.Reputation === "Player" ? "text-bg-warning"
        : n.Reputation === "Hostile" ? "text-bg-danger"
        : n.Reputation === "Friendly" ? "text-bg-success"
        : "text-bg-secondary"
    ) +
    pill(
        n.Relation,
        n.Relation === "Recruited" ? "text-bg-success"
        : n.Relation === "Met" ? "text-bg-primary"
        : n.Relation === "Imprisoned" ? "text-bg-warning"
        : n.Relation === "Defeated" ? "text-bg-dark"
        : "text-bg-secondary"
    );
    
    // Subtitle is "world info"
    els.modalSubtitle.textContent = [n.Species, n.Origin, n.Concept].filter(Boolean).join(" • ");
    els.modalFooter.textContent = "";
    
    // Image (try all candidates + .jpg/.jpeg)
    els.modalImg.classList.remove("missing");
    els.modalImg.alt = n.Name;
    
    let attempt = 0;
    const urls = [];
    for (const base of (n.imageBaseUrls || [])) {
        for (const ext of IMAGE_EXTS) urls.push(encodeURI(base + ext));
    }
    
    function tryNext() {
        if (attempt >= urls.length) {
            els.modalImg.removeAttribute("src");
            els.modalImg.classList.add("missing");
            els.modalImg.alt = `${n.Name} (missing image)`;
            return;
        }
        els.modalImg.src = urls[attempt++];
    }
    
    els.modalImg.onerror = tryNext;
    tryNext();
    
    // Identity (no rep/rel here anymore)
    kv(els.kvIdentity, [
        ["Gender", n.Gender],
        ["Age", n.Age],
        ["Species", n.Species],
        ["Origin", n.Origin],
        ["Concept", n.Concept],
    ]);
    
    // Traits + Skills (12 characteristics only)
    renderTraitsGrid(n);
    els.skillsBox.textContent = clean(n.Skills) || "—";
    
    // Vitals (Size/Health/Spirit/MP)
    kv(els.kvVitals, [
        ["Size", n.Size],
        ["Health", n.Health],
        ["Spirit", n.Spirit],
        ["MP", n.MP],
    ]);
    
    // Combat & Powers
    kv(els.kvCombat, [
        ["Special", n.Special],
        ["Magic", n.Magic],
        ["Healing", n.Healing],
        ["Wpn", n.wpn],
        ["Arm", n.arm],
    ]);
    
    // Gear (physical stuff)
    kv(els.kvGear, [
        ["Equipment", n.Equipment],
        ["Weapon", n.Weapon],
        ["Armor", n.Armor],
        ["Shield", n.Shield],
    ]);
    
    els.descBox.textContent = clean(n.Description) || "—";
    
    updateModalPartyButton(n);
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
    
    view.forEach((n, i) => els.list.appendChild(buildRow(n, i)));
}

function renderTraitsGrid(n) {
    els.traitsGrid.innerHTML = "";
    const frag = document.createDocumentFragment();
    
    for (const k of CHARACTERISTICS) {
        const row = document.createElement("div");
        row.className = "trait-item";
        
        const kc = document.createElement("div");
        kc.className = "k";
        kc.textContent = k;
        
        const vc = document.createElement("div");
        vc.className = "v";
        vc.textContent = String(toNumber(n[k])); // uses your toNumber()
        
        row.appendChild(kc);
        row.appendChild(vc);
        frag.appendChild(row);
    }
    
    els.traitsGrid.appendChild(frag);
}


function applyData(json) {
    dataset = (json && json.npcs) ? json.npcs : [];
    initFilters();
    render();
    
    if (json) setStatus(`Loaded ${json.count} NPCs (cached: ${json.updatedAt})`);
    else setStatus("No cached data. Upload an Excel file to begin.");
}
updatePartyCount();
function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Wire events
let lastRandomId = null;

function openRandomNpcFromCurrentList() {
    if (!view || view.length === 0) { alert("No NPCs match the current filters."); return; }
    
    let pick = null;
    for (let tries = 0; tries < 10; tries++) {
        const idx = Math.floor(Math.random() * view.length);
        const n = view[idx];
        if (view.length === 1 || n.id !== lastRandomId) { pick = n; break; }
    }
    pick = pick || view[Math.floor(Math.random() * view.length)];
    
    lastRandomId = pick.id;
    openNpcModalFromNpc ? openNpcModalFromNpc(pick) : openModal(view.findIndex(x => x.id === pick.id));
}

els.randomNpc?.addEventListener("click", openRandomNpcFromCurrentList);

let diceModal = null;

els.openDice?.addEventListener("click", () => {
    diceModal = bootstrap.Modal.getOrCreateInstance(els.diceModalEl);
    els.d12Value.textContent = "—";
    diceModal.show();
});

els.rollD12?.addEventListener("click", () => {
    els.d12Value.textContent = String(rollD12());
});

els.actRoll?.addEventListener("click", runActionRoll);

els.fileXlsx.addEventListener("change", async () => {
    const file = els.fileXlsx.files && els.fileXlsx.files[0];
    if (!file) return;
    
    setStatus("Reading Excel...");
    try {
        const json = await parseXlsx(file);
        saveCache(json);
        applyData(json);
    } catch (e) {
        console.error(e);
        setStatus("Failed to read Excel. Make sure it's .xlsx with headers in row 1.");
    } finally {
        els.fileXlsx.value = "";
    }
});

els.clear.addEventListener("click", () => {
    clearCache();
    applyData(null);
});

[els.q, els.gender, els.origin, els.concept, els.reputation, els.sort]
.forEach(el => {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
});

// "Visa alla"
els.relAll.addEventListener("change", () => {
    if (els.relAll.checked) {
        // Kryssar man i Visa alla -> kryssa ur alla andra
        els.relationCbs.forEach(cb => (cb.checked = false));
    } else {
        // Om man kryssar ur Visa alla och inget annat är valt -> slå på Visa alla igen
        syncRelationAll();
    }
    render();
});

// Övriga relationer
els.relationCbs.forEach(cb => {
    cb.addEventListener("change", () => {
        if (cb.checked) {
            // Så fort någon relation väljs -> Visa alla av
            els.relAll.checked = false;
        } else {
            // Om användaren kryssar ur så att inget återstår -> Visa alla på
            syncRelationAll();
        }
        render();
    });
});

// Default: Recruited ikryssad vid start
const recruitedCb = document.getElementById("relRecruited");
if (recruitedCb) recruitedCb.checked = true;

// När vi väljer Recruited ska "Visa alla" vara av
if (els.relAll) els.relAll.checked = false;

// Om något blir fel, säkra att Visa alla kickar in vid 0 val
syncRelationAll();

function findNpcById(id) {
    return dataset.find(n => n.id === id) || null;
}

// bygger samma URL-lista som du gör i openModal/buildRow
function imageUrlsForNpc(n) {
    const urls = [];
    const bases = Array.isArray(n.imageBaseUrls) ? n.imageBaseUrls : (n.imageBaseUrl ? [n.imageBaseUrl] : []);
    for (const base of bases) for (const ext of IMAGE_EXTS) urls.push(encodeURI(base + ext));
    return urls;
}

function setImgWithFallback(imgEl, urls, altText) {
    let i = 0;
    imgEl.alt = altText || "";
    imgEl.onerror = () => {
        if (i >= urls.length) {
            imgEl.removeAttribute("src");
            imgEl.classList.add("missing");
            return;
        }
        imgEl.src = urls[i++];
    };
    // start
    imgEl.onerror();
}

let currentNpcForAction = null;

function populateActionUI(n) {
    currentNpcForAction = n;
    
    // Characteristics dropdown
    els.actChar.innerHTML = "";
    for (const k of CHARACTERISTICS) {
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = `${k} (${toNumber(n[k])})`;
        els.actChar.appendChild(opt);
    }
    
    els.actSkill.innerHTML = "";
    const skillsMap = parseSkillsMap(n.Skills);
    
    const keys = Array.from(skillsMap.keys()).sort((a,b) => a.localeCompare(b));
    for (const sk of keys) {
        const opt = document.createElement("option");
        opt.value = sk;
        opt.textContent = `${sk} (${skillsMap.get(sk)})`;
        els.actSkill.appendChild(opt);
    }
    
    // If no skills parsed, show a disabled placeholder
    if (keys.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "No skills found";
        opt.disabled = true;
        opt.selected = true;
        els.actSkill.appendChild(opt);
    }
    
    els.actResult.innerHTML = `<span class="text-secondary">Choose values and roll.</span>`;
}

function runActionRoll() {
    const n = currentNpcForAction;
    if (!n) {
        els.actResult.innerHTML = `<div class="text-danger fw-semibold">Open an NPC first.</div>`;
        return;
    }
    
    const charKey = els.actChar.value;
    const skillKey = els.actSkill.value; // <-- declare BEFORE using
    
    if (!skillKey) {
        els.actResult.innerHTML = `<div class="text-danger fw-semibold">Pick a skill first.</div>`;
        return;
    }
    
    const charVal = toNumber(n[charKey]);
    const skillsMap = parseSkillsMap(n.Skills);
    const skillVal = toNumber(skillsMap.get(skillKey));
    
    const total = charVal + skillVal;
    const die = rollD12();
    const result = total - die;
    
    const ok = result >= 0;
    
    els.actResult.innerHTML = `
          <div class="fw-semibold ${ok ? "text-success" : "text-danger"}">
            ${ok ? "Success" : "Failure"} (${result})
          </div>
          <div class="small text-secondary">
            (${charKey} ${charVal} + ${skillKey} ${skillVal}) - d12(${die}) = ${result}
          </div>
        `;
}


function renderPartyView() {
    const grid = document.getElementById("partyGrid");
    if (!grid) return;
    
    const ids = loadPartyIds();
    grid.innerHTML = "";
    
    ids.forEach(id => {
        const n = findNpcById(id);
        if (!n) return;
        
        const col = document.createElement("div");
        col.className = "col-6 col-md-3"; // max 4 i rad på md+
        
        const tile = document.createElement("div");
        tile.className = "party-tile";
        
        const img = document.createElement("img");
        img.className = "party-img";
        
        setImgWithFallback(img, imageUrlsForNpc(n), n.Name);
        
        const name = document.createElement("div");
        name.className = "party-name";
        name.textContent = n.Name;
        
        const removeBox = document.createElement("div");
        removeBox.addEventListener("click", (e) => e.stopPropagation());
        
        removeBox.className = "party-remove form-check";
        
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "form-check-input";
        cb.id = `party-remove-${n.id}`;
        
        const lbl = document.createElement("label");
        lbl.addEventListener("click", (e) => e.stopPropagation());
        
        lbl.className = "form-check-label small";
        lbl.setAttribute("for", cb.id);
        lbl.textContent = "Remove";
        
        cb.addEventListener("change", (e) => {
            e.stopPropagation();
            removeFromParty(n.id);
            renderPartyView();
            render(); // uppdatera Add-to-Party-knappar i listan
        });
        cb.addEventListener("click", (e) => e.stopPropagation());
        
        removeBox.appendChild(cb);
        removeBox.appendChild(lbl);
        
        tile.appendChild(img);
        tile.appendChild(name);
        tile.appendChild(removeBox);
        
        tile.addEventListener("click", () => {
            // stäng party-modal och öppna npc-modal
            partyModal?.hide?.();
            // hitta index i view (så openModal funkar)
            const idx = view.findIndex(x => x.id === n.id);
            if (idx >= 0) openModal(idx);
            else {
                // om den inte syns pga filter, öppna ändå genom att temporärt välja direkt från dataset:
                const realIdx = dataset.findIndex(x => x.id === n.id);
                if (realIdx >= 0) {
                    // hack: öppna modal direkt från dataset
                    openNpcModalFromNpc(dataset[realIdx]);
                }
            }
        });
        
        col.appendChild(tile);
        grid.appendChild(col);
    });
    
    updatePartyCount();
}

function openNpcModalFromNpc(n) {
    if (!n) return;
    fillNpcModal(n);
    modal = bootstrap.Modal.getOrCreateInstance(els.modalEl);
    modal.show();
}

// Startup
const cached = loadCache();
applyData(cached);

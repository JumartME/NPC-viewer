// modules/render.js
// Ansvar: render, cards, modal, UI-interaktion

import { setImgForNpc } from "./images.js";
import { inParty, addToParty } from "./party.js";

const CHARACTERISTICS = [
  "Intelligence","Perception","Will","Wits",
  "Agility","Dexterity","Stamina","Strength",
  "Expression","Instinct","Presence","Wisdom"
];

function toNumber(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function clean(v) {
  return String(v ?? "").trim();
}

let els = null;
function getEls() {
  if (els) return els;
  els = {
    modalEl: document.getElementById("npcModal"),
    modalTitle: document.getElementById("modalTitle"),
    modalSubtitle: document.getElementById("modalSubtitle"),
    modalImg: document.getElementById("modalImg"),
    modalPartyBtn: document.getElementById("modalPartyBtn"),
    descBox: document.getElementById("descBox"),
  };
  return els;
}

/* ========= Small helpers ========= */

function kv(container, pairs) {
  container.innerHTML = "";
  for (const [k, v] of pairs) {
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

    row.appendChild(kc);
    row.appendChild(vc);
    container.appendChild(row);
  }
}

function renderTraitsGrid(container, npc) {
  container.innerHTML = "";
  for (const k of CHARACTERISTICS) {
    const row = document.createElement("div");
    row.className = "trait-item";

    const kc = document.createElement("div");
    kc.className = "k";
    kc.textContent = k;

    const vc = document.createElement("div");
    vc.className = "v";
    vc.textContent = String(toNumber(npc[k]));

    row.appendChild(kc);
    row.appendChild(vc);
    container.appendChild(row);

  }
}

function renderSkillsGrid(container, npc) {
  container.innerHTML = "";
  container.classList.remove("skills-grid");
  const skills = npc.skills || {};
  const keys = Object.keys(skills).sort((a,b)=>a.localeCompare(b));

  if (keys.length === 0) {
    container.textContent = "—";
    return;
  }

  container.classList.add("skills-grid");

  for (const k of keys) {
    const item = document.createElement("div");
    item.className = "skill-item";

    const name = document.createElement("div");
    name.className = "k";
    name.textContent = k;

    const val = document.createElement("div");
    val.className = "v";
    val.textContent = String(skills[k]);

    item.appendChild(name);
    item.appendChild(val);
    container.appendChild(item);
  }
}

/* ========= Card / List ========= */

export function buildRow({
  npc,
  index,
  imageResolver,
  onOpenModal,
  onImageRefResolved, 
  onPartyChanged,
}) {
  const card = document.createElement("div");
  card.className = "npc-card npc-row";
  card.dataset.index = String(index);
  card.tabIndex = 0;

  const thumb = document.createElement("div");
  thumb.className = "thumb";

  const img = document.createElement("img");
  img.className = "img";
  img.alt = npc.Name;

  setImgForNpc({
    imgEl: img,
    npc,
    imageResolver,
    onImageRefResolved: onImageRefResolved,
    onPartyChanged,
  });

  thumb.appendChild(img);

  const mid = document.createElement("div");
  mid.className = "npc-mid";

  const name = document.createElement("div");
  name.className = "npc-name";
  name.textContent = npc.Name;

  const meta = document.createElement("div");
  meta.className = "npc-meta";
  meta.textContent = [npc.Species, npc.Description].filter(Boolean).join(" • ");

  mid.appendChild(name);
  if (meta.textContent) mid.appendChild(meta);

  const partyBtn = document.createElement("button");
  partyBtn.type = "button";
  partyBtn.className =
    "btn btn-sm party-btn " +
    (inParty(npc.id) ? "btn-outline-secondary" : "btn-outline-primary");

  partyBtn.textContent = inParty(npc.id) ? "In Party" : "Party+";
  partyBtn.disabled = inParty(npc.id);

  partyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    addToParty(npc.id);
    partyBtn.textContent = "In Party";
    partyBtn.disabled = true;
    onPartyChanged?.();
  });

  card.appendChild(thumb);
  card.appendChild(mid);
  card.appendChild(partyBtn);

  card.addEventListener("click", () => onOpenModal(index));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenModal(index);
    }
  });

  return card;
}

/* ========= Main render ========= */
function qs(id) {
  return document.getElementById(id);
}

export function renderList({
  listEl,
  dataset,
  imageResolver,
  onOpenModal,
  onImageRefResolved,
  onPartyChanged
}) {
  listEl.innerHTML = "";
  dataset.forEach((npc, i) => {
    listEl.appendChild(
      buildRow({ npc, index: i, imageResolver, onOpenModal, onImageRefResolved, onPartyChanged })
    );
  });
}

/* ========= Modal ========= */

export function openNpcModal({ npc, imageResolver, onImageRefResolved, onPartyChanged }) {
  qs("modalTitle").textContent = npc.Name;
  qs("modalSubtitle").textContent =
    [npc.Species, npc.Origin, npc.Concept].filter(Boolean).join(" • ");

  // Image
  setImgForNpc({
    imgEl: qs("modalImg"),
    npc,
    imageResolver,
    onImageRefResolved,
  });

  // Description
  qs("descBox").textContent = clean(npc.Description) || "—";

  // Identity
  kv(qs("kvIdentity"), [
    ["Gender", npc.Gender],
    ["Age", npc.Age],
    ["Species", npc.Species],
    ["Origin", npc.Origin],
    ["Concept", npc.Concept],
  ]);

  // Vitals
  kv(qs("kvVitals"), [
    ["Size", npc.Size],
    ["Health", npc.Health],
    ["Spirit", npc.Spirit],
    ["MP", npc.MP],
  ]);

  // Combat
  kv(qs("kvCombat"), [
    ["Special", npc.Special],
    ["Magic", npc.Magic],
    ["Healing", npc.Healing],
    ["Wpn", npc.wpn],
    ["Arm", npc.arm],
  ]);

  // Gear
  kv(qs("kvGear"), [
    ["Equipment", npc.Equipment],
    ["Weapon", npc.Weapon],
    ["Armor", npc.Armor],
    ["Shield", npc.Shield],
  ]);

  // Traits
  renderTraitsGrid(qs("traitsGrid"), npc);
  renderSkillsGrid(qs("skillsBox"), npc);

  // Party button
  const partyBtn = qs("modalPartyBtn");
  const already = inParty(npc.id);

  partyBtn.textContent = already ? "In Party" : "Add to Party";
  partyBtn.disabled = already;
  partyBtn.className =
    "btn " + (already ? "btn-outline-secondary" : "btn-primary");

  partyBtn.onclick = () => {
    addToParty(npc.id);
    onPartyChanged?.();
    partyBtn.textContent = "In Party";
    partyBtn.disabled = true;
  };

  bootstrap.Modal.getOrCreateInstance(qs("npcModal")).show();
}


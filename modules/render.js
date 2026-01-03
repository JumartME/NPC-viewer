// modules/render.js
// Ansvar: render, cards, modal, UI-interaktion

import { setImgForNpc } from "./images.js";
import { inParty, addToParty } from "./party.js";

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

function clean(v) {
  return String(v ?? "").trim();
}

/* ========= Card / List ========= */

export function buildRow({
  npc,
  index,
  imageResolver,
  onOpenModal,
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

  setImgForNpc({ imgEl: img, npc, imageResolver });

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

export function renderList({
  listEl,
  dataset,
  imageResolver,
  onOpenModal,
}) {
  listEl.innerHTML = "";
  dataset.forEach((npc, i) => {
    listEl.appendChild(
      buildRow({ npc, index: i, imageResolver, onOpenModal })
    );
  });
}

/* ========= Modal ========= */

export function openNpcModal({ npc, imageResolver }) {
  const els = getEls();

  els.modalTitle.textContent = npc.Name;
  els.modalSubtitle.textContent =
    [npc.Species, npc.Origin, npc.Concept].filter(Boolean).join(" • ");

  setImgForNpc({ imgEl: els.modalImg, npc, imageResolver });

  els.descBox.textContent = clean(npc.Description) || "—";

  const already = inParty(npc.id);
  els.modalPartyBtn.textContent = already ? "In Party" : "Add to Party";
  els.modalPartyBtn.disabled = already;
  els.modalPartyBtn.className =
    "btn " + (already ? "btn-outline-secondary" : "btn-primary");

  els.modalPartyBtn.onclick = () => {
    addToParty(npc.id);
    els.modalPartyBtn.textContent = "In Party";
    els.modalPartyBtn.disabled = true;
  };

  const modal = bootstrap.Modal.getOrCreateInstance(els.modalEl);
  modal.show();
}

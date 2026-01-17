// modules/partyView.js
// Ansvar: Party-modal vy (grid + remove) + Saved Parties (localStorage)

import { loadPartyIds, removeFromParty, getCurrentPartyIds, addToParty } from "./party.js";
import { setImgForNpc } from "./images.js";

import { getParties, saveParty, deleteParty, getParty } from "./partiesStore.js";

export function initPartyView({
  viewBtnId = "viewParty",
  modalId = "partyModal",
  gridId = "partyGrid",
  clearBtnId = "clearParty",

  onOpenNpc = null,          // function(npc)
  getNpcById = null,         // function(id) -> npc
  imageResolver = null,      // kan bytas via setter
  clearPartyAllFn = null,    // inject (från app.js)
  onPartyChanged = null,     // callback när party ändras
} = {}) {
  const viewBtn = document.getElementById(viewBtnId);
  const modalEl = document.getElementById(modalId);
  const grid = document.getElementById(gridId);
  const clearBtn = document.getElementById(clearBtnId);

  // Saved parties UI (måste finnas i din partyModal HTML)
  const savedSel = document.getElementById("savedParties");
  const nameInput = document.getElementById("partyName");
  const saveBtn = document.getElementById("saveParty");
  const loadBtn = document.getElementById("loadParty");
  const deleteBtn = document.getElementById("deleteParty");

  if (!viewBtn || !modalEl || !grid) {
    return { show: () => {}, render: () => {}, setImageResolver: () => {} };
  }

  let modal = null;
  let resolver = imageResolver;

  function setImageResolver(r) {
    resolver = r;
  }

  function render() {
    if (!getNpcById) return;

    const ids = loadPartyIds();
    grid.innerHTML = "";

    ids.forEach((id) => {
      const npc = getNpcById(id);
      if (!npc) return;

      const col = document.createElement("div");
      col.className = "col-6 col-md-3";

      const tile = document.createElement("div");
      tile.className = "party-tile";

      const img = document.createElement("img");
      img.className = "party-img";
      setImgForNpc({ imgEl: img, npc, imageResolver: resolver });

      const name = document.createElement("div");
      name.className = "party-name";
      name.textContent = npc.Name;

      // X-knapp istället för checkbox
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "party-remove-btn";
      removeBtn.textContent = "×";
      removeBtn.title = "Remove from party";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeFromParty(npc.id);
        onPartyChanged?.();
        render();
      });

      tile.appendChild(img);
      tile.appendChild(name);
      tile.appendChild(removeBtn);

      tile.addEventListener("click", () => {
        modal?.hide?.();
        onOpenNpc?.(npc);
      });

      col.appendChild(tile);
      grid.appendChild(col);
    });
  }

  function show() {
    modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    render();
    if (savedSel) renderSavedParties(savedSel);
    modal.show();
  }

  viewBtn.addEventListener("click", show);

  if (clearBtn && clearPartyAllFn) {
    clearBtn.addEventListener("click", () => {
      clearPartyAllFn();
      onPartyChanged?.();
      render();
    });
  }

  // ===== Saved Parties =====

  function renderSavedParties(selectEl) {
    const parties = getParties();
    selectEl.innerHTML = "";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— Saved parties —";
    selectEl.appendChild(empty);

    parties.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.npcIds.length})`;
      selectEl.appendChild(opt);
    });
  }

  function saveCurrentParty() {
    const npcIds = getCurrentPartyIds();
    if (!npcIds.length) {
      alert("Party is empty.");
      return;
    }

    const name = (nameInput?.value || "").trim() || "Unnamed party";

    saveParty({
      id: crypto.randomUUID(),
      name,
      npcIds,
    });

    if (savedSel) renderSavedParties(savedSel);
  }

  function loadPartyById(partyId) {
    const party = getParty(partyId);
    if (!party) return;

    clearPartyAllFn?.();
    party.npcIds.forEach(addToParty);
    onPartyChanged?.();
    render();
  }

  function deleteSelectedParty(partyId) {
    if (!partyId) return;
    deleteParty(partyId);
    if (savedSel) {
      renderSavedParties(savedSel);
      savedSel.value = "";
    }
  }

  // Wiring (bara om UI finns)
  saveBtn?.addEventListener("click", () => {
    saveCurrentParty();
  });

  loadBtn?.addEventListener("click", () => {
    const id = savedSel?.value || "";
    if (!id) return;
    loadPartyById(id);
  });

  deleteBtn?.addEventListener("click", () => {
    const id = savedSel?.value || "";
    if (!id) return;
    deleteSelectedParty(id);
  });

  return { show, render, setImageResolver };
}

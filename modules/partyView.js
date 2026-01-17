// modules/partyView.js
// Party-modal vy (grid + remove) + Saved Parties (localStorage)

import { loadPartyIds, removeFromParty, getCurrentPartyIds, addToParty } from "./party.js";
import { setImgForNpc } from "./images.js";
import { getParties, saveParty, deleteParty, getParty } from "./partiesStore.js";

export function initPartyView({
  viewBtnId = "viewParty",
  modalId = "partyModal",
  gridId = "partyGrid",
  clearBtnId = "clearParty",

  onOpenNpc = null,
  getNpcById = null,
  imageResolver = null,
  clearPartyAllFn = null,
  onPartyChanged = null,
} = {}) {
  const viewBtn = document.getElementById(viewBtnId);
  const modalEl = document.getElementById(modalId);
  const grid = document.getElementById(gridId);
  const clearBtn = document.getElementById(clearBtnId);

  // Header UI (ska finnas i HTML)
  const savedSel = document.getElementById("savedParties");
  const saveBtn = document.getElementById("saveParty");
  const loadBtn = document.getElementById("loadParty");
  const deleteBtn = document.getElementById("deleteParty");

  const titleEl = document.getElementById("partyTitle");
  const subtitleEl = document.getElementById("partySubtitle");

  if (!viewBtn || !modalEl || !grid) {
    return { show: () => {}, render: () => {}, setImageResolver: () => {} };
  }

  let modal = null;
  let resolver = imageResolver;

  // Kom ihåg vilken saved party som är aktiv (för titel)
  let activeSavedPartyId = "";

  function setImageResolver(r) { resolver = r; }

  function setTitle(name, count) {
    if (titleEl) titleEl.textContent = name || "Party";
    if (subtitleEl) subtitleEl.textContent = (typeof count === "number") ? `${count} members` : "";
  }

  function renderSavedParties() {
    if (!savedSel) return;

    const parties = getParties();
    savedSel.innerHTML = "";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— Saved parties —";
    savedSel.appendChild(empty);

    parties.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.npcIds.length})`;
      savedSel.appendChild(opt);
    });

    savedSel.value = activeSavedPartyId || "";
  }

  function render() {
    if (!getNpcById) return;

    const ids = loadPartyIds();
    grid.innerHTML = "";

    // Titel: om en saved party är vald -> visa dess namn, annars "Current party"
    if (activeSavedPartyId) {
      const p = getParty(activeSavedPartyId);
      setTitle(p?.name || "Party", ids.length);
    } else {
      setTitle("Current party", ids.length);
    }

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
    renderSavedParties();
    render();
    modal.show();
  }

  viewBtn.addEventListener("click", show);

  if (clearBtn && clearPartyAllFn) {
    clearBtn.addEventListener("click", () => {
      clearPartyAllFn();
      activeSavedPartyId = "";          // när du clearar, gå tillbaka till current party
      onPartyChanged?.();
      renderSavedParties();
      render();
    });
  }

  function saveCurrentParty() {
    const npcIds = getCurrentPartyIds();
    if (!npcIds.length) {
      alert("Party is empty.");
      return;
    }

    const name = prompt("Party name:", "Unnamed party")?.trim();
    if (!name) return;

    const saved = saveParty({
      id: crypto.randomUUID(),
      name,
      npcIds,
    });

    activeSavedPartyId = saved.id;
    renderSavedParties();
    render();
  }

  function loadSelectedParty() {
    const id = savedSel?.value || "";
    if (!id) return;

    const party = getParty(id);
    if (!party) return;

    clearPartyAllFn?.();
    party.npcIds.forEach(addToParty);

    activeSavedPartyId = id;
    onPartyChanged?.();
    renderSavedParties();
    render();
  }

  function deleteSelectedParty() {
    const id = savedSel?.value || "";
    if (!id) return;

    if (!confirm("Delete this saved party?")) return;

    deleteParty(id);

    if (activeSavedPartyId === id) activeSavedPartyId = "";
    renderSavedParties();
    render();
  }

  // Wiring
  saveBtn?.addEventListener("click", saveCurrentParty);
  loadBtn?.addEventListener("click", loadSelectedParty);
  deleteBtn?.addEventListener("click", deleteSelectedParty);

  // Om användaren byter dropdown: bara byt titel, ladda inte direkt
  savedSel?.addEventListener("change", () => {
    activeSavedPartyId = savedSel.value || "";
    render();
  });

  return { show, render, setImageResolver };
}

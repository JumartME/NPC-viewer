// modules/partyView.js
// Ansvar: Party-modal vy (grid + remove)

import { loadPartyIds, removeFromParty } from "./party.js";
import { setImgForNpc } from "./images.js";

export function initPartyView({
  viewBtnId = "viewParty",
  modalId = "partyModal",
  gridId = "partyGrid",
  clearBtnId = "clearParty",
  onOpenNpc = null,          // function(npc) -> öppna npc-modal
  getNpcById = null,         // function(id) -> npc
  imageResolver = null,      // kan bytas via setter
  clearPartyAllFn = null,    // inject (från party.js i app.js)
  onPartyChanged = null,
} = {}) {
  const viewBtn = document.getElementById(viewBtnId);
  const modalEl = document.getElementById(modalId);
  const grid = document.getElementById(gridId);
  const clearBtn = document.getElementById(clearBtnId);

  if (!viewBtn || !modalEl || !grid) {
    return {
      show: () => {},
      render: () => {},
      setImageResolver: () => {},
    };
  }

  let modal = null;
  let resolver = imageResolver;

  function setImageResolver(r) { resolver = r; }

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

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "party-remove-btn";
      removeBtn.textContent = "×";
      removeBtn.title = "Remove from party";

      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeFromParty(npc.id);
        onPartyChanged?.();
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
    modal.show();
  }

  viewBtn.addEventListener("click", show);

  if (clearBtn && clearPartyAllFn) {
    clearBtn.addEventListener("click", () => {
      clearPartyAllFn();
      onPartyChanged?.();
    });
  }

  return { show, render, setImageResolver };
}

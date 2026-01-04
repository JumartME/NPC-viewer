// modules/render/card.js
import { setImgForNpc } from "../images.js";
import { inParty, addToParty } from "../party.js";

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
    onImageRefResolved,
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

  const already = inParty(npc.id);
  partyBtn.className =
    "btn btn-sm party-btn " + (already ? "btn-outline-secondary" : "btn-outline-primary");
  partyBtn.textContent = already ? "In Party" : "Party+";
  partyBtn.disabled = already;

  partyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    addToParty(npc.id);
    partyBtn.textContent = "In Party";
    partyBtn.disabled = true;
    partyBtn.className = "btn btn-sm party-btn btn-outline-secondary";
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

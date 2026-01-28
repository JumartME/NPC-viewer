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
  observer
}) {
  const card = document.createElement("div");
  card.className = "npc-card npc-row";
  card.dataset.index = String(index);
  card.tabIndex = 0;

  /* ---------- Thumbnail ---------- */
  const thumb = document.createElement("div");
  thumb.className = "thumb";

  const img = document.createElement("img");
  img.className = "img";
  img.alt = npc.Name;
  img.loading = "lazy";
  img.classList.add("missing");

  // lazy-load binding
  img.__npc = npc;
  img.__imgLoaded = false;
  observer?.observe(img);

  thumb.appendChild(img);

  /* ---------- Party button (MÅSTE SKAPAS FÖRE body.appendChild) ---------- */
  const partyBtn = document.createElement("button");
  partyBtn.type = "button";

  const already = inParty(npc.id);
  partyBtn.className =
    "btn btn-sm party-btn " +
    (already ? "btn-outline-secondary" : "btn-outline-primary");

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

  /* ---------- Body (name + meta + button) ---------- */
  const body = document.createElement("div");
  body.className = "npc-body";

  const name = document.createElement("div");
  name.className = "npc-name";
  name.textContent = npc.Name;

  const meta = document.createElement("div");
  meta.className = "npc-meta";
  meta.textContent = [npc.Origin, npc.Heritage].filter(Boolean).join(" • ");

  body.appendChild(name);
  if (meta.textContent) body.appendChild(meta);
  body.appendChild(partyBtn);

  /* ---------- Assemble ---------- */
  card.appendChild(thumb);
  card.appendChild(body);

  /* ---------- Open modal ---------- */
  card.addEventListener("click", () => onOpenModal(index));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenModal(index);
    }
  });

  return card;
}

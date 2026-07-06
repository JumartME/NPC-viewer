// modules/render/card.js
import { inParty, addToParty } from "../party.js";

function clean(v){
  return String(v ?? "").trim();
}

function buildMetaText(npc){
  const lines = [];

  const line1 = [npc.Heritage, npc.Concept].filter(Boolean).join(" ");
  if (line1) lines.push(line1);

  if (npc.Group) lines.push(npc.Group);

  return lines.join("\n"); // CSS: white-space: pre-line
}

export function buildRow({
  npc,
  index,
  imageResolver,          // används av observern
  onOpenModal,
  onImageRefResolved,
  onPartyChanged,
  observer,
}) {
  const card = document.createElement("div");
  card.className = "npc-card npc-row";
  card.dataset.index = String(index);
  card.tabIndex = 0;

  /* ---------- Thumbnail ---------- */
  const thumb = document.createElement("div");
  thumb.className = "thumb";

  const img = document.createElement("img");
  img.className = "img missing";
  img.alt = npc.Name;
  img.loading = "lazy";

  // lazy-load binding
  img.__npc = npc;
  img.__imgLoaded = false;
  observer?.observe(img);

  thumb.appendChild(img);

  /* ---------- Body ---------- */
  const body = document.createElement("div");
  body.className = "npc-body";

  const name = document.createElement("div");
  name.className = "npc-name";
  name.textContent = npc.Name;

  const meta = document.createElement("div");
  meta.className = "npc-meta";
  meta.textContent = buildMetaText(npc);

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
    if (inParty(npc.id)) return;

    addToParty(npc.id);

    partyBtn.textContent = "In Party";
    partyBtn.disabled = true;
    partyBtn.className = "btn btn-sm party-btn btn-outline-secondary";

    onPartyChanged?.();
  });

  body.appendChild(name);
  body.appendChild(meta);
  body.appendChild(partyBtn);

  /* ---------- Assemble ---------- */
  card.appendChild(thumb);
  card.appendChild(body);

  card.addEventListener("click", () => onOpenModal(index));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenModal(index);
    }
  });

  return card;
}

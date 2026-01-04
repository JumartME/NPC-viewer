// modules/render/list.js
import { buildRow } from "./card.js";

export function renderList({
  listEl,
  dataset,
  imageResolver,
  onOpenModal,
  onImageRefResolved,
  onPartyChanged,
}) {
  listEl.innerHTML = "";
  dataset.forEach((npc, i) => {
    listEl.appendChild(
      buildRow({
        npc,
        index: i,
        imageResolver,
        onOpenModal,
        onImageRefResolved,
        onPartyChanged,
      })
    );
  });
}

// modules/render/list.js
import { buildRow } from "./card.js";
import { setImgForNpc } from "../images.js";
let gridImgObserver = null;

let gridObserver = null;

function resetGridObserver() {
  if (gridObserver) {
    gridObserver.disconnect();
    gridObserver = null;
  }
}

function getGridObserver({ imageResolver, onImageRefResolved }) {
  // Skapa ny observer per render (så vi inte håller kvar gamla img refs)
  gridObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;

        const imgEl = e.target;
        gridObserver.unobserve(imgEl);

        if (imgEl.__imgLoaded) continue;
        imgEl.__imgLoaded = true;

        const npc = imgEl.__npc;
        if (!npc) continue;

        setImgForNpc({
          imgEl,
          npc,
          imageResolver,
          onImageRefResolved,
        }).catch((err) => console.warn("Lazy image load failed:", err));
      }
    },
    { rootMargin: "400px", threshold: 0.01 }
  );

  return gridObserver;
}

export function renderList({
  listEl,
  dataset,
  imageResolver,
  onOpenModal,
  onImageRefResolved,
  onPartyChanged,
}) {
  listEl.innerHTML = "";

  // Lazy-load: ny observer per render
  resetGridObserver();
  const observer = getGridObserver({ imageResolver, onImageRefResolved });

  dataset.forEach((npc, i) => {
    listEl.appendChild(
      buildRow({
        npc,
        index: i,
        imageResolver,
        onOpenModal,
        onImageRefResolved,
        onPartyChanged,
        observer, // ✅ ny
      })
    );
  });
}

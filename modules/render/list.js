// modules/render/list.js
import { buildRow } from "./card.js";
import { setImgForNpc } from "../images.js";
let gridImgObserver = null;

function getGridImgObserver({ imageResolver, onImageRefResolved }) {
  // Skapa en ny observer varje gång vi renderar om (vi reset:ar i renderList)
  gridImgObserver = new IntersectionObserver(
    
    (entries) => {
        if (gridImgObserver) {
            gridImgObserver.disconnect();
            gridImgObserver = null;
        }
        const observer = getGridImgObserver({ imageResolver, onImageRefResolved });

      for (const e of entries) {
        if (!e.isIntersecting) continue;

        const imgEl = e.target;
        gridImgObserver.unobserve(imgEl);

        // Undvik dubbel-laddning
        if (imgEl.dataset.imgLoaded === "1") continue;
        imgEl.dataset.imgLoaded = "1";

        // Hämta NPC-index från dataset-attribut
        const i = Number(imgEl.dataset.npcIndex);
        const arr = window.__npc?.view || window.__npc?.dataset || [];
        const npc = arr[i];
        if (!npc) continue;

        // Placeholder först
        imgEl.classList.add("missing");
        imgEl.removeAttribute("src");
        imgEl.loading = "lazy";

        // Spara index så observern kan hitta npc igen
        imgEl.dataset.npcIndex = String(i);      // i = index i listan du renderar
        imgEl.dataset.imgLoaded = "0";

        // Lazy-load först när den syns
        observer.observe(imgEl);
      }
    },
    { rootMargin: "400px 0px 400px 0px", threshold: 0.01 }
  );

  return gridImgObserver;
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

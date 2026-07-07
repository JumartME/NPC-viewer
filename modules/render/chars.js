// modules/render/chars.js
import { toNumber } from "./dom.js";

export const CHARACTERISTICS = [
  "Intelligence","Agility","Expression",
  "Perception","Dexterity","Cunning",
  "Will","Stamina","Presence",
  "Wits","Strength","Wisdom"
];

export function renderCharsGrid(container, npc, onNpcChanged) {
  container.innerHTML = "";

  for (const k of CHARACTERISTICS) {
    const row = document.createElement("div");
    row.className = "char-item";

    const kc = document.createElement("div");
    kc.className = "k";
    kc.textContent = k;

    const input = document.createElement("input");
    input.className = "form-control form-control-sm v";
    input.type = "number";
    input.step = "1";
    input.value = String(toNumber(npc[k]));

    input.addEventListener("input", () => {
      npc[k] = input.value === "" ? "" : Number(input.value);
      onNpcChanged?.(npc);
    });

    row.appendChild(kc);
    row.appendChild(input);
    container.appendChild(row);
  }
}

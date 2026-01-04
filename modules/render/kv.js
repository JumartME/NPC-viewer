// modules/render/kv.js
import { clean } from "./dom.js";

export function kvSet(container, pairs) {
  container.innerHTML = "";
  kvAppend(container, pairs);
}

export function kvAppend(container, pairs) {
  for (const [k, v] of pairs) {
    const val = clean(v);
    if (!val) continue;

    const row = document.createElement("div");
    row.className = "row g-2";

    const kc = document.createElement("div");
    kc.className = "col-5 col-xl-4 k";
    kc.textContent = k;

    const vc = document.createElement("div");
    vc.className = "col-7 col-xl-8 v";
    vc.textContent = val;

    row.appendChild(kc);
    row.appendChild(vc);
    container.appendChild(row);
  }
}

export function selectRow({ label, value, options, onChange }) {
  const row = document.createElement("div");
  row.className = "row g-2 align-items-center";

  const kc = document.createElement("div");
  kc.className = "col-5 col-xl-4 k";
  kc.textContent = label;

  const vc = document.createElement("div");
  vc.className = "col-7 col-xl-8 v";

  const sel = document.createElement("select");
  sel.className = "form-select form-select-sm";

  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    if (opt === value) o.selected = true;
    sel.appendChild(o);
  }

  sel.addEventListener("change", () => onChange?.(sel.value));
  vc.appendChild(sel);

  row.appendChild(kc);
  row.appendChild(vc);
  return row;
}

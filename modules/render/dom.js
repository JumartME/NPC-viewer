// modules/render/dom.js
export function qs(id) {
  return document.getElementById(id);
}

export function clean(v) {
  return String(v ?? "").trim();
}

export function toNumber(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

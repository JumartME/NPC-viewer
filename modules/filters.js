// modules/filters.js
// Ansvar: filter-UI (options), matchning, sortering

function clean(v) {
  return String(v ?? "").trim();
}

function uniqueSorted(arr) {
  const s = new Set(arr.filter(Boolean));
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}

function setOptions(select, values, allLabel) {
  if (!select) return;
  select.innerHTML = "";

  const all = document.createElement("option");
  all.value = "";
  all.textContent = allLabel;
  select.appendChild(all);

  values.forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  });
}

export function initFiltersUI({ els, dataset }) {
  // dropdowns
  setOptions(els.origin, uniqueSorted(dataset.map((n) => n.Origin)), "All Origins");
  setOptions(els.reputation, ["Hostile", "Friendly", "Neutral", "Player"], "All Reputation");
  setOptions(els.concept, uniqueSorted(dataset.map((n) => n.Concept)), "All Concepts");
  setOptions(els.gender, uniqueSorted(dataset.map((n) => n.Gender)), "All Genders");

  // sort options
  if (els.sort) {
    els.sort.innerHTML = "";
    [
      ["name_asc", "Name (A–Z)"],
      ["name_desc", "Name (Z–A)"],
      ["origin_asc", "Origin (A–Z)"],
      ["relation", "Relation"],
      ["reputation", "Reputation"],
      ["concept_asc", "Concept (A–Z)"],
    ].forEach(([v, label]) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = label;
      els.sort.appendChild(o);
    });
    els.sort.value = els.sort.value || "name_asc";
  }
}

// ---- Relations ordering (som din gamla) ----
const REL_ORDER = ["Recruited", "Met", "Unknown", "Imprisoned", "Defeated"];
const REP_ORDER = ["Player", "Friendly", "Neutral", "Hostile"];
function relRank(n) {
  const i = REL_ORDER.indexOf(n.Relation);
  return i < 0 ? 999 : i;
}
function repRank(n) {
  const i = REP_ORDER.indexOf(n.Reputation);
  return i < 0 ? 999 : i;
}

export function matchesFilters({ els, npc }) {
  const q = (els.q?.value || "").trim().toLowerCase();
  const origin = els.origin?.value || "";
  const rep = els.reputation?.value || "";
  const concept = els.concept?.value || "";
  const gender = els.gender?.value || "";

  if (q && !String(npc.Name || "").toLowerCase().includes(q)) return false;
  if (origin && npc.Origin !== origin) return false;
  if (rep && npc.Reputation !== rep) return false;
  if (concept && npc.Concept !== concept) return false;
  if (gender && npc.Gender !== gender) return false;

  // relation checkboxes
  if (els.relAll && !els.relAll.checked) {
    const selected =
      (els.relationCbs || [])
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);

    if (selected.length > 0 && !selected.includes(npc.Relation)) return false;
  }

  return true;
}

export function sortNpcs({ els, arr }) {
  const mode = els.sort?.value || "name_asc";
  const copy = arr.slice();

  copy.sort((a, b) => {
    if (mode === "name_asc") return (a.Name || "").localeCompare(b.Name || "");
    if (mode === "name_desc") return (b.Name || "").localeCompare(a.Name || "");

    if (mode === "origin_asc") {
      const c = (a.Origin || "").localeCompare(b.Origin || "");
      return c !== 0 ? c : (a.Name || "").localeCompare(b.Name || "");
    }

    if (mode === "relation") {
      const c = relRank(a) - relRank(b);
      return c !== 0 ? c : (a.Name || "").localeCompare(b.Name || "");
    }

    if (mode === "reputation") {
      const c = repRank(a) - repRank(b);
      return c !== 0 ? c : (a.Name || "").localeCompare(b.Name || "");
    }

    if (mode === "concept_asc") {
      const c = (a.Concept || "").localeCompare(b.Concept || "");
      return c !== 0 ? c : (a.Name || "").localeCompare(b.Name || "");
    }

    return (a.Name || "").localeCompare(b.Name || "");
  });

  return copy;
}

// (valfritt) håll "Visa alla" i sync om du vill behålla beteendet
export function wireRelationCheckboxes({ els, onChange }) {
  if (!els.relAll || !els.relationCbs?.length) return;

  const syncRelAll = () => {
    const anyChecked = els.relationCbs.some((cb) => cb.checked);
    if (!anyChecked) els.relAll.checked = true;
  };

  els.relAll.addEventListener("change", () => {
    if (els.relAll.checked) {
      els.relationCbs.forEach((cb) => (cb.checked = false));
    } else {
      syncRelAll();
    }
    onChange?.();
  });

  els.relationCbs.forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) els.relAll.checked = false;
      else syncRelAll();
      onChange?.();
    });
  });

  // initial safety
  syncRelAll();
}

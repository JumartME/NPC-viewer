// modules/action.js

const CHARACTERISTICS = [
  "Intelligence","Perception","Will","Wits",
  "Agility","Dexterity","Stamina","Strength",
  "Expression","Cunning","Presence","Wisdom"
];

function qs(id) {
  return document.getElementById(id);
}

function toNumber(v) {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function rollD12() {
  return Math.floor(Math.random() * 12) + 1;
}

export function initActionUI() {
  const els = {
    actChar: qs("actChar"),
    actSkill: qs("actSkill"),
    actRoll: qs("actRoll"),
    actResult: qs("actResult"),
  };

  // Om UI saknas (t.ex. HTML ändras), krascha inte.
  if (!els.actChar || !els.actSkill || !els.actRoll || !els.actResult) {
    return { setNpc: () => {}, refresh: () => {} };
  }

  let currentNpc = null;

  function buildCharOptions(n) {
    els.actChar.innerHTML = "";
    for (const k of CHARACTERISTICS) {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = `${k} (${toNumber(n?.[k])})`;
      els.actChar.appendChild(opt);
    }
  }

  function buildSkillOptions(n) {
    els.actSkill.innerHTML = "";

    const skills = (n?.skills && typeof n.skills === "object") ? n.skills : {};
    const keys = Object.keys(skills).sort((a,b)=>a.localeCompare(b));

    if (keys.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No skills found";
      opt.disabled = true;
      opt.selected = true;
      els.actSkill.appendChild(opt);
      return;
    }

    for (const sk of keys) {
      const opt = document.createElement("option");
      opt.value = sk;
      opt.textContent = `${sk} (${toNumber(skills[sk])})`;
      els.actSkill.appendChild(opt);
    }
  }

  function setNpc(n) {
    currentNpc = n;

    buildCharOptions(currentNpc);
    buildSkillOptions(currentNpc);

    els.actResult.innerHTML = `<span class="text-secondary">Choose values and roll.</span>`;
  }

  // Bygg om dropdowns från currentNpc (kalla när NPC editeras i modalen)
  function refresh() {
    if (!currentNpc) return;

    const prevChar = els.actChar.value;
    const prevSkill = els.actSkill.value;

    buildCharOptions(currentNpc);
    buildSkillOptions(currentNpc);

    // försök behålla val
    if (prevChar) els.actChar.value = prevChar;
    if (prevSkill) els.actSkill.value = prevSkill;
  }

  function runActionRoll() {
    const n = currentNpc;
    if (!n) {
      els.actResult.innerHTML = `<div class="text-danger fw-semibold">Open an NPC first.</div>`;
      return;
    }

    const charKey = els.actChar.value;
    const skillKey = els.actSkill.value;
    if (!skillKey) {
      els.actResult.innerHTML = `<div class="text-danger fw-semibold">Pick a skill first.</div>`;
      return;
    }

    const skills = (n.skills && typeof n.skills === "object") ? n.skills : {};
    const charVal = toNumber(n[charKey]);
    const skillVal = toNumber(skills[skillKey] ?? 0);

    const total = charVal + skillVal;
    const die = rollD12();
    const result = total - die;
    const ok = result >= 0;

    els.actResult.innerHTML = `
      <div class="fw-semibold ${ok ? "text-success" : "text-danger"}">
        ${ok ? "Success" : "Failure"} (${result})
      </div>
      <div class="small text-secondary">
        (${charKey} ${charVal} + ${skillKey} ${skillVal}) - d12(${die}) = ${result}
      </div>
    `;
  }

  els.actRoll.addEventListener("click", runActionRoll);

  return { setNpc, refresh };
}

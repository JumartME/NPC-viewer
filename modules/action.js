// modules/action.js
// Ansvar: Action UI i NPC-modalen (choose characteristic+skill, roll)

// matchar din app
const CHARACTERISTICS = [
  "Intelligence","Perception","Will","Wits",
  "Agility","Dexterity","Stamina","Strength",
  "Expression","Instinct","Presence","Wisdom"
];

function toNumber(v) {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function rollD12() {
  return Math.floor(Math.random() * 12) + 1;
}

// Din befintliga format: "Stealth: 2, Athletics: 1" (colon krävs)
function parseSkillsMap(skillsText) {
  const text = String(skillsText ?? "").trim();
  const map = new Map();
  if (!text) return map;

  const parts = text.split(/[,;\n]+/g).map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    const m = part.match(/^(.+?)\s*:\s*(-?\d+(?:[.,]\d+)?)\s*$/);
    if (!m) continue;
    const name = m[1].trim();
    const val = Number(m[2].replace(",", "."));
    if (!name || !Number.isFinite(val)) continue;
    map.set(name, val);
  }
  return map;
}

export function initActionUI({
  charSelectId = "actChar",
  skillSelectId = "actSkill",
  rollBtnId = "actRoll",
  resultId = "actResult",
} = {}) {
  const charSel = document.getElementById(charSelectId);
  const skillSel = document.getElementById(skillSelectId);
  const rollBtn = document.getElementById(rollBtnId);
  const resultEl = document.getElementById(resultId);

  if (!charSel || !skillSel || !rollBtn || !resultEl) {
    // om du inte har UI:t i DOM ännu: gör inget
    return { setNpc: () => {} };
  }

  let currentNpc = null;

  function setNpc(n) {
    currentNpc = n;

    // characteristics
    charSel.innerHTML = "";
    for (const k of CHARACTERISTICS) {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = `${k} (${toNumber(n?.[k])})`;
      charSel.appendChild(opt);
    }

    // skills
    skillSel.innerHTML = "";
    const skillsMap = parseSkillsMap(n?.Skills);
    const keys = Array.from(skillsMap.keys()).sort((a,b)=>a.localeCompare(b));

    if (keys.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No skills found";
      opt.disabled = true;
      opt.selected = true;
      skillSel.appendChild(opt);
    } else {
      for (const sk of keys) {
        const opt = document.createElement("option");
        opt.value = sk;
        opt.textContent = `${sk} (${skillsMap.get(sk)})`;
        skillSel.appendChild(opt);
      }
    }

    resultEl.innerHTML = `<span class="text-secondary">Choose values and roll.</span>`;
  }

  function runRoll() {
    if (!currentNpc) {
      resultEl.innerHTML = `<div class="text-danger fw-semibold">Open an NPC first.</div>`;
      return;
    }

    const charKey = charSel.value;
    const skillKey = skillSel.value;

    if (!skillKey) {
      resultEl.innerHTML = `<div class="text-danger fw-semibold">Pick a skill first.</div>`;
      return;
    }

    const charVal = toNumber(currentNpc[charKey]);
    const skillsMap = parseSkillsMap(currentNpc.Skills);
    const skillVal = toNumber(skillsMap.get(skillKey));

    const total = charVal + skillVal;
    const die = rollD12();
    const result = total - die;

    const ok = result >= 0;

    resultEl.innerHTML = `
      <div class="fw-semibold ${ok ? "text-success" : "text-danger"}">
        ${ok ? "Success" : "Failure"} (${result})
      </div>
      <div class="small text-secondary">
        (${charKey} ${charVal} + ${skillKey} ${skillVal}) - d12(${die}) = ${result}
      </div>
    `;
  }

  rollBtn.addEventListener("click", runRoll);

  return { setNpc };
}

// modules/render/skills.js
export function renderSkillsGrid(container, npc, onNpcChanged) {
  container.innerHTML = "";
  container.classList.remove("skills-grid");

  const skills = npc.skills || {};
  const keys = Object.keys(skills).sort((a, b) => a.localeCompare(b));

  if (keys.length === 0) {
    container.textContent = "—";
    return;
  }

  container.classList.add("skills-grid");

  for (const k of keys) {
    const item = document.createElement("div");
    item.className = "skill-item";

    const name = document.createElement("div");
    name.className = "k";
    name.textContent = k;

    const input = document.createElement("input");
    input.className = "form-control form-control-sm v";
    input.type = "number";
    input.step = "1";
    input.value = String(skills[k] ?? "");

    input.addEventListener("input", () => {
      npc.skills = npc.skills || {};
      npc.skills[k] = input.value === "" ? "" : Number(input.value);
      onNpcChanged?.(npc);
    });

    item.appendChild(name);
    item.appendChild(input);
    container.appendChild(item);
  }
}

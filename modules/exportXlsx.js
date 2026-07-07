// modules/exportXlsx.js
// Kräver att SheetJS (XLSX) är laddat globalt via CDN: window.XLSX

function clean(v) {
  return String(v ?? "").trim();
}

function buildWorkbook({
  npcs,
  includeSkillsColumns = true,
  skillKeys = [],
} = {}) {
  if (!window.XLSX) throw new Error("XLSX saknas. Ladda SheetJS före app.js.");
  if (!Array.isArray(npcs) || npcs.length === 0) throw new Error("Ingen data att exportera.");

  const rows = npcs.map((n) => {
    const base = {
      Name: clean(n.Name),
      Origin: clean(n.Origin),
      Species: clean(n.Species),
      Concept: clean(n.Concept),
      Description: clean(n.Description),
      Reputation: clean(n.Reputation),
      Relation: clean(n.Relation),

      Gender: clean(n.Gender),
      Age: clean(n.Age),

      Size: clean(n.Size),
      Health: clean(n.Health),
      Spirit: clean(n.Spirit),
      MP: clean(n.MP),

      Special: clean(n.Special),
      Magic: clean(n.Magic),
      Healing: clean(n.Healing),
      wpn: clean(n.wpn),
      arm: clean(n.arm),

      Equipment: clean(n.Equipment),
      Weapon: clean(n.Weapon),
      Armor: clean(n.Armor),
      Shield: clean(n.Shield),

      Intelligence: clean(n.Intelligence),
      Perception: clean(n.Perception),
      Will: clean(n.Will),
      Wits: clean(n.Wits),
      Agility: clean(n.Agility),
      Dexterity: clean(n.Dexterity),
      Stamina: clean(n.Stamina),
      Strength: clean(n.Strength),
      Expression: clean(n.Expression),
      Cunning: clean(n.Cunning),
      Presence: clean(n.Presence),
      Wisdom: clean(n.Wisdom),
    };

    if (includeSkillsColumns) {
      const skills = n.skills || {};
      for (const k of skillKeys) base[k] = skills[k] ?? "";
    }

    return base;
  });

  const ws = window.XLSX.utils.json_to_sheet(rows, { skipHeader: false });
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, "Info");
  return wb;
}

function workbookToArrayBuffer(wb) {
  // SheetJS: type:"array" ger ArrayBuffer
  return window.XLSX.write(wb, { bookType: "xlsx", type: "array" });
}

async function saveArrayBufferAsXlsx(arrayBuffer, filename) {
  const suggestedName = filename || "data_export.xlsx";

  // Best UX: användaren väljer plats
  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: "Excel Workbook",
          accept: {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
          },
        },
      ],
    });

    const writable = await handle.createWritable();
    await writable.write(arrayBuffer);
    await writable.close();
    return { method: "picker" };
  }

  // Fallback: vanlig download (browser väljer plats)
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  return { method: "download" };
}

export async function exportNpcsToXlsx({
  npcs,
  filename = "data_export.xlsx",
  includeSkillsColumns = true,
  skillKeys = [],
} = {}) {
  const wb = buildWorkbook({ npcs, includeSkillsColumns, skillKeys });
  const arrayBuffer = workbookToArrayBuffer(wb);
  return await saveArrayBufferAsXlsx(arrayBuffer, filename);
}

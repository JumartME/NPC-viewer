// modules/parse.js
// Ansvar: XLSX → rows → NPC-objekt → {count, updatedAt, npcs}

// ===== Helpers
function clean(v) {
  return String(v ?? "").trim();
}

function normEnum(v, allowedLower, fallback) {
  const s = clean(v).toLowerCase();
  if (!s) return fallback;
  return allowedLower.includes(s)
    ? s.charAt(0).toUpperCase() + s.slice(1)
    : fallback;
}

// ===== Identifierar separatorrader (oförändrat beteende)
function isSeparatorRow(row) {
  const name = clean(row.Name);
  if (!name) return false;

  const fieldsToCheck = [
    "Gender","Age","Species","Concept","Description","Origin",
    "Equipment","Armor","Shield","Weapon","Magic","Special",
    "Healing","Agility","Strength","Dexterity","Stamina","Intelligence",
    "Perception","Will","Wits","Expression","Instinct","Presence","Wisdom",
    "Skills","Size","Health","Spirit","MP","wpn","arm","Reputation","Relation"
  ];

  for (const f of fieldsToCheck) {
    if (clean(row[f]) !== "") return false;
  }
  return true;
}

// ===== Row → NPC (din befintliga struktur, oförändrad)
export function rowToNpc(row) {
  const Name = clean(row.Name);
  if (!Name) return null;
  if (isSeparatorRow(row)) return null;

  return {
    id: Name.toLowerCase().replace(/\s+/g, "-"),

    Name,
    Origin: clean(row.Origin),

    Reputation: normEnum(
      row.Reputation,
      ["hostile","friendly","neutral","player"],
      "Neutral"
    ),
    Relation: normEnum(
      row.Relation,
      ["unknown","met","recruited","defeated","imprisoned"],
      "Unknown"
    ),

    Gender: clean(row.Gender),
    Age: clean(row.Age),
    Species: clean(row.Species),
    Concept: clean(row.Concept),
    Description: clean(row.Description),

    Equipment: clean(row.Equipment),
    Armor: clean(row.Armor),
    Shield: clean(row.Shield),
    Weapon: clean(row.Weapon),
    Magic: clean(row.Magic),
    Special: clean(row.Special),

    Healing: clean(row.Healing),
    Agility: clean(row.Agility),
    Strength: clean(row.Strength),
    Dexterity: clean(row.Dexterity),
    Stamina: clean(row.Stamina),
    Intelligence: clean(row.Intelligence),
    Perception: clean(row.Perception),
    Will: clean(row.Will),
    Wits: clean(row.Wits),
    Expression: clean(row.Expression),
    Instinct: clean(row.Instinct),
    Presence: clean(row.Presence),
    Wisdom: clean(row.Wisdom),

    Skills: clean(row.Skills),
    Size: clean(row.Size),
    Health: clean(row.Health),
    Spirit: clean(row.Spirit),
    MP: clean(row.MP),
    wpn: clean(row.wpn),
    arm: clean(row.arm),
    MagicStat: clean(row["Magic "] || ""),
  };
}

// ===== XLSX buffer → rows
export async function parseXlsxBuffer(buf) {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

// ===== rows → {updatedAt, count, npcs}
export function rowsToJson(rows) {
  const npcs = rows.map(rowToNpc).filter(Boolean);
  return {
    updatedAt: new Date().toISOString(),
    count: npcs.length,
    npcs,
  };
}

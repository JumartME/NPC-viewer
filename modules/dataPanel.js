// modules/dataPanel.js

export function initDataPanel({
  // state getters
  getDataset,
  getView,
  getImageResolver,
    clearAll,
  // actions
  setStatus,
  applyDataFromJson,       // (json, { imageResolver? }) => void  (du kan bara anropa din applyData + sätta imageResolver före)
  setImageResolver,        // (resolver) => void
  onPartyChanged,          // () => void (din gemensamma uppdaterare)

  // deps
  oneDrive,                // createOneDriveClient(...)
  parseXlsxBuffer,         // (arrayBuffer)=>rows
  rowsToJson,              // (rows)=>json
  saveCache,
  clearCache,

  // excel export
  exportNpcsToXlsx,         // ({npcs, filename})=>void
  skillKeys = [],
} = {}) {
  const btnExport = document.getElementById("btnExportXlsx");
  const fileImport = document.getElementById("fileImportXlsx");
  const btnOneDriveLink = document.getElementById("btnOneDriveLink");
  const btnLogout = document.getElementById("btnLogout");
  const btnClear = document.getElementById("btnClearCache");

    function hidePanel() {
    const panelEl = document.getElementById("dataPanel");
    if (!panelEl) return;
    const inst = bootstrap.Offcanvas.getInstance(panelEl) || bootstrap.Offcanvas.getOrCreateInstance(panelEl);
    inst.hide();
    }

  // Export
// Export
btnExport?.addEventListener("click", async () => {
  const view = getView?.() || [];
  const dataset = getDataset?.() || [];

  // Rekommendation: exportera ALLTID dataset så du inte råkar exportera bara filtervyn
  const npcs = dataset;

  try {
    setStatus?.("Exporting Excel...");
    await exportNpcsToXlsx({
      npcs,
      filename: "data.xlsx", // om du vill uppmuntra samma namn
      includeSkillsColumns: true,
      skillKeys,
    });
    hidePanel();
    setStatus?.("Export complete ✔");
  } catch (e) {
    // Om användaren avbryter Save Picker blir det ofta en AbortError
    if (e?.name === "AbortError") {
      setStatus?.("Export cancelled.");
      return;
    }
    console.error(e);
    alert(e?.message || String(e));
    setStatus?.("Export failed.");
  }
});

  // Import local
  fileImport?.addEventListener("change", async () => {
    const file = fileImport.files?.[0];
    if (!file) return;

    try {
      setStatus?.("Reading local Excel...");
      const buf = await file.arrayBuffer();
      const rows = await parseXlsxBuffer(buf);
      const json = rowsToJson(rows);

      // du vill inte ha local images — men data-cachen är ok
      saveCache(json);
      applyDataFromJson(json); // din app ska rendera efter detta
        hidePanel();
      setStatus?.(`Loaded ${json.count} NPCs (local) ✔`);
    } catch (e) {
      console.error(e);
      alert(e?.message || String(e));
      setStatus?.("Failed to read local Excel.");
    } finally {
      fileImport.value = "";
    }
  });

  // OneDrive link load
  btnOneDriveLink?.addEventListener("click", async () => {
    try {
      const url = prompt("Klistra in OneDrive-länk till mappen (eller till data.xlsx):");
      if (!url) return;

      setStatus?.("Loading from OneDrive...");
      const { json, imageResolver } = await oneDrive.loadFromOneDriveLink({
        shareUrl: url,
        parseXlsxBuffer,
        rowsToJson,
        setStatus,
      });

      setImageResolver?.(imageResolver);
      saveCache(json);
      applyDataFromJson(json);
        hidePanel();
      onPartyChanged?.();

      setStatus?.(`Loaded ${json.count} NPCs from OneDrive ✔`);
    } catch (e) {
      console.error(e);
      alert(e?.message || String(e));
      setStatus?.("OneDrive load failed.");
    }
  });

  // Logout
  btnLogout?.addEventListener("click", async () => {
    try {
      await oneDrive.logout();
      setStatus?.("Logged out.");
    } catch (e) {
      console.error(e);
      alert("Logout failed.\n" + (e?.message || String(e)));
    }
  });

    btnClear?.addEventListener("click", async () => {
        try {
            await clearAll?.();
            setStatus?.("Cache cleared.");
        } catch (e) {
            console.error(e);
            alert(e?.message || String(e));
        }
    });
}

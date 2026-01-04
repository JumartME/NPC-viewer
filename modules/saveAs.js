// modules/saveAs.js
export async function saveArrayBufferAsXlsx(arrayBuffer, suggestedName = "data.xlsx") {
  // Prefer native save picker when available (Chrome/Edge)
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

  // Fallback: regular download (browser decides location)
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

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
}

async function pickOneDriveFolder() {
  const channelId = uuid();

  const options = {
    sdk: "8.0",
    entry: { oneDrive: {} },          // OneDrive entry :contentReference[oaicite:7]{index=7}
    authentication: {},               // krävs för att få item-data / iframe-scenarion :contentReference[oaicite:8]{index=8}
    messaging: {
      origin: window.location.origin,
      channelId
    },
    // Viktigt: filter folder selection (schema stödjer 'folder') :contentReference[oaicite:9]{index=9}
    typesAndSources: {
      filters: ["folder"],
      mode: "folders"
    },
    selection: { mode: "single" }
  };

  const queryString = new URLSearchParams({
    filePicker: JSON.stringify(options),
    locale: "sv-se"
  });

  const pickerUrl = `${PICKER_BASE_URL}/_layouts/15/FilePicker.aspx?${queryString.toString()}`;

  // Popup
  const win = window.open("", "Picker", "width=1080,height=680");
  if (!win) throw new Error("Popup blockerade pickern. Tillåt popups och försök igen.");

  // Token till pickern-resursen (inte Graph)
  const pickerToken = await getTokenForResource(PICKER_BASE_URL);

  // POST-form in i popupen :contentReference[oaicite:10]{index=10}
  const form = win.document.createElement("form");
  form.setAttribute("action", pickerUrl);
  form.setAttribute("method", "POST");

  const tokenInput = win.document.createElement("input");
  tokenInput.setAttribute("type", "hidden");
  tokenInput.setAttribute("name", "access_token");
  tokenInput.setAttribute("value", pickerToken);
  form.appendChild(tokenInput);

  win.document.body.appendChild(form);
  form.submit();

  return await new Promise((resolve, reject) => {
    let port = null;

    function cleanup() {
      window.removeEventListener("message", onMessage);
      try { port?.close?.(); } catch {}
      try { win?.close?.(); } catch {}
    }

    async function onMessage(event) {
      if (event.source !== win) return;
      const msg = event.data;

      if (msg?.type === "initialize" && msg.channelId === channelId) {
        port = event.ports[0];
        port.onmessage = onPortMessage;
        port.start();
        port.postMessage({ type: "activate" });
      }
    }

    async function onPortMessage(e) {
      const payload = e.data;

      if (payload?.type === "notification") {
        // page-loaded etc. :contentReference[oaicite:11]{index=11}
        return;
      }

      if (payload?.type === "command") {
        // Ack alla commands :contentReference[oaicite:12]{index=12}
        port.postMessage({ type: "acknowledge", id: payload.id });

        const cmd = payload?.data?.command;

        if (cmd === "authenticate") {
          try {
            // Picker kan be om nya tokens senare också :contentReference[oaicite:13]{index=13}
            const t = await getTokenForResource(PICKER_BASE_URL);
            port.postMessage({
              type: "result",
              id: payload.id,
              data: { result: "token", token: t }
            });
          } catch (err) {
            port.postMessage({
              type: "result",
              id: payload.id,
              data: { result: "error", error: String(err?.message || err) }
            });
          }
          return;
        }

        if (cmd === "pick") {
          // Picker returnerar array av items med id + parentReference.driveId :contentReference[oaicite:14]{index=14}
          const items = payload?.data?.items || payload?.data?.value || [];
          const item = items[0];
          if (!item?.id || !item?.parentReference?.driveId) {
            cleanup();
            reject(new Error("Fick inget folder-id från pickern."));
            return;
          }
          cleanup();
          resolve({ driveId: item.parentReference.driveId, folderId: item.id });
          return;
        }

        if (cmd === "close") {
          cleanup();
          reject(new Error("Picker stängdes."));
          return;
        }
      }
    }

    window.addEventListener("message", onMessage);
  });
}

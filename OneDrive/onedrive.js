// onedrive.js
// OneDrive/Entra + Folder Picker v8 + Graph helpers + Image resolver
// Requires: msal-browser loaded globally (window.msal)

function uuid() {
  return (crypto?.randomUUID?.() ?? (String(Date.now()) + Math.random()));
}

function must(condition, message) {
  if (!condition) throw new Error(message);
}

export function createOneDriveClient({
  clientId,
  authority = "https://login.microsoftonline.com/common",
  redirectUri = window.location.origin,
  graphScopes = ["User.Read", "Files.Read"],

  // For work/school OneDrive: https://<TENANT>-my.sharepoint.com
  // For personal OneDrive: https://onedrive.live.com/picker
  pickerBaseUrl,

  // Picker typically needs SharePoint MyFiles.* permission; scope format for MSAL is `${resource}/MyFiles.Read`
  pickerScopes = null, // default computed from pickerBaseUrl
} = {}) {
  must(typeof window !== "undefined", "This module must run in a browser.");
  must(window.msal, "msal-browser is not loaded. Add msal-browser script tag before app.js.");
  must(clientId, "Missing clientId.");
  must(pickerBaseUrl, "Missing pickerBaseUrl (e.g. https://TENANT-my.sharepoint.com or https://onedrive.live.com/picker).");

  const msalInstance = new window.msal.PublicClientApplication({
    auth: { clientId, authority, redirectUri }
  });

  async function ensureLoggedIn() {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) return accounts[0];
    await msalInstance.loginPopup({ scopes: graphScopes });
    return msalInstance.getAllAccounts()[0];
  }

  async function getGraphToken() {
    const account = await ensureLoggedIn();
    try {
      const r = await msalInstance.acquireTokenSilent({ account, scopes: graphScopes });
      return r.accessToken;
    } catch {
      const r = await msalInstance.acquireTokenPopup({ scopes: graphScopes });
      return r.accessToken;
    }
  }

  async function getTokenForResource(resource, scopes) {
    const account = await ensureLoggedIn();
    const useScopes =
      (scopes && scopes.length) ? scopes :
      (pickerScopes && pickerScopes.length) ? pickerScopes :
      // default om inget angivet:
      (resource === "https://onedrive.live.com/picker") ? ["OneDrive.ReadOnly"] : [`${resource}/MyFiles.Read`];

    try {
      const r = await msalInstance.acquireTokenSilent({ account, scopes: useScopes });
      return r.accessToken;
    } catch {
      const r = await msalInstance.acquireTokenPopup({ scopes: useScopes });
      return r.accessToken;
    }
  }

  async function graphFetch(token, path) {
    const res = await fetch("https://graph.microsoft.com/v1.0" + path, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res;
  }

  async function listChildren(token, driveId, itemId, select) {
    const qs = select ? `?$select=${encodeURIComponent(select)}` : "";
    const res = await graphFetch(token, `/drives/${driveId}/items/${itemId}/children${qs}`);
    const json = await res.json();
    return json.value || [];
  }

  async function downloadContentArrayBuffer(token, driveId, itemId) {
    const res = await graphFetch(token, `/drives/${driveId}/items/${itemId}/content`);
    return res.arrayBuffer();
  }

  // --- Picker v8 folder selection ---
  async function pickFolder({ locale = "sv-se" } = {}) {
    const channelId = uuid();

    // Picker options. Folder selection:
    const options = {
      sdk: "8.0",
      entry: { oneDrive: {} },
      authentication: {},
      messaging: { origin: window.location.origin, channelId },
      typesAndSources: { filters: ["folder"], mode: "folders" },
      selection: { mode: "single" }
    };

    const pickerUrl = `${pickerBaseUrl}/_layouts/15/FilePicker.aspx?` +
      new URLSearchParams({
        filePicker: JSON.stringify(options),
        locale
      }).toString();

    // Token for the picker resource (SharePoint/OneDrive hosted page)
    // 1) Hämta token först (kan trigga loginPopup)
    const pickerToken = await getTokenForResource(pickerBaseUrl);

    // 2) Öppna popup efter token finns
    const win = window.open("", "OneDrivePicker", "width=1080,height=680");


    
    if (!win) throw new Error("Popup blockerade pickern. Tillåt popups och försök igen.");

        // Se till att popupen har ett body-element
    try {
      win.document.open();
      win.document.write("<!doctype html><html><head><title>Loading…</title></head><body></body></html>");
      win.document.close();
    } catch (e) {
      // om någon browser bråkar här, fortsätt ändå
    }

    // 3) Posta form med access_token
    const form = win.document.createElement("form");
    form.setAttribute("action", pickerUrl);
    form.setAttribute("method", "POST");

    const tokenInput = win.document.createElement("input");
    tokenInput.setAttribute("type", "hidden");
    tokenInput.setAttribute("name", "access_token");
    console.log("pickerToken length:", pickerToken?.length);
    if (!pickerToken) throw new Error("No picker token acquired.");

    tokenInput.setAttribute("value", pickerToken);

    form.appendChild(tokenInput);
    win.document.body.appendChild(form);
    form.submit();


    return await new Promise((resolve, reject) => {
      let port = null;

      const cleanup = () => {
        window.removeEventListener("message", onMessage);
        try { port?.close?.(); } catch {}
        try { win?.close?.(); } catch {}
      };

      const onMessage = (event) => {
        if (event.source !== win) return;
        const msg = event.data;

        if (msg?.type === "initialize" && msg.channelId === channelId) {
          port = event.ports[0];
          port.onmessage = onPortMessage;
          port.start();
          port.postMessage({ type: "activate" });
        }
      };

      const onPortMessage = async (e) => {
        const payload = e.data;

        if (payload?.type === "command") {
          // Always acknowledge
          port.postMessage({ type: "acknowledge", id: payload.id });

          const cmd = payload?.data?.command;

          if (cmd === "authenticate") {
            try {
              const t = await getTokenForResource(pickerBaseUrl);
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
            const items = payload?.data?.items || payload?.data?.value || [];
            const item = items[0];
            const driveId = item?.parentReference?.driveId;
            const folderId = item?.id;

            if (!driveId || !folderId) {
              cleanup();
              reject(new Error("Fick inget driveId/folderId från pickern."));
              return;
            }

            cleanup();
            resolve({ driveId, folderId });
            return;
          }

          if (cmd === "close") {
            cleanup();
            reject(new Error("Picker stängdes."));
            return;
          }
        }
      };

      window.addEventListener("message", onMessage);
    });
  }

  // --- Load root folder: expects data.xlsx + img/ inside ---
  async function loadRootFolderBundle({
    rootDriveId,
    rootFolderId,
    parseXlsxBuffer,     // async (arrayBuffer)->rows
    rowsToJson,          // (rows)-> {count, updatedAt, npcs}
    setStatus = null,    // optional (msg)->void
  }) {
    must(parseXlsxBuffer, "loadRootFolderBundle: missing parseXlsxBuffer(buf).");
    must(rowsToJson, "loadRootFolderBundle: missing rowsToJson(rows).");

    const token = await getGraphToken();

    setStatus?.("Listing folder...");
    const rootChildren = await listChildren(
      token, rootDriveId, rootFolderId,
      "id,name,folder,file"
    );

    const excel = rootChildren.find(x => (x.name || "").toLowerCase() === "data.xlsx");
    if (!excel) throw new Error("Hittar ingen data.xlsx i vald mapp.");

    const imgFolder = rootChildren.find(x => (x.name || "").toLowerCase() === "img" && x.folder);
    if (!imgFolder) throw new Error('Hittar ingen "img"-mapp i vald mapp.');

    setStatus?.("Downloading data.xlsx...");
    const buf = await downloadContentArrayBuffer(token, rootDriveId, excel.id);

    setStatus?.("Parsing Excel...");
    const rows = await parseXlsxBuffer(buf);
    const json = rowsToJson(rows);

    const imageResolver = makeOneDriveImageResolver({
      token,
      driveId: rootDriveId,
      imgRootFolderId: imgFolder.id,
      listChildrenFn: (tok, d, id, sel) => listChildren(tok, d, id, sel),
    });

    return { json, imageResolver, token, driveId: rootDriveId, rootFolderId };
  }

  // --- Image resolver: img/<Origin>/<Name>.jpg etc, lazy per origin ---
  function makeOneDriveImageResolver({ token, driveId, imgRootFolderId, listChildrenFn, toFileStem = null }) {
    const originCache = new Map();
    const norm = (s) => (s || "").trim().toLowerCase();

    // If you want "name".jpg (lowercase) regardless of Excel, pass toFileStem(name)
    const stem = (name) => {
      if (typeof toFileStem === "function") return norm(toFileStem(name));
      return norm(name);
    };

    async function getOriginFolderId(origin) {
      const key = norm(origin);
      const cached = originCache.get(key);
      if (cached?.folderId) return cached.folderId;

      const origins = await listChildrenFn(token, driveId, imgRootFolderId, "id,name,folder");
      const folder = origins.find(x => x.folder && norm(x.name) === key);
      if (!folder) return null;

      originCache.set(key, { folderId: folder.id, map: null });
      return folder.id;
    }

    async function buildOriginMap(origin) {
      const key = norm(origin);
      const cached = originCache.get(key);
      if (cached?.map) return cached.map;

      const folderId = cached?.folderId ?? await getOriginFolderId(origin);
      if (!folderId) return null;

      const files = await listChildrenFn(
        token, driveId, folderId,
        "id,name,@microsoft.graph.downloadUrl,file"
      );

      const map = new Map();
      for (const f of files) {
        if (!f.file) continue;
        const name = norm(f.name);
        const url = f["@microsoft.graph.downloadUrl"];
        if (url) map.set(name, url);
      }

      originCache.set(key, { folderId, map });
      return map;
    }

    async function getNpcImageUrl(origin, npcName) {
      const map = await buildOriginMap(origin);
      if (!map) return null;

      const base = stem(npcName);
      const candidates = [`${base}.jpg`, `${base}.jpeg`, `${base}.png`, `${base}.webp`];

      for (const c of candidates) {
        const url = map.get(c);
        if (url) return url;
      }
      return null;
    }

    // If a downloadUrl expires, you can reset an origin cache:
    function invalidateOrigin(origin) {
      originCache.delete(norm(origin));
    }

    return { getNpcImageUrl, invalidateOrigin };
  }

  return {
    msalInstance,
    getGraphToken,
    graphFetch,
    listChildren,
    downloadContentArrayBuffer,

    pickFolder,
    loadRootFolderBundle,
    makeOneDriveImageResolver, // exported in case you want custom wiring
  };
}

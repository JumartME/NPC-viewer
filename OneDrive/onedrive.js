// onedrive/onedrive.js
// OneDrive (Personal/Consumer) + Folder Picker v8 + Graph helpers + Image resolver
// Requires: msal-browser loaded globally (window.msal)

function uuid() {
  return crypto?.randomUUID?.() ?? (String(Date.now()) + Math.random());
}

function must(condition, message) {
  if (!condition) throw new Error(message);
}

function encodeSharingUrl(url) {
  const b64 = btoa(unescape(encodeURIComponent(url)));
  return "u!" + b64.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
const defaultRedirect =
  window.location.origin + window.location.pathname.replace(/index\.html?$/i, "");
export function createOneDriveClient({
  clientId,
  authority = "https://login.microsoftonline.com/consumers",
  redirectUri = defaultRedirect,
  graphScopes = ["User.Read", "Files.Read"],

  // Personal: https://onedrive.live.com/picker
  // Work/School: https://<TENANT>-my.sharepoint.com
  pickerBaseUrl,

  // Personal OneDrive: ["OneDrive.ReadOnly"] or ["OneDrive.ReadWrite"]
  // Work/School picker: often [`${resource}/MyFiles.Read`]
  pickerScopes = null,
} = {}) {
  must(typeof window !== "undefined", "This module must run in a browser.");
  must(window.msal, "msal-browser not loaded. Add msal-browser script tag before app.js.");
  must(clientId, "Missing clientId.");
  must(pickerBaseUrl, "Missing pickerBaseUrl.");

  const msalInstance = new window.msal.PublicClientApplication({
    auth: {
      clientId,
      authority,
      redirectUri,
      postLogoutRedirectUri: redirectUri,
    },
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

  function defaultResourceScopes(resource) {
    if (resource === "https://onedrive.live.com/picker") return ["OneDrive.ReadOnly"];
    return [`${resource}/MyFiles.Read`];
  }

  async function getTokenForResource(resource, scopes) {
    const account = await ensureLoggedIn();
    const useScopes =
      (scopes && scopes.length) ? scopes :
      (pickerScopes && pickerScopes.length) ? pickerScopes :
      defaultResourceScopes(resource);

    try {
      const r = await msalInstance.acquireTokenSilent({ account, scopes: useScopes });
      return r.accessToken;
    } catch {
      const r = await msalInstance.acquireTokenPopup({ scopes: useScopes });
      return r.accessToken;
    }
  }

  async function logout() {
    const account = msalInstance.getAllAccounts()[0];
    if (!account) return;

    try {
      await msalInstance.logoutPopup({
        account,
        postLogoutRedirectUri: redirectUri,
        mainWindowRedirectUri: redirectUri,
      });
    } catch (e) {
      console.warn("logoutPopup failed; falling back to logoutRedirect", e);
      await msalInstance.logoutRedirect({
        account,
        postLogoutRedirectUri: redirectUri,
      });
    }
  }

  async function graphFetch(token, path) {
    const res = await fetch("https://graph.microsoft.com/v1.0" + path, {
      headers: { Authorization: `Bearer ${token}` },
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

  // ---- NEW: load from pasted OneDrive link (folder or file) ----
  async function loadFromOneDriveLink({
    shareUrl,
    parseXlsxBuffer,
    rowsToJson,
    setStatus = null,
  }) {
    must(shareUrl, "Ingen länk angiven.");
    must(parseXlsxBuffer, "loadFromOneDriveLink: missing parseXlsxBuffer(buf).");
    must(rowsToJson, "loadFromOneDriveLink: missing rowsToJson(rows).");

    setStatus?.("Signing in...");
    const token = await getGraphToken();

    setStatus?.("Resolving share link...");
    const shareId = encodeSharingUrl(shareUrl);

    const itemRes = await graphFetch(token, `/shares/${shareId}/driveItem`);
    const item = await itemRes.json();

    const driveId = item?.parentReference?.driveId;
    if (!driveId) throw new Error("Kunde inte läsa driveId från länken.");

    // If link is folder -> root is item.id
    // If link is file -> root is parent folder
    const rootFolderId = item?.folder ? item.id : item?.parentReference?.id;
    if (!rootFolderId) throw new Error("Kunde inte avgöra root-mapp från länken.");

    setStatus?.("Loading data.xlsx + img/ ...");
    return await loadRootFolderBundle({
      rootDriveId: driveId,
      rootFolderId,
      parseXlsxBuffer,
      rowsToJson,
      setStatus,
    });
  }

  // ---- Picker v8: folder selection (kept, even if flaky) ----
  async function pickFolder({ locale = "sv-se" } = {}) {
    const channelId = uuid();

    const options = {
      sdk: "8.0",
      entry: { oneDrive: {} },
      authentication: {},
      messaging: { origin: window.location.origin, channelId },
      typesAndSources: { filters: ["folder"], mode: "folders" },
      selection: { mode: "single" },
    };

    const pickerUrl =
      `${pickerBaseUrl}/_layouts/15/FilePicker.aspx?` +
      new URLSearchParams({
        filePicker: JSON.stringify(options),
        locale,
      }).toString();

    const popupName = `OneDrivePicker_${channelId}`;
    const win = window.open("about:blank", popupName, "width=1080,height=680");
    if (!win) throw new Error("Popup blockerade pickern. Tillåt popups och försök igen.");

    const form = document.createElement("form");
    form.action = pickerUrl;
    form.method = "POST";
    form.target = popupName;
    form.style.display = "none";
    document.body.appendChild(form);
    form.submit();
    form.remove();

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
          port = event.ports?.[0];
          if (!port) {
            cleanup();
            reject(new Error("Picker init failed (no MessagePort)."));
            return;
          }
          port.onmessage = onPortMessage;
          port.start();
          port.postMessage({ type: "activate" });
        }
      };

      const onPortMessage = async (e) => {
        const payload = e.data;
        if (payload?.type !== "command") return;

        port.postMessage({ type: "acknowledge", id: payload.id });

        const cmd = payload?.data?.command;

        if (cmd === "authenticate") {
          try {
            const t = await getTokenForResource(pickerBaseUrl);
            port.postMessage({ type: "result", id: payload.id, data: { result: "token", token: t } });
          } catch (err) {
            port.postMessage({
              type: "result",
              id: payload.id,
              data: { result: "error", error: String(err?.message || err) },
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
        }
      };

      window.addEventListener("message", onMessage);
    });
  }

  // --- Load root folder: expects data.xlsx + img/ inside ---
  async function loadRootFolderBundle({
    rootDriveId,
    rootFolderId,
    parseXlsxBuffer,
    rowsToJson,
    setStatus = null,
  }) {
    must(parseXlsxBuffer, "loadRootFolderBundle: missing parseXlsxBuffer(buf).");
    must(rowsToJson, "loadRootFolderBundle: missing rowsToJson(rows).");

    const token = await getGraphToken();

    setStatus?.("Listing folder...");
    const rootChildren = await listChildren(token, rootDriveId, rootFolderId, "id,name,folder,file");
    console.log("rootChildren:", rootChildren.map(x => ({
      name: x.name,
      folder: !!x.folder,
      file: !!x.file
    })));
    const excel = rootChildren.find((x) => (x.name || "").toLowerCase() === "data.xlsx");
    if (!excel) throw new Error("Hittar ingen data.xlsx i vald mapp.");

    const imgFolder = rootChildren.find((x) => (x.name || "").toLowerCase() === "img" && x.folder);
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

  // --- Image resolver: img/<Origin>/<Name>.jpg|.jpeg (case-insensitive), robust downloadUrl fetch ---
// --- Image resolver: img/<Origin>/<Name>.jpg|.jpeg (case-insensitive)
// Exposes BOTH stable refs (driveId+itemId) and temporary download URLs.
function makeOneDriveImageResolver({ token, driveId, imgRootFolderId, listChildrenFn }) {
  const norm = (s) => (s || "").trim().toLowerCase();

  // originKey -> { folderId, index: Map(lowerFilename -> { id, url? }) }
  const originCache = new Map();

  async function getOriginFolderId(origin) {
    const key = norm(origin);
    const cached = originCache.get(key);
    if (cached?.folderId) return cached.folderId;

    const origins = await listChildrenFn(token, driveId, imgRootFolderId, "id,name,folder");
    const folder = origins.find((x) => x.folder && norm(x.name) === key);
    if (!folder) return null;

    originCache.set(key, { folderId: folder.id, index: null });
    return folder.id;
  }

  async function buildOriginIndex(origin) {
    const key = norm(origin);
    const cached = originCache.get(key);
    if (cached?.index) return cached.index;

    const folderId = cached?.folderId ?? (await getOriginFolderId(origin));
    if (!folderId) return null;

    // Do NOT rely on @microsoft.graph.downloadUrl here
    const files = await listChildrenFn(token, driveId, folderId, "id,name,file");
    const index = new Map();

    for (const f of files) {
      if (!f.file) continue;
      index.set(norm(f.name), { id: f.id, url: null });
    }

    originCache.set(key, { folderId, index });
    return index;
  }

  // Fetch a fresh @microsoft.graph.downloadUrl for a file id (can expire; cache per entry)
  async function getDownloadUrlByItemId(itemId) {
    const res = await graphFetch(token, `/drives/${driveId}/items/${itemId}`);
    const json = await res.json();
    return json?.["@microsoft.graph.downloadUrl"] || null;
  }

  // NEW: stable reference for caching (driveId + itemId)
  async function getNpcImageRef(origin, npcName) {
    const index = await buildOriginIndex(origin);
    if (!index) return null;

    const base = norm(npcName);
    const candidates = [`${base}.jpg`, `${base}.jpeg`];

    for (const fileName of candidates) {
      const entry = index.get(fileName);
      if (entry?.id) return { driveId, itemId: entry.id, fileName };
    }
    return null;
  }

  // Old API: returns a temporary URL (still useful as a fallback)
  async function getNpcImageUrl(origin, npcName) {
    const ref = await getNpcImageRef(origin, npcName);
    if (!ref) return null;

    const url = await getDownloadUrlByItemId(ref.itemId);
    return url || null;
  }

  function invalidateOrigin(origin) {
    originCache.delete(norm(origin));
  }

  return {
    driveId,
    getNpcImageRef,
    getDownloadUrlByItemId,
    getNpcImageUrl,
    invalidateOrigin,
  };
}


  return {
    msalInstance,
    logout,
    pickFolder,
    loadFromOneDriveLink,     // ✅ now exported correctly
    getGraphToken,
    loadRootFolderBundle,
    makeOneDriveImageResolver,
  };
}

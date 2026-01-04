// modules/fsHandleStore.js
// Persist FileSystemDirectoryHandle across reloads using IndexedDB.
// Works in Chromium-based browsers.

const DB_NAME = "npc_viewer_fs";
const STORE = "handles";
const KEY = "rootDir";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    Promise.resolve(fn(store))
      .then((val) => {
        tx.oncomplete = () => resolve(val);
        tx.onerror = () => reject(tx.error);
      })
      .catch(reject);
  });
}

export async function saveRootHandle(dirHandle) {
  // Structured clone of FileSystemDirectoryHandle is supported in Chromium.
  return withStore("readwrite", (store) => store.put(dirHandle, KEY));
}

export async function loadRootHandle() {
  return withStore("readonly", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function clearRootHandle() {
  return withStore("readwrite", (store) => store.delete(KEY));
}

export async function ensureHandlePermission(dirHandle, mode = "read") {
  if (!dirHandle) return false;
  try {
    // Some browsers support queryPermission/requestPermission on handles
    if (dirHandle.queryPermission && dirHandle.requestPermission) {
      const q = await dirHandle.queryPermission({ mode });
      if (q === "granted") return true;
      const r = await dirHandle.requestPermission({ mode });
      return r === "granted";
    }
    // If permission APIs missing, assume it's usable (will throw later if not).
    return true;
  } catch {
    return false;
  }
}

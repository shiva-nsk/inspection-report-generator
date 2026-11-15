// Local storage for the report (IndexedDB, no libraries).
//
// DB "inspection-report":
//   "state"  : key 'current' -> report JSON
//   "images" : key image id  -> { blob /* JPEG */, w, h, thumb? /* small JPEG */ }
//
// If IndexedDB is not available (e.g. some private windows) everything falls
// back to memory so the app still works for the current session.

const DB_NAME = 'inspection-report';
const DB_VERSION = 1;
const SAVE_DELAY_MS = 500;

let dbPromise = null;
let memory = null; // { state: Map, images: Map } when IndexedDB is unavailable

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB not available')); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('state')) db.createObjectStore('state');
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Could not open the database'));
      req.onblocked = () => reject(new Error('Database is blocked by another tab'));
    });
  }
  return dbPromise;
}

/** Opens the database. Returns false (and switches to memory) if storage is unavailable. */
export async function init() {
  try {
    await openDb();
    return true;
  } catch (err) {
    console.error('IndexedDB unavailable, using memory only:', err);
    memory = { state: new Map(), images: new Map() };
    return false;
  }
}

export function isPersistent() {
  return !memory;
}

/** Runs fn(objectStore) in one transaction; resolves with the last request's result once committed. */
async function run(storeName, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    const req = fn(store);
    if (req && typeof req === 'object' && 'onsuccess' in req) {
      req.onsuccess = () => { result = req.result; };
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error('Storage error'));
    tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted'));
  });
}

// ---------- report state ----------

export async function loadReport() {
  if (memory) return memory.state.get('current') || null;
  return (await run('state', 'readonly', (s) => s.get('current'))) || null;
}

async function writeReport(report) {
  if (memory) { memory.state.set('current', structuredClone(report)); return; }
  await run('state', 'readwrite', (s) => s.put(report, 'current'));
}

// Debounced autosave -------------------------------------------------------

let timer = null;
let dirty = false;
let current = null;
let inflight = null;
const deleteQueue = new Set();
const statusListeners = new Set();

function setStatus(status, err) {
  statusListeners.forEach((fn) => { try { fn(status, err); } catch (e) { console.error(e); } });
}

/** fn('saving' | 'saved' | 'error', error?) */
export function onSaveStatus(fn) {
  statusListeners.add(fn);
}

export function scheduleSave(report) {
  current = report;
  dirty = true;
  setStatus('saving');
  clearTimeout(timer);
  timer = setTimeout(() => { flushSave(); }, SAVE_DELAY_MS);
}

export function hasPendingSave() {
  return dirty || !!inflight;
}

/** Saves now (if anything changed). Images queued for deletion are removed after the save commits. */
export function flushSave() {
  clearTimeout(timer);
  timer = null;
  if (inflight) return inflight.then(() => flushSave());
  if (!dirty || !current) return Promise.resolve();
  dirty = false;
  const toDelete = [...deleteQueue];
  deleteQueue.clear();
  inflight = writeReport(current)
    .then(async () => {
      if (toDelete.length) await deleteImages(toDelete).catch((e) => console.warn('Image cleanup failed', e));
      if (!dirty) setStatus('saved');
    })
    .catch((err) => {
      console.error('Autosave failed', err);
      dirty = true;
      toDelete.forEach((id) => deleteQueue.add(id));
      setStatus('error', err);
    })
    .finally(() => { inflight = null; });
  return inflight;
}

/**
 * Remove image blobs once the report no longer referencing them has been saved
 * (so a crash between the two never leaves the saved report pointing at a deleted photo).
 */
export function queueImageDelete(ids) {
  ids.forEach((id) => id && deleteQueue.add(id));
  if (current) scheduleSave(current);
}

/**
 * Replace everything: clears all saved state and images, writes the given
 * images ({ id: { blob, w, h } }) and saves the report. Used by New report and Import draft.
 */
export async function replaceAll(report, images = {}, onProgress) {
  clearTimeout(timer);
  timer = null;
  if (inflight) await inflight.catch(() => {});
  dirty = false;
  deleteQueue.clear();
  current = report;
  setStatus('saving');
  try {
    if (memory) {
      memory.state.clear();
      memory.images.clear();
    } else {
      await run('images', 'readwrite', (s) => s.clear());
      await run('state', 'readwrite', (s) => s.clear());
    }
    const ids = Object.keys(images);
    for (let i = 0; i < ids.length; i += 1) {
      await putImage(ids[i], images[ids[i]]);
      if (onProgress) onProgress(i + 1, ids.length);
    }
    await writeReport(report);
    setStatus('saved');
  } catch (err) {
    setStatus('error', err);
    throw err;
  }
}

// ---------- images ----------

export async function putImage(id, record) {
  if (memory) { memory.images.set(id, record); return; }
  await run('images', 'readwrite', (s) => s.put(record, id));
}

export async function getImageRecord(id) {
  if (memory) return memory.images.get(id) || null;
  return (await run('images', 'readonly', (s) => s.get(id))) || null;
}

export async function deleteImages(ids) {
  if (!ids.length) return;
  if (memory) { ids.forEach((id) => memory.images.delete(id)); return; }
  await run('images', 'readwrite', (s) => {
    let last = null;
    ids.forEach((id) => { last = s.delete(id); });
    return last;
  });
}

export async function listImageIds() {
  if (memory) return [...memory.images.keys()];
  return (await run('images', 'readonly', (s) => s.getAllKeys())) || [];
}

/** For the PDF engine: JPEG bytes + pixel size. */
export async function getImage(id) {
  const rec = await getImageRecord(id);
  if (!rec || !rec.blob) throw new Error(`Photo ${id} is missing from storage`);
  return { data: new Uint8Array(await rec.blob.arrayBuffer()), w: rec.w, h: rec.h };
}

// ---------- draft export ----------

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result);
      resolve(s.slice(s.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read photo'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Builds the draft file as a Blob without ever holding one giant string:
 * { format: 'inspection-report-draft', version: 1, report, images: { id: { w, h, data } } }
 */
export async function exportDraftBlob(report, imageIds, onProgress) {
  const parts = ['{"format":"inspection-report-draft","version":1,"report":', JSON.stringify(report), ',"images":{'];
  let first = true;
  let missing = 0;
  for (let i = 0; i < imageIds.length; i += 1) {
    const id = imageIds[i];
    const rec = await getImageRecord(id);
    if (rec && rec.blob) {
      const data = await blobToBase64(rec.blob);
      parts.push(`${first ? '' : ','}${JSON.stringify(id)}:{"w":${Number(rec.w) || 0},"h":${Number(rec.h) || 0},"data":"${data}"}`);
      first = false;
    } else {
      missing += 1;
    }
    if (onProgress) onProgress(i + 1, imageIds.length);
  }
  parts.push('}}');
  return { blob: new Blob(parts, { type: 'application/json' }), missing };
}

export function base64ToBlob(b64, type = 'image/jpeg') {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Ask the browser not to evict our data under storage pressure (silently ignored if refused). */
export function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch { /* ignore */ }
}

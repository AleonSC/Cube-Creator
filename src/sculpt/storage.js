import { deflateSync, inflateSync } from 'fflate';

/**
 * Sculpt meshes are large binary blobs, so they live outside the JSON design
 * state: autosaved in IndexedDB and embedded (compressed, base64) only when a
 * design file is saved.
 */
const DB = 'cube-creator';
const STORE = 'sculpts';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const sculptDB = {
  save: (id, bytes) => tx('readwrite', (s) => s.put(bytes, id)).catch((e) => console.warn('sculpt autosave failed', e)),
  load: (id) => tx('readonly', (s) => s.get(id)).catch(() => null),
  remove: (id) => tx('readwrite', (s) => s.delete(id)).catch(() => null),
};

export function encodeSculpt(bytes) {
  const z = deflateSync(bytes, { level: 6 });
  let s = '';
  for (let i = 0; i < z.length; i += 0x8000) s += String.fromCharCode.apply(null, z.subarray(i, i + 0x8000));
  return btoa(s);
}

export function decodeSculpt(b64) {
  const bin = atob(b64);
  const z = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) z[i] = bin.charCodeAt(i);
  return inflateSync(z);
}

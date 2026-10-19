import { gzipSync, strToU8 } from 'fflate';

/**
 * Minimal .unitypackage writer. A .unitypackage is a gzipped tar where every
 * asset lives in a folder named by its GUID:
 *   <guid>/asset       file contents (omitted for folders)
 *   <guid>/asset.meta  Unity meta file carrying the GUID
 *   <guid>/pathname    project path, e.g. "Assets/CubeCreator/Scripts/Foo.cs"
 *
 * GUIDs are derived from the asset path, so the same path always gets the
 * same GUID. Importing a second cube therefore *updates* the shared scripts
 * instead of adding duplicate copies (which would not compile).
 *
 * @param files { 'Assets/...': string | Uint8Array | ArrayBuffer | Blob }
 */
export async function makeUnityPackage(files) {
  const entries = new Map(); // path -> bytes | null (folder)
  for (const [path, data] of Object.entries(files)) {
    if (data == null) continue;
    entries.set(path, await toBytes(data));
    // every parent folder needs its own meta
    const parts = path.split('/');
    for (let i = 2; i < parts.length; i++) {
      const folder = parts.slice(0, i).join('/');
      if (!entries.has(folder)) entries.set(folder, null);
    }
  }

  const tar = new TarWriter();
  for (const [path, bytes] of entries) {
    const guid = guidFor(path);
    tar.dir(`${guid}/`);
    if (bytes) tar.file(`${guid}/asset`, bytes);
    tar.file(`${guid}/asset.meta`, strToU8(metaFor(path, guid, bytes == null)));
    tar.file(`${guid}/pathname`, strToU8(path));
  }
  return new Blob([gzipSync(tar.finish(), { level: 6 })], { type: 'application/octet-stream' });
}

/** Stable 128-bit hex GUID from a string (cyrb128). */
export function guidFor(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1, h2, h3, h4].map((h) => (h >>> 0).toString(16).padStart(8, '0')).join('');
}

function metaFor(path, guid, isFolder) {
  const head = `fileFormatVersion: 2\nguid: ${guid}\n`;
  if (isFolder) return `${head}folderAsset: yes\nDefaultImporter:\n  externalObjects: {}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`;
  if (path.endsWith('.cs'))
    return `${head}MonoImporter:\n  externalObjects: {}\n  serializedVersion: 2\n  defaultReferences: []\n  executionOrder: 0\n  icon: {instanceID: 0}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`;
  // Other assets: Unity picks the importer from the extension and fills in defaults.
  return head;
}

async function toBytes(data) {
  if (typeof data === 'string') return strToU8(data);
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return data;
}

/** Tiny ustar writer (names are short: "<32 hex>/asset.meta"). */
class TarWriter {
  constructor() {
    this.chunks = [];
    this.size = 0;
  }

  dir(name) {
    this.push(header(name, 0, '5'));
  }

  file(name, bytes) {
    this.push(header(name, bytes.length, '0'));
    this.push(bytes);
    const pad = (512 - (bytes.length % 512)) % 512;
    if (pad) this.push(new Uint8Array(pad));
  }

  push(u8) {
    this.chunks.push(u8);
    this.size += u8.length;
  }

  finish() {
    this.push(new Uint8Array(1024)); // two empty blocks end the archive
    const out = new Uint8Array(this.size);
    let o = 0;
    for (const c of this.chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  }
}

function header(name, size, type) {
  const h = new Uint8Array(512);
  const put = (str, off, len) => h.set(strToU8(str).subarray(0, len), off);
  const oct = (n, len) => n.toString(8).padStart(len - 1, '0') + '\0';
  put(name, 0, 100);
  put(oct(type === '5' ? 0o755 : 0o644, 8), 100, 8);
  put(oct(0, 8), 108, 8);
  put(oct(0, 8), 116, 8);
  put(oct(size, 12), 124, 12);
  put(oct(Math.floor(Date.now() / 1000), 12), 136, 12);
  put('        ', 148, 8); // checksum placeholder
  put(type, 156, 1);
  put('ustar\0', 257, 6);
  put('00', 263, 2);
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += h[i];
  put(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
  return h;
}

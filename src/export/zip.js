import { zipSync, strToU8 } from 'fflate';

/** files: { 'path/in/zip': string | Uint8Array | ArrayBuffer | Blob } */
export async function makeZip(files) {
  const out = {};
  for (const [path, data] of Object.entries(files)) {
    if (data == null) continue;
    if (typeof data === 'string') out[path] = strToU8(data);
    else if (data instanceof Blob) out[path] = new Uint8Array(await data.arrayBuffer());
    else if (data instanceof ArrayBuffer) out[path] = new Uint8Array(data);
    else out[path] = data;
  }
  return new Blob([zipSync(out, { level: 6 })], { type: 'application/zip' });
}

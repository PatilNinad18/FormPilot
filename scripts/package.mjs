#!/usr/bin/env node
/**
 * FormPilot AI — packages dist/ into a Chrome-Web-Store-ready .zip.
 *
 * Implemented with Node built-ins only (no `archiver`/`zip` dependency): a
 * minimal ZIP writer using DEFLATE via node:zlib. Cross-platform (works on
 * Windows without the `zip` binary) and deterministic.
 */
import { deflateRawSync } from 'node:zlib';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDir, '..');
const distDir = join(projectRoot, 'dist');

if (!existsSync(distDir)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

// ---- CRC-32 ---------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---- collect dist files ---------------------------------------------------
function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else found.push(full);
  }
  return found;
}

const files = walk(distDir).sort();

// Fixed DOS timestamp (2020-01-01 00:00:00) keeps the archive deterministic.
const DOS_TIME = 0;
const DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1;

const localParts = [];
const centralParts = [];
let offset = 0;

for (const file of files) {
  const nameBuf = Buffer.from(relative(distDir, file).split(sep).join('/'), 'utf8');
  const content = readFileSync(file);
  const crc = crc32(content);
  const compressed = deflateRawSync(content);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); // local file header signature
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0, 6); // flags
  local.writeUInt16LE(8, 8); // method: deflate
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28); // extra length
  localParts.push(local, nameBuf, compressed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); // central directory signature
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6); // version needed
  central.writeUInt16LE(0, 8); // flags
  central.writeUInt16LE(8, 10); // method: deflate
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt16LE(0, 30); // extra length
  central.writeUInt16LE(0, 32); // comment length
  central.writeUInt16LE(0, 34); // disk number start
  central.writeUInt16LE(0, 36); // internal attrs
  central.writeUInt32LE(0, 38); // external attrs
  central.writeUInt32LE(offset, 42); // local header offset
  centralParts.push(central, nameBuf);

  offset += local.length + nameBuf.length + compressed.length;
}

const localBuf = Buffer.concat(localParts);
const centralBuf = Buffer.concat(centralParts);

const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
end.writeUInt16LE(0, 4); // disk number
end.writeUInt16LE(0, 6); // disk with central directory
end.writeUInt16LE(files.length, 8); // entries on this disk
end.writeUInt16LE(files.length, 10); // total entries
end.writeUInt32LE(centralBuf.length, 12); // central directory size
end.writeUInt32LE(localBuf.length, 16); // central directory offset
end.writeUInt16LE(0, 20); // comment length

const zip = Buffer.concat([localBuf, centralBuf, end]);
const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
const outName = `formpilot-ai-v${pkg.version}.zip`;
writeFileSync(join(projectRoot, outName), zip);

console.log(`Packaged ${files.length} files -> ${outName} (${(zip.length / 1024).toFixed(1)} KB)`);

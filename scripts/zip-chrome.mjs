// Packs dist-chrome/ into release/chinese_brain-<version>-chrome.zip for the Chrome Web Store
// (manifest.json at the zip's root). Plain Node, no zip tool needed: npm run zip:chrome
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { deflateRawSync } from 'node:zlib';

const SRC = 'dist-chrome';
const { version } = JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8'));
const out = `release/chinese_brain-${version}-chrome.zip`;

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name !== '.DS_Store') files.push(p);
  }
})(SRC);

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

// A fixed timestamp (1980-01-01) keeps the zip the same from build to build.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

const parts = [];
const central = [];
let offset = 0;
for (const p of files) {
  const name = Buffer.from(relative(SRC, p).split(sep).join('/'));
  const raw = readFileSync(p);
  const deflated = deflateRawSync(raw, { level: 9 });
  const store = deflated.length >= raw.length;
  const data = store ? raw : deflated;
  const crc = crc32(raw);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(store ? 0 : 8, 8);
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  const head = Buffer.alloc(46);
  head.writeUInt32LE(0x02014b50, 0);
  head.writeUInt16LE(20, 4);
  head.writeUInt16LE(20, 6);
  head.writeUInt16LE(0x0800, 8);
  head.writeUInt16LE(store ? 0 : 8, 10);
  head.writeUInt16LE(DOS_TIME, 12);
  head.writeUInt16LE(DOS_DATE, 14);
  head.writeUInt32LE(crc, 16);
  head.writeUInt32LE(data.length, 20);
  head.writeUInt32LE(raw.length, 24);
  head.writeUInt16LE(name.length, 28);
  head.writeUInt32LE(offset, 42);
  parts.push(local, name, data);
  central.push(head, name);
  offset += local.length + name.length + data.length;
}
const dir = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(dir.length, 12);
end.writeUInt32LE(offset, 16);

mkdirSync('release', { recursive: true });
writeFileSync(out, Buffer.concat([...parts, dir, end]));
console.log(`${out}: ${files.length} files, ${Math.round((offset + dir.length + 22) / 1024)} KB`);

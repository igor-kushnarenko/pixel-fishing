// Dependency-free PNG export of the 32px fish icon, including a solid maskable background.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const rectangles = [
  [0, 0, 32, 32, 'deeed6'],
  [12, 11, 10, 12, '30346d'], [10, 13, 14, 8, '30346d'], [7, 11, 3, 12, '30346d'],
  [13, 13, 8, 8, 'd27d2c'], [10, 15, 12, 4, 'd27d2c'], [8, 13, 1, 8, 'd27d2c'],
  [14, 13, 6, 2, 'dad45e'], [19, 16, 2, 2, '140c1c']
];
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const type = Buffer.from(name), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, crc]);
}
mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true });
for (const size of [180, 192, 512]) {
  const pixels = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = Math.floor(x * 32 / size), gy = Math.floor(y * 32 / size);
      const rectangle = rectangles.findLast(([rx, ry, w, h]) => gx >= rx && gx < rx + w && gy >= ry && gy < ry + h);
      const rgb = Buffer.from(rectangle[4], 'hex');
      rgb.copy(pixels, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
  writeFileSync(new URL(`../public/icons/fish-${size}.png`, import.meta.url), png);
}

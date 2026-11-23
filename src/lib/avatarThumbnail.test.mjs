import assert from 'node:assert/strict';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { avatarThumbnail } from './avatarThumbnail.js';

// Real image encode/decode with a tiny browser-canvas adapter.
globalThis.Image = class {
  set src(value) { this.pending = loadImage(value).then(image => { this.native = image; this.naturalWidth = image.width; this.naturalHeight = image.height; }); }
  decode() { return this.pending; }
};
globalThis.document = { createElement() {
  const canvas = createCanvas(1, 1);
  const context = canvas.getContext('2d');
  const draw = context.drawImage.bind(context);
  context.drawImage = (image, ...args) => draw(image.native || image, ...args);
  return canvas;
} };
const source = createCanvas(400, 200), ctx = source.getContext('2d');
ctx.fillStyle = 'red'; ctx.fillRect(0, 0, 200, 200);
ctx.fillStyle = 'blue'; ctx.fillRect(200, 0, 200, 200);
const original = source.toDataURL('image/png');
const result = await avatarThumbnail(original, { x: 200, y: 0, width: 200, height: 200 });
assert.ok(result.startsWith('data:image/webp;'));
const decoded = await loadImage(result);
assert.equal(decoded.width, 144); assert.equal(decoded.height, 144);
const output = createCanvas(144, 144); output.getContext('2d').drawImage(decoded, 0, 0);
assert.ok(output.getContext('2d').getImageData(72, 72, 1, 1).data[2] > 200, 'selected right-hand crop stays blue');
const rotated = await avatarThumbnail(original, { x: 0, y: 200, width: 200, height: 200 }, 90);
output.getContext('2d').drawImage(await loadImage(rotated), 0, 0);
assert.ok(output.getContext('2d').getImageData(72, 72, 1, 1).data[2] > 200, 'rotation preserves the crop coordinates');
assert.equal(await avatarThumbnail(result), result, 'already optimized WebP is not recompressed');
console.log('Avatar thumbnails passed: WebP output, 144px size, crop position, rotation and no recompression.');

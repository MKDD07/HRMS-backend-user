import { AVATAR_SIZE } from '../../shared/avatarStorage.mjs';

export async function avatarThumbnail(source, area, rotation = 0) {
  const temporary = source instanceof Blob ? URL.createObjectURL(source) : null;
  try {
    const image = new Image();
    image.src = temporary || source;
    await image.decode();
    if (!area && !rotation && image.naturalWidth === AVATAR_SIZE && image.naturalHeight === AVATAR_SIZE && typeof source === 'string' && source.startsWith('data:image/webp;')) return source;
    const radians = rotation * Math.PI / 180;
    const width = image.naturalWidth, height = image.naturalHeight;
    const rotatedWidth = Math.abs(Math.cos(radians) * width) + Math.abs(Math.sin(radians) * height);
    const rotatedHeight = Math.abs(Math.sin(radians) * width) + Math.abs(Math.cos(radians) * height);
    const side = Math.min(rotatedWidth, rotatedHeight);
    const crop = area || { x: (rotatedWidth - side) / 2, y: (rotatedHeight - side) / 2, width: side, height: side };
    if (!(crop.width > 0 && crop.height > 0)) throw new Error('Choose a valid crop area.');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image editing is unavailable in this browser.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(AVATAR_SIZE / crop.width, AVATAR_SIZE / crop.height);
    ctx.translate(-crop.x, -crop.y);
    ctx.translate(rotatedWidth / 2, rotatedHeight / 2);
    ctx.rotate(radians);
    ctx.drawImage(image, -width / 2, -height / 2);
    const result = canvas.toDataURL('image/webp', 0.86);
    if (!result.startsWith('data:image/webp;')) throw new Error('WebP export is unavailable. Please use a current browser.');
    return result;
  } finally { if (temporary) URL.revokeObjectURL(temporary); }
}

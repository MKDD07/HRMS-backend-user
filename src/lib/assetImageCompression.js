export function fittedImageSize(width, height, maxWidth) {
  const scale = Math.min(1, maxWidth / width);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function compressAssetImage(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const encode = async (maxWidth, quality) => {
      const canvas = document.createElement('canvas');
      const size = fittedImageSize(bitmap.width, bitmap.height, maxWidth);
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image compression is unavailable.');
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      if (!blob || blob.type !== 'image/webp') throw new Error('This browser cannot compress WebP images. Please use a current browser.');
      canvas.width = canvas.height = 0;
      return blob;
    };
    return { image: await encode(800, 0.82), thumbnail: await encode(160, 0.72) };
  } finally { bitmap.close(); }
}

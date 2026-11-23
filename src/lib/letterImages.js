// Normalize artwork so print and Word can use the same self-contained image.
export async function readLetterImage(file, maxWidth = 140) {
  if (!file || !['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Choose a PNG or JPEG image smaller than 5 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (image.naturalWidth * image.naturalHeight > 24000000) throw new Error('Choose an image smaller than 24 megapixels.');
    const ratio = Math.min(1, maxWidth * 2 / image.naturalWidth, 560 / image.naturalHeight);
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const src = canvas.toDataURL('image/png');
    if (src.length > 240000) throw new Error('This image is too detailed. Upload a smaller or simpler image.');
    const width = Math.min(maxWidth, canvas.width), height = Math.max(1, Math.round(canvas.height * width / canvas.width));
    return { src, width, height };
  } finally { URL.revokeObjectURL(url); }
}

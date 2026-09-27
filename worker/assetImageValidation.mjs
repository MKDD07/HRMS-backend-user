export function webpSize(bytes) {
  const text = new TextDecoder();
  if (bytes.length < 20 || text.decode(bytes.slice(0, 4)) !== 'RIFF' || text.decode(bytes.slice(8, 12)) !== 'WEBP') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 !== bytes.length) return null;
  const u24 = offset => bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = text.decode(bytes.slice(offset, offset + 4));
    const length = view.getUint32(offset + 4, true), start = offset + 8;
    if (start + length > bytes.length) return null;
    if (type === 'VP8X' && length >= 10) {
      if (bytes[start] & 2) return null; // Keep evidence as a single still image.
      return { width: u24(start + 4) + 1, height: u24(start + 7) + 1 };
    }
    if (type === 'VP8 ' && length >= 10 && bytes[start + 3] === 157 && bytes[start + 4] === 1 && bytes[start + 5] === 42) return { width: view.getUint16(start + 6, true) & 16383, height: view.getUint16(start + 8, true) & 16383 };
    if (type === 'VP8L' && length >= 5 && bytes[start] === 47) return { width: 1 + (view.getUint32(start + 1, true) & 16383), height: 1 + ((view.getUint32(start + 1, true) >>> 14) & 16383) };
    offset = start + length + (length % 2);
  }
  return null;
}

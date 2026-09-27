// Private, per-session memory cache. Blobs survive component/section changes, not reloads.
const cache = new Map();
const pending = new Map();
const MAX_BYTES = 32 * 1024 * 1024;
const TTL = 15 * 60 * 1000;
let session = null, bytes = 0, generation = 0;
export function clearImageCache() {
  cache.clear(); pending.clear(); bytes = 0; session = null; generation++;
}
export async function cachedImage(url) {
  const token = localStorage.getItem('pulse_hrms_token') || '';
  if (token !== session) { clearImageCache(); session = token; }
  if (!token) throw new Error('Sign in to view photos.');
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) {
    cache.delete(url); cache.set(url, cached);
    return cached.blob;
  }
  if (cached) { cache.delete(url); bytes -= cached.blob.size; }
  if (pending.has(url)) return pending.get(url);
  const version = generation;
  const request = (async () => {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('Photo unavailable');
    const blob = await response.blob();
    if (version !== generation || token !== localStorage.getItem('pulse_hrms_token')) throw new Error('Photo session changed.');
    if (blob.size <= MAX_BYTES) {
      while (bytes + blob.size > MAX_BYTES && cache.size) {
        const oldest = cache.keys().next().value;
        bytes -= cache.get(oldest).blob.size; cache.delete(oldest);
      }
      cache.set(url, { blob, expires: Date.now() + TTL }); bytes += blob.size;
    }
    return blob;
  })();
  pending.set(url, request);
  try { return await request; }
  finally { if (pending.get(url) === request) pending.delete(url); }
}
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === 'pulse_hrms_token' || event.key === null) clearImageCache();
});

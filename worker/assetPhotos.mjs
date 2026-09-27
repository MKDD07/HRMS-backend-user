import { webpSize } from './assetImageValidation.mjs';
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export async function assetPhotos({ db, env, actor, request, collection, id, url }) {
  if (actor.role !== 'company_admin') fail('Administrator access required.', 403);
  const row = await db.prepare('SELECT * FROM talent_records WHERE company_id=? AND collection=? AND id=?').bind(actor.company_id, collection, id).first();
  if (!row) fail('Record not found.', 404);
  const payload = JSON.parse(row.payload);
  const stage = url.searchParams.get('stage');
  const stages = collection === 'assets' ? ['purchase'] : ['issued', 'received', 'returned'];
  if (!stages.includes(stage)) fail('Invalid photo stage.');
  const photos = payload.photos || {};
  if (!env.HRMS_DOCUMENTS) fail('Photo storage unavailable.', 503);
  if (request.method === 'GET') {
    const photo = (photos[stage] || []).find(photo => photo.id === url.searchParams.get('photo'));
    if (!photo) fail('Photo not found.', 404);
    const object = await env.HRMS_DOCUMENTS.get(url.searchParams.get('variant') === 'thumbnail' ? photo.thumbnail_key || photo.key : photo.key);
    if (!object) fail('Photo not found.', 404);
    return new Response(object.body, { headers: { 'Content-Type': object.httpMetadata?.contentType || 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
  if (request.method !== 'POST') fail('Route not found.', 404);
  if (Number(url.searchParams.get('revision')) !== row.revision) fail('Record changed. Refresh before uploading.', 409);
  if ((photos[stage] || []).length >= 1) fail('Only one photo is allowed per stage.');
  if (stage === 'received' && !payload.received_date) fail('Record the received date before adding receipt photos.');
  if (stage === 'returned' && payload.status !== 'Returned') fail('Return the asset before adding return photos.');
  if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data')) fail('Upload both optimized WebP versions.');
  if (Number(request.headers.get('Content-Length')) > 6 * 1024 * 1024) fail('Photo upload is too large.', 413);
  const raw = await request.arrayBuffer();
  if (raw.byteLength > 6 * 1024 * 1024) fail('Photo upload is too large.', 413);
  const form = await new Response(raw, { headers: { 'Content-Type': request.headers.get('Content-Type') } }).formData();
  const readImage = async (name, maxWidth) => {
    const file = form.get(name);
    if (!file || typeof file.arrayBuffer !== 'function' || file.type !== 'image/webp' || !file.size || file.size > 5 * 1024 * 1024) fail('Provide a WebP image and thumbnail, up to 5 MB each.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const size = webpSize(bytes);
    if (!size || !size.width || !size.height || size.width > maxWidth) fail(name + ' exceeds its maximum width of ' + maxWidth + 'px or is invalid.');
    return { bytes, ...size };
  };
  const image = await readImage('image', 800), thumbnail = await readImage('thumbnail', 160);
  const contentType = 'image/webp';
  const photoId = crypto.randomUUID();
  const key = `companies/${actor.company_id}/assets/${collection}/${id}/${stage}/${photoId}/image.webp`;
  const thumbnailKey = key.replace(/image\.webp$/, 'thumbnail.webp');

  const updated = { ...payload, photos: { ...photos, [stage]: [...(photos[stage] || []), { id: photoId, key, thumbnail_key: thumbnailKey, width: image.width, height: image.height, at: new Date().toISOString(), actor: actor.user_id }] } };
  try {
    await env.HRMS_DOCUMENTS.put(key, image.bytes, { httpMetadata: { contentType } });
    await env.HRMS_DOCUMENTS.put(thumbnailKey, thumbnail.bytes, { httpMetadata: { contentType } });
    const saved = await db.prepare('UPDATE talent_records SET payload=?, revision=revision+1, updated_at=? WHERE company_id=? AND collection=? AND id=? AND revision=? RETURNING id').bind(JSON.stringify(updated), new Date().toISOString(), actor.company_id, collection, id, row.revision).first();
    if (!saved) fail('Record changed. Refresh before uploading.', 409);
  } catch (error) { await Promise.allSettled([env.HRMS_DOCUMENTS.delete(key), env.HRMS_DOCUMENTS.delete(thumbnailKey)]); throw error; }
  return { photos: updated.photos, revision: row.revision + 1 };
}

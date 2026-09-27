const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export async function deleteAssetList({ db, env, actor, id, method, body }) {
  if (actor.role !== 'company_admin') fail('Administrator access required.', 403);
  const result = await db.prepare(`WITH products AS MATERIALIZED (
    SELECT id FROM talent_records WHERE company_id=? AND collection='assets' AND json_extract(payload,'$.list_id')=?
  ) SELECT * FROM talent_records WHERE company_id=? AND (
    (collection='asset_lists' AND id=?) OR (collection='assets' AND id IN (SELECT id FROM products)) OR
    (collection='asset_issues' AND json_extract(payload,'$.asset_id') IN (SELECT id FROM products))) ORDER BY collection,id`).bind(actor.company_id, id, actor.company_id, id).all();
  const records = result.results;
  const list = records.find(record => record.collection === 'asset_lists');
  if (!list) fail('List not found.', 404);
  const title = JSON.parse(list.payload).title;
  const snapshot = JSON.stringify(records.map(record => [record.collection, record.id, record.revision]));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(snapshot));
  const token = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  if (method === 'GET') return { title, token, products: records.filter(record => record.collection === 'assets').map(record => ({ id: record.id, title: JSON.parse(record.payload).title })), issues: records.filter(record => record.collection === 'asset_issues').length };
  if (method !== 'POST') fail('Route not found.', 404);
  if (body.name !== title) fail('Type the exact list name to delete it.');
  if (body.token !== token) fail('List contents changed. Close this dialog and review the list again.', 409);
  // The materialized snapshot makes deletion all-or-nothing, including concurrent changes.
  const deleted = await db.prepare(`WITH products AS MATERIALIZED (
    SELECT id FROM talent_records WHERE company_id=? AND collection='assets' AND json_extract(payload,'$.list_id')=?
  ), targets AS MATERIALIZED (
    SELECT collection,id,revision FROM talent_records WHERE company_id=? AND (
      (collection='asset_lists' AND id=?) OR (collection='assets' AND id IN (SELECT id FROM products)) OR
      (collection='asset_issues' AND json_extract(payload,'$.asset_id') IN (SELECT id FROM products))) ORDER BY collection,id
  ), checked AS MATERIALIZED (
    SELECT json_group_array(json_array(collection,id,revision)) AS snapshot FROM targets
  ) DELETE FROM talent_records WHERE company_id=? AND (collection,id) IN (SELECT collection,id FROM targets)
    AND (SELECT snapshot FROM checked)=? RETURNING id`).bind(actor.company_id, id, actor.company_id, id, actor.company_id, snapshot).all();
  if (!deleted.results.length) fail('List contents changed. Close this dialog and review the list again.', 409);
  const keys = records.flatMap(record => Object.values(JSON.parse(record.payload).photos || {}).flatMap(photos => photos.flatMap(photo => [photo.key, photo.thumbnail_key].filter(Boolean))));
  const cleanup = await Promise.allSettled(keys.map(key => env.HRMS_DOCUMENTS?.delete(key)));
  return { deleted: true, cleanupPending: cleanup.some(result => result.status === 'rejected') };
}

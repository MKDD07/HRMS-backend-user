// Cache only directory rows. Authentication, permissions and plan seats stay live.
export async function directoryRows({ db, kv, company, limit, offset, fetchRows, ctx }) {
  if (!kv) return fetchRows();
  let revision;
  try {
    revision = (await db.prepare('SELECT revision FROM directory_cache_revisions WHERE company_id=?').bind(company).first())?.revision || '0';
  } catch {
    // An unapplied migration must never make the directory unavailable.
    return fetchRows();
  }
  const key = `directory:v1:${encodeURIComponent(company)}:${revision}:${limit}:${offset}`;
  try {
    const cached = await kv.get(key, 'json');
    if (cached?.version === 1 && Array.isArray(cached.rows)) return cached.rows;
  } catch { /* KV is optional; D1 remains authoritative. */ }
  const rows = await fetchRows();
  // Capture the revision before the query: a concurrent edit makes this key obsolete.
  const write = kv.put(key, JSON.stringify({ version: 1, rows }), { expirationTtl: 120 })
    .catch(() => console.warn(JSON.stringify({ event: 'directory_cache_write_failed' })));
  if (ctx) ctx.waitUntil(write);
  else await write;
  return rows;
}

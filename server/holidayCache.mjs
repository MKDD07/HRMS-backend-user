// Full-year cache: month/type views never spend additional provider quota.
export const HOLIDAY_CACHE_SCHEMA = `CREATE TABLE IF NOT EXISTS company_holiday_cache (
  company_id TEXT NOT NULL, country TEXT NOT NULL, year INTEGER NOT NULL,
  holidays TEXT CHECK(holidays IS NULL OR (json_valid(holidays) AND json_type(holidays)='array')),
  fetched_at TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(company_id, country, year)
)`;

export async function cachedHolidays({ db, company, country, year, apiKey, fetcher = fetch }) {
  country = String(country || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country) || !/^\d{4}$/.test(String(year)) || Number(year) < 1900 || Number(year) > 2100) {
    throw new Error('Select a valid country and a year between 1900 and 2100.');
  }
  year = Number(year);
  const keys = [company, country, year];
  const read = async () => (await db.query('SELECT holidays, fetched_at FROM company_holiday_cache WHERE company_id=? AND country=? AND year=?', keys))[0];
  const saved = await read();
  if (saved?.holidays != null) return { holidays: JSON.parse(saved.holidays), source: 'database', fetched_at: saved.fetched_at };
  if (!apiKey) throw new Error('Holiday provider is not configured on the server.');
  // A database lease also protects against simultaneous requests across Worker instances.
  const now = Date.now(), lease = now + 60000;
  const acquired = await db.query(`INSERT INTO company_holiday_cache(company_id,country,year,lease_until) VALUES(?,?,?,?)
    ON CONFLICT(company_id,country,year) DO UPDATE SET lease_until=excluded.lease_until
    WHERE company_holiday_cache.holidays IS NULL AND company_holiday_cache.lease_until < ? RETURNING company_id`, [...keys, lease, now]);
  if (!acquired.length) {
    const saved = await read();
    if (saved?.holidays != null) return { holidays: JSON.parse(saved.holidays), source: 'database', fetched_at: saved.fetched_at };
    throw new Error('This calendar is already being fetched. Please try again shortly.');
  }
  try {
    const params = new URLSearchParams({ api_key: apiKey, country, year: String(year) });
    const response = await fetcher(`https://calendarific.com/api/v2/holidays?${params}`, { signal: AbortSignal.timeout(20000) });
    const data = await response.json();
    if (!response.ok || data.meta?.code !== 200 || !Array.isArray(data.response?.holidays)) throw new Error('Holiday provider request failed. Please try again later.');
    const holidays = data.response.holidays.map((item, index) => ({
      id: `calific-${country}-${year}-${index}`,
      name: item.name || 'Holiday', holiday_date: String(item.date?.iso || '').slice(0, 10),
      type: (Array.isArray(item.type) ? item.type[0] : item.primary_type) || 'Holiday',
      types: Array.isArray(item.type) ? item.type : [],
      optional_note: item.description || '', active: true
    }));
    if (holidays.some(h => !/^\d{4}-\d{2}-\d{2}$/.test(h.holiday_date) || !h.holiday_date.startsWith(`${year}-`))) throw new Error('Holiday provider returned invalid dates.');
    const fetched_at = new Date().toISOString();
    await db.query('UPDATE company_holiday_cache SET holidays=?, fetched_at=?, lease_until=0 WHERE company_id=? AND country=? AND year=? AND lease_until=?', [JSON.stringify(holidays), fetched_at, ...keys, lease]);
    return { holidays, source: 'provider', fetched_at };
  } catch (error) {
    await db.query('UPDATE company_holiday_cache SET lease_until=0 WHERE company_id=? AND country=? AND year=? AND lease_until=?', [...keys, lease]);
    // Do not expose provider URLs or API keys from transport errors.
    throw new Error('Unable to fetch and save holidays. Please try again later.');
  }
}

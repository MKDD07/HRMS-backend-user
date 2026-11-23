// Memory only: directory data is never persisted to browser storage.
export function createEmployeeDirectoryCache(now = Date.now) {
  let scope, entry, pending;
  const select = key => { if (scope !== key) { scope = key; entry = undefined; pending = undefined; } };
  return {
    clear() { scope = undefined; entry = undefined; pending = undefined; },
    peek(key) { select(key); return entry?.value; },
    load(key, fetcher, maxAge = 0) {
      select(key);
      if (entry && maxAge > 0 && now() - entry.at < maxAge) return Promise.resolve(entry.value);
      if (pending) return pending;
      const request = Promise.resolve().then(fetcher).then(value => {
        if (scope === key && pending === request) entry = { value, at: now() };
        return value;
      }).finally(() => { if (pending === request) pending = undefined; });
      pending = request;
      return request;
    },
  };
}

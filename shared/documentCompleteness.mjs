export function documentCompleteness(documents, requiredCategories, today) {
  const normalize = value => String(value || '').trim().toLowerCase();
  const active = documents.filter(doc => !doc.deleted_at);
  const missing = requiredCategories.filter(category => !active.some(doc => normalize(doc.category) === normalize(category)));
  const expired = active.filter(doc => doc.expiry_date && doc.expiry_date < today);
  const unverified = active.filter(doc => doc.verified !== true);
  return { missing, expired: expired.map(doc => doc.title), unverified: unverified.map(doc => doc.title) };
}

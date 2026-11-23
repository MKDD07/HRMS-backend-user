export const AVATAR_SIZE = 144;
const slug = (value, fallback) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || fallback;
export function avatarStorageKey({ companyName, companyId, personName, userId, version, extension = 'webp' }) {
  return `${slug(companyName, 'company')}-${slug(companyId, 'company')}/profile/${slug(personName, 'person')}-${slug(userId, 'user')}/${slug(version, 'avatar')}.${extension}`;
}
export function isAvatarStorageKey(key) {
  return typeof key === 'string' && !key.split('/').some(part => !part || part === '.' || part === '..') && (key.startsWith('profile/') || /^[^/]+\/profile\/[^/]+\/[^/]+$/.test(key));
}

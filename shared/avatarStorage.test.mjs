import assert from 'node:assert/strict';
import { avatarStorageKey, isAvatarStorageKey } from './avatarStorage.mjs';
const key = avatarStorageKey({ companyName: 'Acme & Co', companyId: 'company-1', personName: 'Aarav Sharma', userId: 'user-1', version: 'photo-123' });
assert.equal(key, 'acme-co-company-1/profile/aarav-sharma-user-1/photo-123.webp');
assert.ok(isAvatarStorageKey(key));
assert.ok(isAvatarStorageKey('profile/old-company/photo.png'));
for (const invalid of ['other/secret', '../profile/person/file.webp', 'company/profile/../secret', 'https://host/photo.webp', '']) assert.equal(isAvatarStorageKey(invalid), false);
assert.notEqual(key, avatarStorageKey({ companyName: 'Acme & Co', companyId: 'company-2', personName: 'Aarav Sharma', userId: 'user-1', version: 'photo-123' }));
console.log('Avatar paths passed: names, tenant separation, legacy compatibility and invalid keys.');

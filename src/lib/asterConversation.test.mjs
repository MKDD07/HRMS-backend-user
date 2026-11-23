import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASTER_TTL, conversationKey, newConversation, restoreConversation } from './asterConversation.mjs';
test('conversation survives reopening without extending its fixed expiry', () => {
  const initial = { ...newConversation(100), messages: [{ role: 'user', text: 'Write a letter' }], input: 'Make it shorter' };
  assert.deepEqual(restoreConversation(JSON.stringify(initial), 500), initial);
  assert.equal(restoreConversation(JSON.stringify(initial), 500).expiresAt, 100 + ASTER_TTL);
});
test('expired or corrupted conversations reset after at most 24 hours', () => {
  const initial = newConversation(100);
  assert.equal(restoreConversation(JSON.stringify(initial), initial.expiresAt).messages.length, 0);
  assert.equal(restoreConversation('broken', 500).createdAt, 500);
  assert.equal(restoreConversation(JSON.stringify({ ...initial, expiresAt: initial.expiresAt + 1 }), 500).createdAt, 500);
});
test('company and user have separate conversation storage keys', () => {
  const user = { company_id: 'one', user_id: 'admin' };
  assert.notEqual(conversationKey(user), conversationKey({ ...user, company_id: 'two' }));
  assert.notEqual(conversationKey(user), conversationKey({ ...user, user_id: 'employee' }));
});

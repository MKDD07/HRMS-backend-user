import { test } from 'node:test';
import assert from 'node:assert/strict';
import { departmentDraft, asterTask, vaultDraft } from './groq.mjs';
const actor = { role: 'company_admin', company_id: 'company', user_id: 'admin' };
const body = { name: 'Fitness' };
const env = { GROQ_API_KEY: 'test-secret', AI_RATE_LIMITER: { limit: async () => ({ success: true }) } };
test('rejects unauthorized users, invalid input, missing key and request limits before contacting Groq', async () => {
  const fetcher = () => { throw new Error('Must not contact provider'); };
  for (const [args, status] of [
    [{ actor: { ...actor, role: 'employee' } }, 403],
    [{ body: { name: '' } }, 400],
    [{ env: {} }, 503],
    [{ env: { ...env, AI_RATE_LIMITER: { limit: async () => ({ success: false }) } } }, 429]
  ]) await assert.rejects(departmentDraft({ env, actor, body, fetcher, ...args }), error => error.status === status);
});
test('only sends selected department fields and returns validated editable content', async () => {
  const result = await departmentDraft({ env, actor, body: { ...body, salary: 'private', email: 'private' }, fetcher: async (url, options) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    const payload = JSON.parse(options.body);
    assert.deepEqual(JSON.parse(payload.messages[1].content), { name: 'Fitness', targets: '', responsibilities: '' });
    return Response.json({ choices: [{ message: { content: JSON.stringify({ targets: 'Improve sessions', responsibilities: 'Run training' }) } }] });
  } });
  assert.deepEqual(result, { targets: 'Improve sessions', responsibilities: 'Run training' });
});
test('handles provider quota, failures and malformed drafts without exposing provider output', async () => {
  for (const [response, status] of [[new Response('secret upstream error', { status: 429 }), 429], [new Response('secret', { status: 401 }), 502], [Response.json({ choices: [{ message: { content: '{"targets":42}' } }] }), 502]]) {
    await assert.rejects(departmentDraft({ env, actor, body, fetcher: async () => response }), error => error.status === status && !error.message.includes('secret'));
  }
});
test('Aster tasks enforce page permissions even after delegated role elevation', async () => {
  await assert.rejects(asterTask({ env, actor: { ...actor, original_role: 'employee', dashboard_pages: '["onboarding"]' }, page: 'salary-structure', body: { action: 'draft', prompt: 'Draft' } }), error => error.status === 403);
});
test('web research excludes private document context and uses the browser tool', async () => {
  const result = await asterTask({ env, actor, page: 'onboarding', body: { action: 'research', prompt: 'Public HR guidance', context: 'Private employee salary' }, fetcher: async (_url, options) => {
    const payload = JSON.parse(options.body);
    assert.equal(payload.response_format, undefined);
    assert.deepEqual(payload.tools, [{ type: 'browser_search' }]);
    assert.equal(options.body.includes('Private employee salary'), false);
    assert.match(payload.messages[0].content, /Aster AI/);
    return Response.json({ choices: [{ message: { content: 'Source: [Official](https://example.org)' } }] });
  } });
  assert.equal(result.research, true);
});
test('letter and salary results are validated before applying', async () => {
  for (const [page, output] of [['onboarding', { title: 'Welcome', text: 'Dear [Name], welcome.' }], ['salary-structure', { name: 'Specialist', grade: 'L3', description: 'Approved structure', annual_base_range: '' }]]) {
    assert.deepEqual(await asterTask({ env, actor, page, body: { action: 'draft', prompt: 'Draft details' }, fetcher: async () => Response.json({ choices: [{ message: { content: JSON.stringify(output) } }] }) }), output);
  }
});
test('vault references are scoped to the actor company and missing records are rejected', async () => {
  const db = { prepare: () => ({ bind: (company, id) => { assert.equal(company, actor.company_id); assert.equal(id, 'other-company-document'); return { first: async () => null }; } }) };
  await assert.rejects(vaultDraft({ env, actor, db, body: { prompt: 'Write letter', references: ['other-company-document'] } }), error => error.status === 404);
});
test('vault drafts detect a letter type and validate the complete result', async () => {
  const result = await vaultDraft({ env, actor, db: {}, body: { prompt: 'Write experience letter', references: [] }, fetcher: async () => Response.json({ choices: [{ message: { content: JSON.stringify({ title: 'Experience letter', text: 'To whom it may concern…', letter_type: 'experience' }) } }] }) });
  assert.equal(result.letter_type, 'experience');
});
test('follow-up vault requests include the previous letter as context', async () => {
  await vaultDraft({ env, actor, db: {}, body: { prompt: 'Make it shorter', previousText: 'Existing experience letter for [Employee].' }, fetcher: async (_url, options) => {
    const payload = JSON.parse(options.body);
    const user = JSON.parse(payload.messages[1].content);
    assert.match(user.context, /Existing experience letter/);
    assert.equal(user.request, 'Make it shorter');
    return Response.json({ choices: [{ message: { content: JSON.stringify({ title: 'Experience letter', text: 'Short revised letter.', letter_type: 'experience' }) } }] });
  } });
});

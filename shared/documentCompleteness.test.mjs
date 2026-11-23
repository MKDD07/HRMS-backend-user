import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentCompleteness } from './documentCompleteness.mjs';
test('checks configured categories, expiry and verification without inventing requirements', () => {
  const docs=[{title:'Passport',category:'ID Proof',verified:true,expiry_date:'2026-10-10'},{title:'Contract',category:'Employment Contract',verified:false}];
  assert.deepEqual(documentCompleteness(docs,['id proof','Employment Contract','Tax Form'],'2026-10-11'),{missing:['Tax Form'],expired:['Passport'],unverified:['Contract']});
  assert.deepEqual(documentCompleteness([],[],'2026-10-11'),{missing:[],expired:[],unverified:[]});
});
test('deleted documents cannot satisfy requirements; expiry today remains valid', () => {
  assert.deepEqual(documentCompleteness([{title:'Deleted',category:'ID Proof',verified:true,deleted_at:'2026-10-11'},{title:'Current',category:'Tax Form',verified:true,expiry_date:'2026-10-11'}],['ID Proof','Tax Form'],'2026-10-11'),{missing:['ID Proof'],expired:[],unverified:[]});
});

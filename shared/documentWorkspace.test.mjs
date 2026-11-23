import test from 'node:test';
import assert from 'node:assert/strict';
import { fromDraft, withMissingFields, artworkNodes } from './documentWorkspace.mjs';
import { documentFields, mergeContent, documentText } from './lifecycleDocuments.mjs';
const empty={type:'doc',content:[]};
test('AI missing details become live editable fields, bold survives and answers enter prompt',()=>{
 const body=fromDraft('Dear **Laura**, start on **[Start date required]**.');
 const content={header:empty,body,footer:empty};
 assert.equal(documentFields(content)[0].key,'start_date');
 assert.ok(JSON.stringify(body).includes('bold'));
 const filled=mergeContent(content,{start_date:'2026-11-01'});
 assert.ok(documentText(filled).includes('2026-11-01'));
 assert.ok(documentText({...content,body:withMissingFields(body)}).includes('[start date required]'));
});
test('nested letter artwork is retained during AI revisions',()=>{
 const image={type:'image',attrs:{src:'data:image/png;base64,AA=='}};
 assert.deepEqual(artworkNodes({type:'doc',content:[{type:'paragraph',content:[image]}]}),[image]);
});

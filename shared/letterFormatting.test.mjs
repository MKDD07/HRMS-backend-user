import test from 'node:test';
import assert from 'node:assert/strict';
import { letterRuns, missingLetterDetails } from './letterFormatting.mjs';
test('bold is formatted and unknown fields become underlined spaces',()=>{
 const runs=letterRuns('Role: **Fitness Trainer** starts **[Start date required]**.');
 assert.equal(runs.find(run=>run.text==='Fitness Trainer').bold,true);
 assert.ok(runs.find(run=>run.underline && !run.text.trim()));
 assert.ok(runs.every(run=>!run.text.includes('**')&&!run.text.includes('[Start date')));
});
test('named missing details are deduplicated for follow-up',()=>{
 assert.deepEqual(missingLetterDetails('[Start date required] and [Start date required]; {{Salary}}'),['Start date required','Salary']);
 assert.deepEqual(missingLetterDetails('Complete letter.'),[]);
});

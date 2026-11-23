import test from 'node:test';
import assert from 'node:assert/strict';
import { departmentAllowed,validateDepartmentScope } from './policyDepartmentScope.mjs';
test('department scope permits company-wide policies and only selected teams otherwise',()=>{assert.equal(departmentAllowed([], 'Fitness'),true);assert.equal(departmentAllowed(['Fitness'],'Fitness'),true);assert.equal(departmentAllowed(['Fitness'],'Management'),false);assert.deepEqual(validateDepartmentScope(['Fitness','Fitness'],['Fitness']),['Fitness']);assert.throws(()=>validateDepartmentScope(['Other company department'],['Fitness']));});

import test from 'node:test';
import assert from 'node:assert/strict';
import { forwardPolicyBackgroundRequest } from './policyBackgroundProxy.mjs';

test('local start and pause forward the session and job to the persistent Cloudflare runner', async () => {
  for (const action of ['policy-run', 'policy-pause']) {
    const response = await forwardPolicyBackgroundRequest({method:'POST',path:'/documents/assistant/'+action,headers:{authorization:'Bearer test-session'},body:{jobId:'job',actor:{company_id:'forged'}}}, async (url,options) => {
      assert.equal(url,'https://hrms-api.mkmkataria07.workers.dev/api/v1/documents/assistant/'+action);
      assert.equal(options.headers.Authorization,'Bearer test-session');
      assert.deepEqual(JSON.parse(options.body),{jobId:'job'});
      return Response.json({success:true});
    });
    assert.equal(response.status,200);
  }
});
test('other local routes remain local and Cloudflare authentication errors are preserved', async () => {
  assert.equal(await forwardPolicyBackgroundRequest({method:'GET',path:'/documents/assistant/policy-job'}),null);
  const response=await forwardPolicyBackgroundRequest({method:'POST',path:'/documents/assistant/policy-run',headers:{},body:{jobId:'job'}},async (_url,options)=>{assert.equal(options.headers.Authorization,undefined);return Response.json({error:'Unauthorized'},{status:401});});
  assert.equal(response.status,401);
});

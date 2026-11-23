const actions = new Set(['/documents/assistant/policy-run', '/documents/assistant/policy-pause']);

// Durable Object alarms run in Cloudflare, never in the local Express process.
export async function forwardPolicyBackgroundRequest(req, fetcher = fetch) {
  if (req.method !== 'POST' || !actions.has(req.path)) return null;
  return fetcher('https://hrms-api.mkmkataria07.workers.dev/api/v1' + req.path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
    },
    body: JSON.stringify({ jobId: req.body?.jobId }),
    signal: AbortSignal.timeout(30000),
  });
}

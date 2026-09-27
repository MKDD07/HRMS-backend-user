import { createHash } from 'node:crypto';
import { existingCloudflareConfig } from './payrollDatabase.mjs';
import { parsePages } from '../shared/dashboardAccess.mjs';

export async function dashboardAuthorization(req, env = process.env) {
  const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token || !env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) return null;
  const databaseId = existingCloudflareConfig().databaseId;
  if (!databaseId) return null;
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${databaseId}/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
    body: JSON.stringify({ sql: "SELECT u.user_id,u.company_id,u.role,e.dashboard_access,e.dashboard_pages FROM sessions s JOIN users u ON u.company_id=s.company_id AND u.user_id=s.user_id JOIN companies c ON c.company_id=u.company_id LEFT JOIN employees e ON e.company_id=u.company_id AND e.user_id=u.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='active' AND c.status='active' AND u.must_change_password=0", params: [createHash('sha256').update(token).digest('hex'), Date.now()] })
  });
  const result = await response.json();
  const actor = result.success && result.result?.[0]?.results?.[0];
  if (!actor) return null;
  return { ...actor, userid: actor.user_id, dashboard_pages: parsePages(actor.dashboard_pages), admin: actor.role === 'company_admin' };
}

export function legacyDashboardGuard(verify = dashboardAuthorization) {
  return async (req, res, next) => {
    if (req.path === '/health') return next();
    try {
      const actor = await verify(req);
      if (!actor) return res.status(401).json({ success: false, message: 'Verified sign-in required.' });
      // Legacy handlers are not company-scoped. Delegated accounts must use company APIs.
      if (!actor.admin) return res.status(403).json({ success: false, message: 'Use the company-scoped API for this dashboard account.' });
      next();
    } catch { res.status(503).json({ success: false, message: 'Unable to verify dashboard permissions.' }); }
  };
}

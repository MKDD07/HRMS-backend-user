import express from 'express';
import worker from '../worker/index.mjs';
import { existingCloudflareConfig } from './payrollDatabase.mjs';

// Local same-origin gateway executes the same Worker authentication against D1.
export function createCompanyAuthRouter() {
  const router = express.Router();
  router.use('/billing/webhook', express.raw({ type: '*/*', limit: '256kb' }));
  router.use('/documents', express.raw({ type: req => req.method === 'POST' && req.path === '/' && !req.is('application/json'), limit: '11mb' }));
  router.use(express.json({ limit: '10mb' }));
  router.use(async (req, res) => {
    try {
      const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_TOKEN: token } = process.env;
      if (!account || !token) return res.status(503).json({ success: false, message: 'Company authentication is not configured.' });
      const databaseId = existingCloudflareConfig().databaseId || '4fe0e2c8-e4f0-4433-8351-6dbf73359cd7';
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${databaseId}/query`;
      const query = async (sql, params, full = false) => {
        const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }), signal: AbortSignal.timeout(15000) });
        const body = await response.json();
        if (!response.ok || !body.success || body.result.some(row => !row.success)) throw new Error('Company database unavailable.');
        return full ? body.result : body.result[0].results;
      };
      function prepare(sql, params = []) { return { sql, params, bind(...values) { return prepare(sql, values); }, async first() { return (await query(sql, params))[0] || null; }, async all() { return { results: await query(sql, params) }; }, run() { return query(sql, params); } }; }
      const db = { prepare, async batch(statements) {
        // D1 REST accepts multi-statement SQL; bind values as SQL literals locally for a single atomic request.
        const literal = value => value === null ? 'NULL' : typeof value === 'number' ? String(value) : "'" + String(value).replaceAll("'", "''") + "'";
        const sql = statements.map(s => { let i = 0; return s.sql.replace(/\?/g, () => literal(s.params[i++])); }).join(';');
        return query(sql, [], true);
      } };
      const bucket = existingCloudflareConfig().bucket;
      const r2Bucket = bucketName => ({
        async get(key) {
          const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucketName}/objects/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } });
          if (response.status === 404) return null;
          if (!response.ok) throw new Error('Document storage is unavailable.');
          return { body: response.body, httpMetadata: { contentType: response.headers.get('content-type') } };
        },
        async put(key, body, options = {}) {
          const headers = { Authorization: `Bearer ${token}` };
          if (options.httpMetadata?.contentType) headers['Content-Type'] = options.httpMetadata.contentType;
          const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucketName}/objects/${encodeURIComponent(key)}`, { method: 'PUT', headers, body });
          if (!response.ok) throw new Error('Could not save the file to document storage.');
          return true;
        },
        async delete(key) {
          const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucketName}/objects/${encodeURIComponent(key)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
          if (!response.ok && response.status !== 404) throw new Error('Could not remove the file from document storage.');
          return true;
        }
      });
      const request = new Request('https://company.internal/api/v1' + req.url, { method: req.method, headers: { 'Content-Type': req.headers['content-type'] || 'application/json', ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}), ...(req.headers['x-razorpay-signature'] ? { 'x-razorpay-signature': req.headers['x-razorpay-signature'] } : {}), ...(req.headers['x-razorpay-event-id'] ? { 'x-razorpay-event-id': req.headers['x-razorpay-event-id'] } : {}) }, ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body) }) });
      const response = await worker.fetch(request, { DB: db, BILLING_MODE: process.env.BILLING_MODE || 'test', RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET, HRMS_DOCUMENTS: r2Bucket(bucket), HRMS_BRANDING: r2Bucket('hrms-db'), RECAPTCHA_SITE_KEY: process.env.RECAPTCHA_SITE_KEY, RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY, RECAPTCHA_ALLOWED_HOSTNAMES: process.env.RECAPTCHA_ALLOWED_HOSTNAMES });
      res.setHeader('X-Company-API-Version', 'billing-v1');
      res.status(response.status); response.headers.forEach((value, key) => res.setHeader(key, value)); res.send(Buffer.from(await response.arrayBuffer()));
    } catch (error) { res.status(503).json({ success: false, message: error.message || 'Company sign-in service is unavailable. Please try again.' }); }
  });
  router.use((error, _req, res, _next) => res.status(error.status || 500).json({ success: false, message: error.status === 413 ? 'Files must be 10 MB or smaller.' : 'Unable to read the upload.' }));
  return router;
}

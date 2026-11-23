import dotenv from 'dotenv';
dotenv.config({ path: '.env.groq', quiet: true });
import express from 'express';
import worker from '../worker/index.mjs';
import { existingCloudflareConfig } from './payrollDatabase.mjs';
import { createD1RestDatabase } from './d1RestDatabase.mjs';
import { forwardPolicyBackgroundRequest } from './policyBackgroundProxy.mjs';

// Local same-origin gateway executes the same Worker authentication against D1.
export function createCompanyAuthRouter() {
  const router = express.Router();
  const aiRequests = new Map();
  const aiLimiter = { async limit({ key }) {
    const now = Date.now();
    for (const [id, entry] of aiRequests) if (entry.until <= now) aiRequests.delete(id);
    const entry = aiRequests.get(key) || { count: 0, until: now + 60000 };
    entry.count++; aiRequests.set(key, entry);
    return { success: entry.count <= 5 };
  } };
  router.use('/billing/webhook', express.raw({ type: '*/*', limit: '256kb' }));
  router.use('/documents', express.raw({ type: req => req.method === 'POST' && req.path === '/' && !req.is('application/json'), limit: '11mb' }));
  router.use('/talent', express.raw({ type: req => req.method === 'POST' && req.path.endsWith('/photos'), limit: '6mb' }));
  router.use('/operations', express.raw({ type: req => req.method === 'POST' && req.path.endsWith('/receipts'), limit: '6mb' }));
  router.use(express.json({ limit: '10mb' }));
  router.use(async (req, res) => {
    try {
      const backgroundResponse = await forwardPolicyBackgroundRequest(req);
      if (backgroundResponse) {
        res.status(backgroundResponse.status);
        res.setHeader('Content-Type', backgroundResponse.headers.get('content-type') || 'application/json');
        return res.send(Buffer.from(await backgroundResponse.arrayBuffer()));
      }
      const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_TOKEN: token } = process.env;
      if (!account || !token) return res.status(503).json({ success: false, message: 'Company authentication is not configured.' });
      const databaseId = existingCloudflareConfig().databaseId || '4fe0e2c8-e4f0-4433-8351-6dbf73359cd7';
      const db = createD1RestDatabase({account,token,databaseId});
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
      const request = new Request('https://company.internal/api/v1' + req.url, { method: req.method, headers: { 'Content-Type': req.headers['content-type'] || 'application/json', ...(req.headers['x-offer-token'] ? { 'X-Offer-Token': req.headers['x-offer-token'] } : {}), ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}), ...(req.headers['x-razorpay-signature'] ? { 'x-razorpay-signature': req.headers['x-razorpay-signature'] } : {}), ...(req.headers['x-razorpay-event-id'] ? { 'x-razorpay-event-id': req.headers['x-razorpay-event-id'] } : {}) }, ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body) }) });
      const response = await worker.fetch(request, { DB: db, GROQ_API_KEY: process.env.GROQ_API_KEY, GROQ_MODEL: process.env.GROQ_MODEL, AI_RATE_LIMITER: aiLimiter, RESEND_API_KEY: process.env.RESEND_API_KEY, DOCUMENT_EMAIL_FROM: process.env.DOCUMENT_EMAIL_FROM, RECRUITMENT_TOKEN_SECRET: process.env.RECRUITMENT_TOKEN_SECRET, HRMS_PUBLIC_APP_URL: process.env.HRMS_PUBLIC_APP_URL, BILLING_MODE: process.env.BILLING_MODE || 'live', RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET, HRMS_DOCUMENTS: r2Bucket(bucket), HRMS_BRANDING: r2Bucket('hrms-db'), RECAPTCHA_SITE_KEY: process.env.RECAPTCHA_SITE_KEY, RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY, RECAPTCHA_ALLOWED_HOSTNAMES: process.env.RECAPTCHA_ALLOWED_HOSTNAMES });
      res.setHeader('X-Company-API-Version', 'billing-v1');
      res.status(response.status); response.headers.forEach((value, key) => res.setHeader(key, value)); res.send(Buffer.from(await response.arrayBuffer()));
    } catch (error) { res.status(503).json({ success: false, message: error.message || 'Company sign-in service is unavailable. Please try again.' }); }
  });
  router.use((error, _req, res, _next) => res.status(error.status || 500).json({ success: false, message: error.status === 413 ? 'Files must be 10 MB or smaller.' : 'Unable to read the upload.' }));
  return router;
}

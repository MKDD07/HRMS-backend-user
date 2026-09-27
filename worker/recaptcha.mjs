const fail = (message, status) => { throw Object.assign(new Error(message), { status }); };
export function captchaConfiguration(env) {
  return { enabled: env.RECAPTCHA_ENABLED === 'true' && Boolean(env.RECAPTCHA_SITE_KEY), siteKey: env.RECAPTCHA_ENABLED === 'true' ? env.RECAPTCHA_SITE_KEY || '' : '', mode: 'invisible' };
}
export async function verifyCaptcha(env, token, fetcher = fetch) {
  if (env.RECAPTCHA_ENABLED !== 'true' || !env.RECAPTCHA_SITE_KEY) return;
  if (!env.RECAPTCHA_SECRET_KEY) fail('Sign-in verification is not configured. Contact your administrator.', 503);
  const hosts = String(env.RECAPTCHA_ALLOWED_HOSTNAMES || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
  if (!hosts.length) fail('Sign-in verification is not configured. Contact your administrator.', 503);
  if (typeof token !== 'string' || !token || token.length > 8192) fail('Please complete the sign-in verification and try again.', 400);
  let result;
  try {
    const response = await fetcher('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: env.RECAPTCHA_SECRET_KEY, response: token }), signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error();
    result = await response.json();
  } catch { fail('Sign-in verification is unavailable. Please try again.', 503); }
  if (result.success !== true || typeof result.hostname !== 'string' || !hosts.includes(result.hostname.toLowerCase())) fail('Sign-in verification failed or expired. Please try again.', 403);
}

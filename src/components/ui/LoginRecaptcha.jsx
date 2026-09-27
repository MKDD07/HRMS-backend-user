import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

let scriptPromise;
function loadScript() {
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha);
  if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => failed(), 15000);
    function failed() { clearTimeout(timeout); script.remove(); scriptPromise = null; reject(new Error('Verification could not load. Check your connection and try again.')); }
    window.nextHRRecaptchaReady = () => { clearTimeout(timeout); resolve(window.grecaptcha); };
    script.src = 'https://www.google.com/recaptcha/api.js?onload=nextHRRecaptchaReady&render=explicit';
    script.async = true; script.defer = true; script.onerror = failed;
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export const LoginRecaptcha = forwardRef(function LoginRecaptcha({ siteKey }, ref) {
  const container = useRef(null), widget = useRef(null), pending = useRef(null), mounted = useRef(false);
  function finish(error, token) {
    const current = pending.current; pending.current = null;
    if (!current) return;
    clearTimeout(current.timeout);
    if (error) current.reject(error); else current.resolve(token);
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; finish(new Error('Verification cancelled.')); if (widget.current !== null) window.grecaptcha?.reset(widget.current); widget.current = null; };
  }, []);
  useImperativeHandle(ref, () => ({
    async execute() {
      const api = await loadScript();
      if (!mounted.current || !container.current) throw new Error('Please try signing in again.');
      if (widget.current === null) widget.current = api.render(container.current, {
        sitekey: siteKey, size: 'invisible', badge: 'inline',
        callback: token => finish(null, token),
        'expired-callback': () => finish(new Error('Verification expired. Please try again.')),
        'error-callback': () => finish(new Error('Verification failed to load. Check your connection and try again.'))
      });
      api.reset(widget.current);
      return new Promise((resolve, reject) => {
        pending.current = { resolve, reject, timeout: setTimeout(() => { finish(new Error('Verification timed out. Please try again.')); api.reset(widget.current); }, 120000) };
        try { api.execute(widget.current); } catch (error) { finish(error); }
      });
    },
    reset() { if (widget.current !== null) window.grecaptcha?.reset(widget.current); }
  }), [siteKey]);
  return <div className="login-recaptcha" ref={container} />;
});

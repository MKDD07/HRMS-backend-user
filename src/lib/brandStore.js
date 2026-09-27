// Brand Logo & System Identity Store
// Persists custom corporate logo for the HRMS Console sidebar and header

const STORAGE_KEY = 'pulse_brand_logo';
const EVENT_NAME = 'pulse_brand_logo_changed';

/**
 * Retrieve current brand logo data URL (or null if using default system logo)
 */
export function getBrandLogo() {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch (e) {
    console.error('Failed to get brand logo from storage:', e);
    return null;
  }
}

/**
 * Save brand logo (base64 data URL or URL) and notify all subscribers
 */
export function setBrandLogo(dataUrl) {
  try {
    if (dataUrl) {
      localStorage.setItem(STORAGE_KEY, dataUrl);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }

    // Broadcast change to current window and listeners
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: { logo: dataUrl || null } })
    );
  } catch (e) {
    console.error('Failed to save brand logo to storage:', e);
  }
  return dataUrl || null;
}

/**
 * Reset brand logo back to system default (Sparkles icon)
 */
export function removeBrandLogo() {
  return setBrandLogo(null);
}

/**
 * Subscribe to brand logo changes (cross-tab and within current window)
 */
export function onBrandLogoChange(callback) {
  const handleCustomEvent = (e) => {
    callback(e.detail?.logo || null);
  };

  const handleStorageEvent = (e) => {
    if (e.key === STORAGE_KEY) {
      callback(e.newValue || null);
    }
  };

  window.addEventListener(EVENT_NAME, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener(EVENT_NAME, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}

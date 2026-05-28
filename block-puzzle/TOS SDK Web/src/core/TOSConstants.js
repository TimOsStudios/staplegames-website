/**
 * TOS SDK Web — Constants
 *
 * Mirrors TOSSDKConstants.h (iOS). Single source of truth for any
 * "magic number" the SDK depends on.
 */

/** Web SDK version. Bump on every release. Set as TOS_SDK_VERSION user prop. */
export const TOS_WEB_SDK_VERSION = 'web-1.0.0';

/** A session ends after this many minutes of background. Resumes within
 *  this window stay in the same session. Matches iOS. */
export const MIN_MINUTES_BETWEEN_SESSIONS = 30;

/** Terms-of-use version. Bump to force re-prompt on a Terms revision. */
export const TOS_TNC_VERSION = 'v1';

/** Firebase modular SDK CDN — pin to a specific stable version. */
export const FIREBASE_VERSION = '10.13.1';
export const FIREBASE_APP_URL =
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`;
export const FIREBASE_ANALYTICS_URL =
  `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-analytics.js`;

/** localStorage namespace prefix for everything the SDK writes.
 *  Keeps SDK keys from colliding with game keys (bc_*). */
export const STORAGE_NS = 'tos.';

/** Max number of params attached to a single Firebase event. Firebase
 *  hard-caps at 25; we leave one slot of headroom. */
export const MAX_EVENT_PARAMS = 24;

/** Rate-cap for cWebBootError / cWebRuntimeError per session. */
export const MAX_BOOT_ERRORS_PER_SESH = 5;
export const MAX_RUNTIME_ERRORS_PER_SESH = 10;

/** Privacy contact for CCPA Data Request / Delete buttons. */
export const PRIVACY_CONTACT_EMAIL = 'privacy@staplegames.com';

/** Default Privacy Policy + Terms URLs. The game can override these via
 *  TOSWeb.init({ legal: { privacyUrl, termsUrl } }). */
export const DEFAULT_PRIVACY_URL = 'https://www.iubenda.com/privacy-policy/25051451';
export const DEFAULT_TERMS_URL   = 'https://staplegames.com/terms-of-use.html';

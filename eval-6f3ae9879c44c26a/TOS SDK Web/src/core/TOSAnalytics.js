/**
 * TOS SDK Web — TOSAnalytics.
 *
 * The core Firebase wrapper. Direct port of TOSAnalytics.{h,m} on iOS,
 * minus everything AppsFlyer / ATT / Crashlytics / Ads / Mediator (per
 * the locked decisions in WEB_SDK_SPEC.md).
 *
 * Responsibilities:
 *   - Initialize Firebase Analytics from the modular SDK (CDN ESM).
 *   - Manage TOS_ID + the TOS_GROUP* random axes.
 *   - Maintain seshSecondsActiveBank + lifetimeSecondsActiveBank.
 *   - Build baseline event params (cDaysSinceInstall, cLTSeshTime, etc.).
 *   - sendEvent / sendEventOnce / sendEventOncePerVC / sendEventOncePerSesh.
 *   - Maintain a pre-init queue so events fired before init() resolves
 *     don't get dropped.
 *
 * All public methods are no-ops if init() failed.
 */

import {
  TOS_WEB_SDK_VERSION,
  FIREBASE_APP_URL,
  FIREBASE_ANALYTICS_URL,
  MAX_EVENT_PARAMS,
} from './TOSConstants.js';
import { TOSStorage } from './TOSStorage.js';
import {
  localDayKey, utcDayKey, localDaysBetween, utcDaysBetween,
  secondsBetween, parseISO, round2,
} from './TOSCalendar.js';
import { PARAMS, USER_PROPS } from '../catalog/paramCatalog.js';
import { isKnownEvent } from '../catalog/eventCatalog.js';

let _fb = null;             // { app, analytics, logEvent, setUserId, setUserProperties }
let _ready = false;         // true once Firebase has resolved
let _failed = false;        // true if Firebase init threw / unsupported
let _queue = [];            // pre-ready event queue
let _devMode = false;
let _build = '0.0.0';
let _appName = 'unknown';
let _uniques = null;        // game adapter

const STATE = {
  tosId: null,
  tosGroup: 0,
  tosGroupSub: 0,
  tosGroupSubSub: 0,
  tosGroupSub3: 0,
  tosGroupSub4: 0,
  tosGroupAB: 0,
  tosGroup100: 0,

  installDate: null,         // Date
  firstInstallVC: '',
  lastLaunchVC: '',
  isFirstLaunch: false,
  isAppUpdated: false,

  cLTSeshCount: 0,
  lifetimeSecondsActiveBank: 0,
  seshSecondsActiveBank: 0,
  currentVersionSecondsActiveBank: 0,

  cDaysActive: 0,
  cDaysActiveUTC: 0,
  lastActiveLocalDay: '',
  lastActiveUtcDay: '',

  previousSeshStartDate: null,
  previousSeshEndDate: null,

  cSeshStartTimestamp: 0,           // ms epoch at session start
  latestResignActiveDate: null,     // Date when tab went hidden

  coldLaunchSesh: 1,                // 1 during first session after page load

  // Consent state (set by TOSLegal)
  consentTncAccepted: false,
  consentDoNotSell: false,
  consentCountry: 'US',

  // Web-only baseline diagnostics
  webPlatform: 'web-desktop',
  webReferrerHost: 'direct',
  webOrientation: 'portrait',
};

// ── Persistence keys (under tos.* namespace) ─────────────────────────
const K = {
  TOS_ID: 'tosId',
  TOS_GROUP: 'tosGroup',
  TOS_GROUP_SUB: 'tosGroupSub',
  TOS_GROUP_SUB_SUB: 'tosGroupSubSub',
  TOS_GROUP_SUB3: 'tosGroupSub3',
  TOS_GROUP_SUB4: 'tosGroupSub4',
  TOS_GROUP_AB: 'tosGroupAB',
  TOS_GROUP_100: 'tosGroup100',

  INSTALL_DATE: 'installDate',
  FIRST_INSTALL_VC: 'firstInstallVC',
  LAST_LAUNCH_VC: 'lastLaunchVC',

  LT_SESH_COUNT: 'cLTSeshCount',
  LIFETIME_SEC_BANK: 'lifetimeSecondsActiveBank',
  CURRENT_VERSION_SEC_BANK: 'currentVersionSecondsActiveBank',

  DAYS_ACTIVE: 'cDaysActive',
  DAYS_ACTIVE_UTC: 'cDaysActiveUTC',
  LAST_ACTIVE_LOCAL_DAY: 'lastActiveLocalDay',
  LAST_ACTIVE_UTC_DAY: 'lastActiveUtcDay',

  PREV_SESH_START: 'previousSeshStartDate',
  PREV_SESH_END: 'previousSeshEndDate',
  LATEST_RESIGN: 'latestResignActiveDate',

  HAS_WON_GAME: 'hasWonGame',

  // One-time / once-per-VC / once-per-sesh gates
  ONETIME: 'onetime.',          // tos.onetime.<eventName>
  ONCE_PER_VC: 'fov.',           // tos.fov.<eventName> -> VC of last send
  ONCE_PER_SESH: 'sesh.',        // tos.sesh.<eventName> -> cLTSeshCount of last send
};

// ── Init ─────────────────────────────────────────────────────────────

/**
 * @param {{
 *   firebaseConfig: object,
 *   build: string,
 *   appName: string,
 *   uniques: object,
 *   devMode?: boolean,
 * }} opts
 */
export async function init(opts) {
  _devMode = !!opts.devMode;
  _build = String(opts.build || '0.0.0');
  _appName = String(opts.appName || 'unknown');
  _uniques = opts.uniques || null;

  _hydrate();
  _detectInstallState();
  _detectWebPlatform();
  _detectConsent();

  if (_uniques && typeof _uniques.hydrate === 'function') {
    try { _uniques.hydrate(TOSStorage); }
    catch (e) { _logDev('uniques.hydrate threw', e); }
  }

  try {
    const [appMod, anaMod] = await Promise.all([
      import(FIREBASE_APP_URL),
      import(FIREBASE_ANALYTICS_URL),
    ]);
    const supported = await anaMod.isSupported();
    if (!supported) {
      _failed = true;
      _logDev('Firebase Analytics not supported in this environment.');
      return;
    }
    const app = appMod.initializeApp(opts.firebaseConfig);
    const analytics = anaMod.getAnalytics(app);
    _fb = {
      app, analytics,
      logEvent: (name, params) => anaMod.logEvent(analytics, name, params),
      setUserId: (id) => anaMod.setUserId(analytics, id),
      setUserProperties: (obj) => anaMod.setUserProperties(analytics, obj),
    };

    _fb.setUserId(STATE.tosId);
    _fb.setUserProperties(_buildUserProperties());

    _ready = true;
    _drainQueue();
  } catch (e) {
    _failed = true;
    _logDev('Firebase init failed: ' + (e && e.message));
  }
}

// ── State hydration ──────────────────────────────────────────────────

function _hydrate() {
  STATE.tosId       = TOSStorage.get(K.TOS_ID) || _newTosId();
  STATE.tosGroup    = TOSStorage.getInt(K.TOS_GROUP)     || _randomInt(1, 10);
  STATE.tosGroupSub = TOSStorage.getInt(K.TOS_GROUP_SUB) || _randomInt(1, 10);
  STATE.tosGroupSubSub = TOSStorage.getInt(K.TOS_GROUP_SUB_SUB) || _randomInt(1, 10);
  STATE.tosGroupSub3 = TOSStorage.getInt(K.TOS_GROUP_SUB3) || _randomInt(1, 10);
  STATE.tosGroupSub4 = TOSStorage.getInt(K.TOS_GROUP_SUB4) || _randomInt(1, 10);
  STATE.tosGroupAB   = TOSStorage.getInt(K.TOS_GROUP_AB) || _randomInt(1, 2);
  STATE.tosGroup100  = TOSStorage.getInt(K.TOS_GROUP_100) || _randomInt(1, 100);

  TOSStorage.set(K.TOS_ID, STATE.tosId);
  TOSStorage.set(K.TOS_GROUP, STATE.tosGroup);
  TOSStorage.set(K.TOS_GROUP_SUB, STATE.tosGroupSub);
  TOSStorage.set(K.TOS_GROUP_SUB_SUB, STATE.tosGroupSubSub);
  TOSStorage.set(K.TOS_GROUP_SUB3, STATE.tosGroupSub3);
  TOSStorage.set(K.TOS_GROUP_SUB4, STATE.tosGroupSub4);
  TOSStorage.set(K.TOS_GROUP_AB, STATE.tosGroupAB);
  TOSStorage.set(K.TOS_GROUP_100, STATE.tosGroup100);

  STATE.cLTSeshCount = TOSStorage.getInt(K.LT_SESH_COUNT, 0);
  STATE.lifetimeSecondsActiveBank = TOSStorage.getFloat(K.LIFETIME_SEC_BANK, 0);
  STATE.currentVersionSecondsActiveBank = TOSStorage.getFloat(K.CURRENT_VERSION_SEC_BANK, 0);

  STATE.cDaysActive = TOSStorage.getInt(K.DAYS_ACTIVE, 0);
  STATE.cDaysActiveUTC = TOSStorage.getInt(K.DAYS_ACTIVE_UTC, 0);
  STATE.lastActiveLocalDay = TOSStorage.get(K.LAST_ACTIVE_LOCAL_DAY) || '';
  STATE.lastActiveUtcDay = TOSStorage.get(K.LAST_ACTIVE_UTC_DAY) || '';

  STATE.previousSeshStartDate = parseISO(TOSStorage.get(K.PREV_SESH_START));
  STATE.previousSeshEndDate   = parseISO(TOSStorage.get(K.PREV_SESH_END));
  STATE.latestResignActiveDate = parseISO(TOSStorage.get(K.LATEST_RESIGN));
}

function _detectInstallState() {
  const storedInstall = TOSStorage.get(K.INSTALL_DATE);
  const storedFirstVC = TOSStorage.get(K.FIRST_INSTALL_VC);
  const storedLastVC = TOSStorage.get(K.LAST_LAUNCH_VC);

  if (!storedInstall) {
    STATE.isFirstLaunch = true;
    STATE.installDate = new Date();
    STATE.firstInstallVC = _build;
    STATE.lastLaunchVC = _build;
    TOSStorage.set(K.INSTALL_DATE, STATE.installDate.toISOString());
    TOSStorage.set(K.FIRST_INSTALL_VC, _build);
    TOSStorage.set(K.LAST_LAUNCH_VC, _build);
  } else {
    STATE.isFirstLaunch = false;
    STATE.installDate = parseISO(storedInstall) || new Date();
    STATE.firstInstallVC = storedFirstVC || _build;
    STATE.lastLaunchVC = storedLastVC || _build;
    if (STATE.lastLaunchVC !== _build) {
      STATE.isAppUpdated = true;
      TOSStorage.set(K.LAST_LAUNCH_VC, _build);
      TOSStorage.set(K.CURRENT_VERSION_SEC_BANK, 0);
      STATE.currentVersionSecondsActiveBank = 0;
    }
  }
}

function _detectWebPlatform() {
  const ua = (navigator.userAgent || '').toLowerCase();
  const w = window.innerWidth || 0;
  let platform = 'web-desktop';
  if (/android.*wv|version\/[\d.]+.*chrome\/[\d.]+ mobile/.test(ua)) platform = 'webview-android';
  else if (/ipad|iphone.*applewebkit(?!.*safari)/.test(ua)) platform = 'webview-ios';
  else if (/mobile|android|iphone|ipad|ipod/.test(ua)) platform = 'web-mobile';
  STATE.webPlatform = platform;

  let host = 'direct';
  try {
    if (document.referrer) host = new URL(document.referrer).host || 'direct';
  } catch (_) {}
  STATE.webReferrerHost = host;

  STATE.webOrientation = (w && w < window.innerHeight) ? 'portrait' : 'landscape';
}

function _detectConsent() {
  STATE.consentTncAccepted = TOSStorage.getBool('consent.tncAccepted', false);
  STATE.consentDoNotSell   = TOSStorage.getBool('consent.doNotSell', false);
  STATE.consentCountry     = TOSStorage.get('consent.country') || _bestEffortCountry();
}

function _bestEffortCountry() {
  try {
    const lang = navigator.language || 'en-US';
    const m = lang.match(/-([A-Z]{2})$/i);
    if (m) return m[1].toUpperCase();
  } catch (_) {}
  return 'US';
}

// ── Identity helpers ─────────────────────────────────────────────────

function _newTosId() {
  try {
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch (_) {}
  // Fallback for older browsers
  return 'tos-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
}
function _randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ── User properties ──────────────────────────────────────────────────

function _buildUserProperties() {
  const props = {
    [USER_PROPS.TOS_ID]:           STATE.tosId,
    [USER_PROPS.TOS_SDK_VERSION]:  TOS_WEB_SDK_VERSION,
    [USER_PROPS.TOS_GROUP]:        String(STATE.tosGroup),
    [USER_PROPS.TOS_GROUP_SUB]:    String(STATE.tosGroupSub),
    [USER_PROPS.TOS_GROUP_SUB_SUB]: String(STATE.tosGroupSubSub),
    [USER_PROPS.TOS_GROUP_SUB3]:   String(STATE.tosGroupSub3),
    [USER_PROPS.TOS_GROUP_SUB4]:   String(STATE.tosGroupSub4),
    [USER_PROPS.TOS_GROUP_AB]:     String(STATE.tosGroupAB),
    [USER_PROPS.TOS_GROUP_100]:    String(STATE.tosGroup100),
    [USER_PROPS.TOS_TEST_TAG]:     'none',
    [USER_PROPS.INSTALL_VC]:       STATE.firstInstallVC,
    [USER_PROPS.VC]:               _build,
    [USER_PROPS.IS_DEV_MODE]:      _devMode ? '1' : '0',
    [USER_PROPS.DAYS_SINCE_INSTALL]: String(daysSinceInstall()),

    [USER_PROPS.WEB_PLATFORM]:     STATE.webPlatform,
    [USER_PROPS.WEB_VIEWPORT_BUCKET]: _viewportBucket(),
    [USER_PROPS.WEB_PWA_INSTALLED]: _isPWA() ? '1' : '0',
    [USER_PROPS.WEB_LANG]:         (navigator.language || 'en').slice(0, 2),
    [USER_PROPS.WEB_CONNECTION]:   _connectionType(),

    [USER_PROPS.CONSENT_COOKIES]:  STATE.consentTncAccepted ? '1' : '0',
    [USER_PROPS.CONSENT_DO_NOT_SELL]: STATE.consentDoNotSell ? '1' : '0',
    [USER_PROPS.CONSENT_COUNTRY]:  STATE.consentCountry,
  };
  // Omit referrer host if user opted out of CCPA share/sell
  if (!STATE.consentDoNotSell) {
    props[USER_PROPS.WEB_REFERRER_HOST] = STATE.webReferrerHost;
  }
  // LT_GAMES_WON and HAS_WON_GAME come from the uniques adapter
  if (_uniques && typeof _uniques.getLTGamesWon === 'function') {
    props[USER_PROPS.LT_GAMES_WON] = String(_uniques.getLTGamesWon());
  }
  if (TOSStorage.getBool(K.HAS_WON_GAME, false)) {
    props[USER_PROPS.HAS_WON_GAME] = '1';
  }
  return props;
}

function _viewportBucket() {
  const w = window.innerWidth || 0;
  if (w < 600) return 'phone';
  if (w < 1024) return 'tablet';
  return 'desktop';
}
function _isPWA() {
  try { return matchMedia('(display-mode: standalone)').matches; } catch (_) { return false; }
}
function _connectionType() {
  try {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (c && c.effectiveType) return c.effectiveType;
  } catch (_) {}
  return 'unknown';
}

// Re-push user properties when consent or LT changes. Cheap; Firebase
// dedupes.
export function refreshUserProperties() {
  if (!_ready || !_fb) return;
  try { _fb.setUserProperties(_buildUserProperties()); } catch (_) {}
}

// ── Baseline event params ────────────────────────────────────────────

export function buildBaselineParams() {
  return {
    [PARAMS.DAYS_SINCE_INSTALL]:       daysSinceInstall(),
    [PARAMS.DAYS_SINCE_PREVIOUS_SESH]: daysSincePreviousSesh(),
    [PARAMS.DAYS_ACTIVE]:              STATE.cDaysActive,
    [PARAMS.DAYS_ACTIVE_UTC]:          STATE.cDaysActiveUTC,
    [PARAMS.LT_SESH_TIME]:             cLTSeshTime(),
    [PARAMS.LT_SESH_COUNT]:            STATE.cLTSeshCount,
    [PARAMS.CURRENT_SESH_TIME]:        cCurrentSeshTime(),
    [PARAMS.COLD_LAUNCH_SESH]:         STATE.coldLaunchSesh,
    [PARAMS.CONSENT_STATE]:            buildConsentState(),
    [PARAMS.VC]:                       _build,
    [PARAMS.WEB_PLATFORM]:             STATE.webPlatform,
    [PARAMS.WEB_REFERRER_HOST]:        STATE.consentDoNotSell ? 'opted_out' : STATE.webReferrerHost,
    [PARAMS.WEB_ORIENTATION]:          STATE.webOrientation,
  };
}

export function buildConsentState() {
  return [
    STATE.consentTncAccepted ? '1' : '0',
    STATE.consentDoNotSell ? '1' : '0',
    STATE.consentCountry || 'US',
  ].join('|');
}

// ── Time getters ─────────────────────────────────────────────────────

export function daysSinceInstall() {
  if (!STATE.installDate) return 0;
  return localDaysBetween(STATE.installDate, new Date());
}
export function daysSinceInstallUTC() {
  if (!STATE.installDate) return 0;
  return utcDaysBetween(STATE.installDate, new Date());
}
export function daysSincePreviousSesh() {
  if (!STATE.previousSeshStartDate) return 0;
  return localDaysBetween(STATE.previousSeshStartDate, new Date());
}
export function secSinceInstall() {
  if (!STATE.installDate) return 0;
  return secondsBetween(STATE.installDate, new Date());
}
export function cLTSeshTime() {
  return round2(STATE.lifetimeSecondsActiveBank + STATE.seshSecondsActiveBank);
}
export function cCurrentSeshTime() {
  return round2(STATE.seshSecondsActiveBank);
}

// ── Session bank updates (called by TOSLifecycle on visibility) ──────

export function bankActiveSeconds(deltaSec) {
  if (!Number.isFinite(deltaSec) || deltaSec <= 0) return;
  STATE.seshSecondsActiveBank += deltaSec;
  STATE.currentVersionSecondsActiveBank += deltaSec;
}

export function commitSessionBank() {
  STATE.lifetimeSecondsActiveBank += STATE.seshSecondsActiveBank;
  TOSStorage.set(K.LIFETIME_SEC_BANK, String(STATE.lifetimeSecondsActiveBank));
  TOSStorage.set(K.CURRENT_VERSION_SEC_BANK, String(STATE.currentVersionSecondsActiveBank));
  STATE.seshSecondsActiveBank = 0;
}

export function setLatestResignActive(date) {
  STATE.latestResignActiveDate = date;
  TOSStorage.set(K.LATEST_RESIGN, date.toISOString());
}

export function getLatestResignActive() { return STATE.latestResignActiveDate; }
export function getPreviousSeshStartDate() { return STATE.previousSeshStartDate; }
export function setPreviousSeshStartDate(d) {
  STATE.previousSeshStartDate = d;
  TOSStorage.set(K.PREV_SESH_START, d.toISOString());
}
export function setPreviousSeshEndDate(d) {
  STATE.previousSeshEndDate = d;
  TOSStorage.set(K.PREV_SESH_END, d.toISOString());
}

export function bumpSessionCount() {
  STATE.cLTSeshCount += 1;
  TOSStorage.set(K.LT_SESH_COUNT, String(STATE.cLTSeshCount));
  STATE.cSeshStartTimestamp = Date.now();
  if (_uniques && typeof _uniques.onSessionStart === 'function') {
    try { _uniques.onSessionStart(); } catch (_) {}
  }
}
export function clearColdLaunchSesh() { STATE.coldLaunchSesh = 0; }

export function recordDailyActiveMaybe() {
  const today = localDayKey();
  const todayUTC = utcDayKey();
  if (STATE.lastActiveLocalDay !== today) {
    STATE.cDaysActive += 1;
    STATE.lastActiveLocalDay = today;
    TOSStorage.set(K.DAYS_ACTIVE, String(STATE.cDaysActive));
    TOSStorage.set(K.LAST_ACTIVE_LOCAL_DAY, today);
  }
  if (STATE.lastActiveUtcDay !== todayUTC) {
    STATE.cDaysActiveUTC += 1;
    STATE.lastActiveUtcDay = todayUTC;
    TOSStorage.set(K.DAYS_ACTIVE_UTC, String(STATE.cDaysActiveUTC));
    TOSStorage.set(K.LAST_ACTIVE_UTC_DAY, todayUTC);
  }
}

export function setOrientation(o) {
  STATE.webOrientation = o;
}

export function markHasWonGame() {
  TOSStorage.setBool(K.HAS_WON_GAME, true);
  refreshUserProperties();
}

// ── State accessors (read-only) ──────────────────────────────────────

export function snapshot() {
  return Object.freeze({
    tosId: STATE.tosId,
    cLTSeshCount: STATE.cLTSeshCount,
    cDaysActive: STATE.cDaysActive,
    cDaysActiveUTC: STATE.cDaysActiveUTC,
    cDaysSinceInstall: daysSinceInstall(),
    cCurrentSeshTime: cCurrentSeshTime(),
    cLTSeshTime: cLTSeshTime(),
    installDate: STATE.installDate ? STATE.installDate.toISOString() : null,
    isFirstLaunch: STATE.isFirstLaunch,
    isAppUpdated: STATE.isAppUpdated,
    webPlatform: STATE.webPlatform,
    webReferrerHost: STATE.webReferrerHost,
    webOrientation: STATE.webOrientation,
    consentTncAccepted: STATE.consentTncAccepted,
    consentDoNotSell: STATE.consentDoNotSell,
  });
}

export function setConsent({ tncAccepted, doNotSell, country } = {}) {
  if (typeof tncAccepted === 'boolean') {
    STATE.consentTncAccepted = tncAccepted;
    TOSStorage.setBool('consent.tncAccepted', tncAccepted);
    if (tncAccepted) TOSStorage.set('consent.acceptedAtISO', new Date().toISOString());
  }
  if (typeof doNotSell === 'boolean') {
    STATE.consentDoNotSell = doNotSell;
    TOSStorage.setBool('consent.doNotSell', doNotSell);
  }
  if (typeof country === 'string') {
    STATE.consentCountry = country.toUpperCase().slice(0, 2);
    TOSStorage.set('consent.country', STATE.consentCountry);
  }
  refreshUserProperties();
  _drainQueue();
}

// ── Pre-consent gating ───────────────────────────────────────────────
// Events that may fire before TnC acceptance. Everything else queues
// until tncAccepted flips true.
const PRE_CONSENT_ALLOWED = new Set([
  'cWebPageLoadStart', 'cWebDOMReady', 'cWebFirstPaint',
  'cWebFirstContentfulPaint', 'cWebLargestContentfulPaint',
  'cWebFullyLoaded', 'cWebBootError', 'cWebRuntimeError',
  'cTermsAndPrivacyShown', 'cTermsClicked', 'cPrivacyClicked',
  'cTermsAndPrivacyAccepted',
]);

// ── sendEvent ────────────────────────────────────────────────────────

/**
 * Fire an event. Merges baseline + uniques + extra params.
 * If Firebase isn't ready yet OR TnC hasn't been accepted (and this
 * event isn't on the pre-consent allowlist), the event queues.
 */
export function sendEvent(name, extraParams) {
  if (_devMode && !isKnownEvent(name)) {
    console.warn('[TOSAnalytics] unknown event name:', name,
      ' — add it to eventCatalog.js');
  }
  const ev = { name, params: extraParams || {} };
  if (!_ready) { _queue.push(ev); return; }
  if (!STATE.consentTncAccepted && !PRE_CONSENT_ALLOWED.has(name)) {
    _queue.push(ev); return;
  }
  _dispatch(ev);
}

/** Fire once per install. Subsequent calls are no-ops. */
export function sendEventOnce(name, extraParams) {
  const k = K.ONETIME + name;
  if (TOSStorage.get(k) === '1') return;
  sendEvent(name, extraParams);
  TOSStorage.set(k, '1');
}

/** Fire once per current build (VC). Subsequent same-build calls no-op. */
export function sendEventOncePerVC(name, extraParams) {
  const k = K.ONCE_PER_VC + name;
  if (TOSStorage.get(k) === _build) return;
  sendEvent(name, extraParams);
  TOSStorage.set(k, _build);
}

/** Fire once per session (gated by cLTSeshCount). */
export function sendEventOncePerSesh(name, extraParams) {
  const k = K.ONCE_PER_SESH + name;
  if (TOSStorage.getInt(k, -1) === STATE.cLTSeshCount) return;
  sendEvent(name, extraParams);
  TOSStorage.set(k, String(STATE.cLTSeshCount));
}

function _dispatch({ name, params }) {
  let merged = { ...buildBaselineParams() };
  if (_uniques && typeof _uniques.uniqueAnalyticsEventParams === 'function') {
    try { Object.assign(merged, _uniques.uniqueAnalyticsEventParams()); }
    catch (e) { _logDev('uniques.uniqueAnalyticsEventParams threw', e); }
  }
  Object.assign(merged, params);
  merged = _cleanseParams(merged);
  merged = _enforceParamCap(merged);

  if (_devMode) {
    try { console.log('[TOSAnalytics] →', name, merged); } catch (_) {}
  }
  if (_fb) {
    try { _fb.logEvent(name, merged); }
    catch (e) { _logDev('logEvent threw: ' + e); }
  }
}

function _cleanseParams(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'number' && !Number.isFinite(v)) continue;
    if (typeof v === 'object') { out[k] = JSON.stringify(v); continue; }
    out[k] = (typeof v === 'string') ? v.slice(0, 100) : v;
  }
  return out;
}

function _enforceParamCap(obj) {
  const keys = Object.keys(obj);
  if (keys.length <= MAX_EVENT_PARAMS) return obj;
  // Priority drop order: web diagnostics first (they're nice-to-have),
  // then uniques, then baseline.
  const dropOrder = [
    PARAMS.WEB_INP_MS, PARAMS.WEB_CLS_SCORE, PARAMS.WEB_INTERACTIVE_MS,
    PARAMS.WEB_RENDER_MS, PARAMS.WEB_LOAD_MS, PARAMS.WEB_LCP_MS,
    PARAMS.WEB_FCP_MS, PARAMS.WEB_PAINT_MS,
    PARAMS.WEB_ORIENTATION, PARAMS.WEB_REFERRER_HOST, PARAMS.WEB_PLATFORM,
  ];
  const out = { ...obj };
  for (const k of dropOrder) {
    if (Object.keys(out).length <= MAX_EVENT_PARAMS) break;
    delete out[k];
  }
  if (Object.keys(out).length > MAX_EVENT_PARAMS) {
    const keep = Object.keys(out).slice(0, MAX_EVENT_PARAMS);
    const trimmed = {};
    for (const k of keep) trimmed[k] = out[k];
    return trimmed;
  }
  return out;
}

function _drainQueue() {
  if (!_ready) return;
  const q = _queue;
  _queue = [];
  for (const ev of q) {
    if (!STATE.consentTncAccepted && !PRE_CONSENT_ALLOWED.has(ev.name)) {
      _queue.push(ev);
      continue;
    }
    _dispatch(ev);
  }
}

function _logDev(...args) {
  if (!_devMode) return;
  try { console.log('[TOSAnalytics]', ...args); } catch (_) {}
}

// ── Public state object (read-only) ──────────────────────────────────

export const TOSAnalytics = {
  init, sendEvent, sendEventOnce, sendEventOncePerVC, sendEventOncePerSesh,
  refreshUserProperties, setConsent, snapshot,
  buildConsentState, buildBaselineParams,
  bankActiveSeconds, commitSessionBank,
  setLatestResignActive, getLatestResignActive,
  getPreviousSeshStartDate, setPreviousSeshStartDate, setPreviousSeshEndDate,
  bumpSessionCount, clearColdLaunchSesh, recordDailyActiveMaybe,
  setOrientation, markHasWonGame,
  daysSinceInstall, daysSinceInstallUTC, secSinceInstall,
  cLTSeshTime, cCurrentSeshTime,
  isReady: () => _ready, isFailed: () => _failed, isDevMode: () => _devMode,
  STATE,  // internal — accessed by TOSLifecycle
};

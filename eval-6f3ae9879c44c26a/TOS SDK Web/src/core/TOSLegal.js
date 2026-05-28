/**
 * TOS SDK Web — TOSLegal.
 *
 * Web port of the legal / consent funnels from TOSLegal.m on iOS.
 * See LEGAL_INTEGRATION.md for the full UX + event spec.
 *
 * Responsibilities:
 *   - Render a first-launch consent modal (Terms + Privacy gate).
 *   - Render the Settings → Legal extension (Do Not Sell + Data Request).
 *   - Persist consent state via TOSAnalytics.setConsent().
 *   - Fire the cTerms* / cLegal* / cDataRequest* funnel events.
 *
 * All UI is inline (no external CSS) so the SDK stays drop-in.
 */

import { TOSAnalytics } from './TOSAnalytics.js';
import { TOSStorage } from './TOSStorage.js';
import { EVENTS } from '../catalog/eventCatalog.js';
import {
  TOS_TNC_VERSION, PRIVACY_CONTACT_EMAIL,
  DEFAULT_PRIVACY_URL, DEFAULT_TERMS_URL,
} from './TOSConstants.js';

let _privacyUrl = DEFAULT_PRIVACY_URL;
let _termsUrl   = DEFAULT_TERMS_URL;
let _appName    = 'block-puzzle-web';
let _modalEl    = null;

const K = {
  TNC_ACCEPTED:    'consent.tncAccepted',
  TNC_VERSION:     'consent.tncVersion',
  DO_NOT_SELL:     'consent.doNotSell',
  ACCEPTANCE_MODE: 'consent.acceptanceMode',  // 'modal' | 'auto-no-gate' | 'forced-bypass'
};

/**
 * @param {{
 *   privacyUrl?: string,
 *   termsUrl?: string,
 *   appName?: string,
 *   consentGate?: 'auto' | 'always' | 'never',
 * }} opts
 *
 * Consent-gate modes (locked in WEB_SDK_SPEC + LEGAL_INTEGRATION):
 *   - 'auto'   (default): show the first-launch modal ONLY if we
 *              detect the user is likely in a GDPR/UK-GDPR
 *              jurisdiction. Elsewhere (US, etc.) skip the modal —
 *              CCPA & US state laws don't require pre-collection
 *              consent; opt-out lives in Settings → Legal.
 *   - 'always': show the modal to everyone (use during audits or
 *              when you want explicit opt-in worldwide).
 *   - 'never':  never show the modal anywhere. Use ONLY for
 *              internal testing — bypasses GDPR. Will log a console
 *              warning.
 */
export function init(opts = {}) {
  if (opts.privacyUrl) _privacyUrl = opts.privacyUrl;
  if (opts.termsUrl)   _termsUrl   = opts.termsUrl;
  if (opts.appName)    _appName    = opts.appName;
  const mode = opts.consentGate || 'auto';

  // Version-bump handling — if Terms get a new version, treat as
  // un-accepted so the modal re-shows for users who had accepted v1.
  const storedVersion = TOSStorage.get(K.TNC_VERSION);
  const wasAccepted = TOSStorage.getBool(K.TNC_ACCEPTED, false);
  const isAccepted = wasAccepted && storedVersion === TOS_TNC_VERSION;

  if (isAccepted) {
    TOSAnalytics.setConsent({ tncAccepted: true });
    return;
  }
  if (storedVersion && storedVersion !== TOS_TNC_VERSION) {
    TOSStorage.setBool(K.TNC_ACCEPTED, false);
  }

  // Decide whether to actually show the modal.
  let shouldShow;
  if (mode === 'always')      shouldShow = true;
  else if (mode === 'never') {
    shouldShow = false;
    try { console.warn('[TOSLegal] consentGate=never — modal suppressed for testing. Do NOT ship this way.'); } catch (_) {}
  }
  else                        shouldShow = _isLikelyGDPRJurisdiction();

  if (shouldShow) {
    _showConsentModal();
  } else {
    _autoAccept(mode === 'never' ? 'forced-bypass' : 'auto-no-gate');
  }
}

/**
 * Best-effort GDPR/UK-GDPR detection via timezone. No external
 * geo-IP call (we have no server). Conservative: when in doubt,
 * SHOW the modal — defaulting to more transparency is never wrong.
 */
function _isLikelyGDPRJurisdiction() {
  let tz = '';
  try { tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || ''; }
  catch (_) { return true; }   // Intl unavailable → default-show (safer)

  if (!tz) return true;
  // EEA + UK + Switzerland — every Europe/* timezone plus the EEA
  // outliers (Iceland, Azores, Canary, Madeira, Faroe).
  if (/^Europe\//.test(tz)) return true;
  if (/^Atlantic\/(Azores|Canary|Madeira|Faeroe|Reykjavik)$/.test(tz)) return true;
  return false;
}

/** Auto-accept path used in CCPA jurisdictions (no banner required). */
function _autoAccept(mode) {
  TOSStorage.setBool(K.TNC_ACCEPTED, true);
  TOSStorage.set(K.TNC_VERSION, TOS_TNC_VERSION);
  TOSStorage.set(K.ACCEPTANCE_MODE, mode);
  TOSStorage.set('consent.acceptedAtISO', new Date().toISOString());
  TOSAnalytics.setConsent({ tncAccepted: true });
}

// ── First-launch consent modal ───────────────────────────────────────

function _showConsentModal() {
  if (_modalEl) return;
  const el = document.createElement('div');
  el.id = 'tos-consent';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'tos-consent-title');
  el.innerHTML = `
    <style>
      #tos-consent {
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(15, 23, 42, 0.55);
        display: flex; align-items: center; justify-content: center;
        padding: 18px;
        font-family: 'Rubik', system-ui, -apple-system, sans-serif;
        animation: tos-fade-in 0.25s ease;
      }
      @keyframes tos-fade-in { from { opacity: 0; } to { opacity: 1; } }
      #tos-consent .card {
        background: #fff; color: #1f2937;
        max-width: 360px; width: 100%;
        border-radius: 18px;
        box-shadow: 0 24px 48px rgba(0,0,0,0.35);
        padding: 22px 22px 18px;
      }
      #tos-consent h2 {
        margin: 0 0 10px;
        font-size: 18px; font-weight: 700; color: #0f172a;
        letter-spacing: -0.2px;
      }
      #tos-consent p {
        margin: 0 0 14px;
        font-size: 14px; line-height: 1.5; color: #334155;
      }
      #tos-consent .links {
        display: flex; gap: 14px; margin-bottom: 14px;
        font-size: 13px; font-weight: 500;
      }
      #tos-consent .links button {
        background: transparent; border: none; padding: 0;
        color: #2563eb; text-decoration: underline; cursor: pointer;
        font: inherit;
      }
      #tos-consent .accept {
        display: block; width: 100%;
        background: #2563eb; color: #fff;
        border: none; border-radius: 12px;
        padding: 12px; font-size: 15px; font-weight: 600;
        cursor: pointer; -webkit-appearance: none;
        transition: transform 0.1s ease, background 0.15s ease;
      }
      #tos-consent .accept:active { transform: scale(0.98); background: #1d4ed8; }
      #tos-consent .footer {
        margin-top: 10px; text-align: center; font-size: 11px; color: #64748b;
      }
    </style>
    <div class="card">
      <h2 id="tos-consent-title">Welcome to Blocks Classic</h2>
      <p>We use cookies and analytics to improve your experience.
      We don't sell your data. By tapping <strong>Got it</strong> you
      agree to our Terms of Use and Privacy Policy.</p>
      <div class="links">
        <button type="button" data-action="terms">Terms of Use</button>
        <button type="button" data-action="privacy">Privacy Policy</button>
      </div>
      <button class="accept" type="button" data-action="accept">Got it</button>
      <div class="footer">Manage anytime in Settings → Legal</div>
    </div>
  `;
  document.body.appendChild(el);
  _modalEl = el;

  el.addEventListener('click', (e) => {
    const action = e.target && e.target.dataset && e.target.dataset.action;
    if (action === 'terms') {
      TOSAnalytics.sendEvent(EVENTS.TERMS_CLICKED);
      _openUrl(_termsUrl);
    } else if (action === 'privacy') {
      TOSAnalytics.sendEvent(EVENTS.PRIVACY_CLICKED);
      _openUrl(_privacyUrl);
    } else if (action === 'accept') {
      _acceptConsent();
    }
  });

  TOSAnalytics.sendEvent(EVENTS.TERMS_AND_PRIVACY_SHOWN);
}

function _acceptConsent() {
  TOSStorage.setBool(K.TNC_ACCEPTED, true);
  TOSStorage.set(K.TNC_VERSION, TOS_TNC_VERSION);
  TOSStorage.set(K.ACCEPTANCE_MODE, 'modal');
  TOSStorage.set('consent.acceptedAtISO', new Date().toISOString());
  TOSAnalytics.setConsent({ tncAccepted: true });
  TOSAnalytics.sendEvent(EVENTS.TERMS_AND_PRIVACY_ACCEPTED);
  if (_modalEl) {
    _modalEl.style.animation = 'tos-fade-in 0.2s ease reverse';
    setTimeout(() => {
      _modalEl && _modalEl.remove();
      _modalEl = null;
    }, 200);
  }
}

function _openUrl(url) {
  try { window.open(url, '_blank', 'noopener,noreferrer'); }
  catch (_) { try { location.href = url; } catch (__) {} }
}

// ── Settings → Legal extension ───────────────────────────────────────

/**
 * Append the Legal rows (Do Not Sell, Data Request, Delete My Data) to
 * an existing settings body element. The game calls this once when
 * building its settings UI.
 *
 * @param {HTMLElement} settingsBodyEl
 */
export function mountSettingsLegalRows(settingsBodyEl) {
  if (!settingsBodyEl) return;
  if (settingsBodyEl.querySelector('[data-tos-legal]')) return; // idempotent

  const container = document.createElement('div');
  container.dataset.tosLegal = '1';
  container.innerHTML = `
    <button class="settings-row link" id="tosRowDoNotSell" aria-pressed="false" type="button">
      <span class="row-label">Do Not Sell My Info</span>
      <span class="toggle" id="tosDoNotSellToggle" aria-hidden="true"></span>
    </button>
    <button class="settings-row link" id="tosRowDataRequest" type="button">
      <span class="row-label">Request My Data</span>
      <span class="row-arrow">&rsaquo;</span>
    </button>
    <button class="settings-row link" id="tosRowDeleteData" type="button">
      <span class="row-label">Delete My Data</span>
      <span class="row-arrow">&rsaquo;</span>
    </button>
  `;
  // Insert before the Version row if present, else at end
  const versionRow = settingsBodyEl.querySelector('#rowVersion')?.closest('.settings-row');
  if (versionRow) {
    while (container.firstChild) versionRow.parentNode.insertBefore(container.firstChild, versionRow);
  } else {
    while (container.firstChild) settingsBodyEl.appendChild(container.firstChild);
  }
  _wireSettingsLegal(settingsBodyEl);
}

function _wireSettingsLegal(scope) {
  const dnsRow    = scope.querySelector('#tosRowDoNotSell');
  const dnsToggle = scope.querySelector('#tosDoNotSellToggle');
  const reqRow    = scope.querySelector('#tosRowDataRequest');
  const delRow    = scope.querySelector('#tosRowDeleteData');

  const renderToggle = () => {
    const on = TOSStorage.getBool(K.DO_NOT_SELL, false);
    if (dnsToggle) dnsToggle.classList.toggle('on', on);
    if (dnsRow) dnsRow.setAttribute('aria-pressed', on ? 'true' : 'false');
  };
  renderToggle();

  // Fire DoNotSellShown once-per-sesh when settings panel renders this row
  TOSAnalytics.sendEventOncePerSesh(EVENTS.LEGAL_DO_NOT_SELL_SHOWN);

  if (dnsRow) {
    dnsRow.addEventListener('click', () => {
      const next = !TOSStorage.getBool(K.DO_NOT_SELL, false);
      TOSStorage.setBool(K.DO_NOT_SELL, next);
      TOSAnalytics.setConsent({ doNotSell: next });
      TOSAnalytics.sendEvent(next ? EVENTS.LEGAL_DO_NOT_SELL_ENABLED
                                  : EVENTS.LEGAL_DO_NOT_SELL_DISABLED);
      renderToggle();
    });
  }
  if (reqRow) reqRow.addEventListener('click', _onDataRequest);
  if (delRow) delRow.addEventListener('click', _onDeleteDataRequest);
}

function _onDataRequest() {
  TOSAnalytics.sendEvent(EVENTS.DATA_REQUEST);
  const tosId = TOSAnalytics.snapshot().tosId;
  const subject = encodeURIComponent('Data Access Request');
  const body = encodeURIComponent(
`Hello,

I would like to request a copy of the personal data you have associated with my install.

App: ${_appName}
TOS_ID: ${tosId}
Date: ${new Date().toISOString()}

Thank you.`);
  _openMailto(`mailto:${PRIVACY_CONTACT_EMAIL}?subject=${subject}&body=${body}`);
}

function _onDeleteDataRequest() {
  TOSAnalytics.sendEvent(EVENTS.DELETE_DATA_REQUEST);
  const tosId = TOSAnalytics.snapshot().tosId;
  const subject = encodeURIComponent('Data Deletion Request');
  const body = encodeURIComponent(
`Hello,

I would like to request the deletion of the personal data you have associated with my install.

App: ${_appName}
TOS_ID: ${tosId}
Date: ${new Date().toISOString()}

Thank you.`);
  _openMailto(`mailto:${PRIVACY_CONTACT_EMAIL}?subject=${subject}&body=${body}`);
}

function _openMailto(href) {
  try { location.href = href; }
  catch (_) { try { window.open(href); } catch (__) {} }
}

// ── Public hooks for game-side existing legal rows ───────────────────

export const TOSLegal = {
  init, mountSettingsLegalRows,

  // Fire-only hooks the game can call from its existing Privacy/Terms rows
  termsTapped() { TOSAnalytics.sendEvent(EVENTS.LEGAL_TERMS_TAPPED); },
  privacyTapped() { TOSAnalytics.sendEvent(EVENTS.LEGAL_PRIVACY_TAPPED); },
  termsClicked() { TOSAnalytics.sendEvent(EVENTS.TERMS_CLICKED); },
  privacyClicked() { TOSAnalytics.sendEvent(EVENTS.PRIVACY_CLICKED); },
  termsAndPrivacyShown() { TOSAnalytics.sendEvent(EVENTS.TERMS_AND_PRIVACY_SHOWN); },
  termsAndPrivacyAccepted() { _acceptConsent(); },
  doNotSellShown() { TOSAnalytics.sendEvent(EVENTS.LEGAL_DO_NOT_SELL_SHOWN); },
  doNotSellEnabled() { TOSAnalytics.sendEvent(EVENTS.LEGAL_DO_NOT_SELL_ENABLED); },
  doNotSellDisabled() { TOSAnalytics.sendEvent(EVENTS.LEGAL_DO_NOT_SELL_DISABLED); },
  dataRequest: _onDataRequest,
  deleteDataRequest: _onDeleteDataRequest,
};

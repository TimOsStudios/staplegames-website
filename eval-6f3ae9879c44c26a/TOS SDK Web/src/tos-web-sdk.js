/**
 * TOS SDK Web — Public entrypoint.
 *
 * Single ES module loaded by index.html. Exposes `window.TOSWeb` —
 * the only API surface the game code reaches.
 *
 * Architecture (see WEB_SDK_SPEC.md):
 *   - TOSAnalytics       — Firebase wrapper + sendEvent gates
 *   - TOSLifecycle       — sessions / daily-open / returned / usage / milestone fanout
 *   - TOSWebLifecycle    — paint funnel / errors / network / orientation
 *   - TOSLegal           — first-launch consent + Settings → Legal
 *   - TOSRate            — rate-prompt funnel (stub)
 *   - blockPuzzleUniques — per-game adapter
 *
 * `TOSWeb.init()` must be the **first** call from the game. Everything
 * else can be called freely; pre-init calls queue and drain on ready.
 */

import { TOSAnalytics } from './core/TOSAnalytics.js';
import { TOSLifecycle } from './core/TOSLifecycle.js';
import { TOSWebLifecycle } from './core/TOSWebLifecycle.js';
import { TOSLegal } from './core/TOSLegal.js';
import { TOSRate } from './core/TOSRate.js';
import { TOSStorage } from './core/TOSStorage.js';
import { TOS_WEB_SDK_VERSION } from './core/TOSConstants.js';
import { EVENTS } from './catalog/eventCatalog.js';

// Capture pageLoadStart timing as soon as the module evaluates,
// BEFORE any await. Earliest possible signal.
TOSWebLifecycle.markPageLoadStart();

const TOSWeb = {
  version: TOS_WEB_SDK_VERSION,
  events: EVENTS,

  /**
   * @param {{
   *   firebaseConfig: object,
   *   build: string,
   *   appName: string,
   *   uniques: object,
   *   devMode?: boolean,
   *   legal?: {
   *     privacyUrl?: string,
   *     termsUrl?: string,
   *     consentGate?: 'auto' | 'always' | 'never',
   *   },
   * }} opts
   * @returns {Promise<void>}
   */
  async init(opts) {
    if (!opts || !opts.firebaseConfig) {
      console.error('[TOSWeb] init() requires { firebaseConfig, build, appName, uniques }');
      return;
    }
    // Bind web lifecycle listeners as early as possible so the paint
    // observers can capture buffered entries even though FB isn't ready.
    TOSWebLifecycle.bind();

    await TOSAnalytics.init(opts);
    TOSLifecycle.start();

    TOSLegal.init({
      privacyUrl:  opts.legal && opts.legal.privacyUrl,
      termsUrl:    opts.legal && opts.legal.termsUrl,
      consentGate: opts.legal && opts.legal.consentGate,
      appName:     opts.appName,
    });

    if (opts.devMode) {
      try { console.log('[TOSWeb] ready', TOSAnalytics.snapshot()); } catch (_) {}
    }
  },

  // ── Game hooks (forwarded to the adapter) ──────────────────────────
  newGame(opts) {
    const uniques = window.__TOSUniques;
    uniques && uniques.newGameStarted && uniques.newGameStarted(opts);
  },
  gameStarted(opts) { this.newGame(opts); },  // alias matching the spec
  gameWon(opts) {
    const u = window.__TOSUniques; u && u.gameWon && u.gameWon(opts);
  },
  gameOverShown(opts) {
    const u = window.__TOSUniques; u && u.gameOverShown && u.gameOverShown(opts);
  },
  piecePlaced(opts) {
    const u = window.__TOSUniques; u && u.piecePlaced && u.piecePlaced(opts);
  },
  linesCleared(opts) {
    const u = window.__TOSUniques; u && u.linesCleared && u.linesCleared(opts);
  },
  combo(opts) {
    const u = window.__TOSUniques; u && u.combo && u.combo(opts);
  },
  scoreChanged(currentScore) {
    const u = window.__TOSUniques; u && u.scoreChanged && u.scoreChanged(currentScore);
  },
  settingChanged(name, enabled) {
    const u = window.__TOSUniques; u && u.settingChanged && u.settingChanged(name, enabled);
  },
  settingsViewDidLoad() {
    const u = window.__TOSUniques; u && u.settingsViewDidLoad && u.settingsViewDidLoad();
  },

  // ── Web lifecycle hook ─────────────────────────────────────────────
  gameRendered() { TOSWebLifecycle.gameRendered(); },

  // ── App-loaded state (called once on boot from index.html) ─────────
  appLoadedInWinningState() {
    TOSAnalytics.sendEvent(EVENTS.APP_LOADED_IN_WINNING);
  },
  appLoadedNotInWinningState() {
    TOSAnalytics.sendEvent(EVENTS.APP_LOADED_NOT_IN_WINNING);
  },

  // ── Storage diagnostic ─────────────────────────────────────────────
  trackStorageError(where, message) {
    TOSAnalytics.sendEvent(EVENTS.STORAGE_ERROR, {
      cWhere: String(where || '').slice(0, 100),
      cMessage: String(message || '').slice(0, 100),
    });
  },

  // ── Escape hatch ──────────────────────────────────────────────────
  trackCustom(name, params) {
    TOSAnalytics.sendEvent(name, params);
  },

  // ── Legal namespace (forwards to TOSLegal) ─────────────────────────
  legal: {
    /** Game must call this from its settings-builder so the DNS row +
     *  Data Request/Delete rows appear in the existing settings card. */
    mountSettingsLegalRows(settingsBodyEl) { TOSLegal.mountSettingsLegalRows(settingsBodyEl); },
    termsTapped() { TOSLegal.termsTapped(); },
    privacyTapped() { TOSLegal.privacyTapped(); },
    termsClicked() { TOSLegal.termsClicked(); },
    privacyClicked() { TOSLegal.privacyClicked(); },
    termsAndPrivacyShown() { TOSLegal.termsAndPrivacyShown(); },
    termsAndPrivacyAccepted() { TOSLegal.termsAndPrivacyAccepted(); },
    doNotSellShown() { TOSLegal.doNotSellShown(); },
    doNotSellEnabled() { TOSLegal.doNotSellEnabled(); },
    doNotSellDisabled() { TOSLegal.doNotSellDisabled(); },
    dataRequest() { TOSLegal.dataRequest(); },
    deleteDataRequest() { TOSLegal.deleteDataRequest(); },
  },

  // ── Rate namespace ─────────────────────────────────────────────────
  rate: TOSRate,

  // ── Read-only state snapshot ───────────────────────────────────────
  get state() { return TOSAnalytics.snapshot(); },
  isReady() { return TOSAnalytics.isReady(); },
  isFailed() { return TOSAnalytics.isFailed(); },

  /**
   * Internal: game adapter registration. The game does:
   *   import { blockPuzzleUniques } from './uniques/blockPuzzleUniques.js';
   *   TOSWeb._registerUniques(blockPuzzleUniques);
   * (Called by init() automatically if `uniques` is passed.)
   */
  _registerUniques(uniques) {
    window.__TOSUniques = uniques;
  },
};

// Hook _registerUniques so init() can pass the adapter
const originalInit = TOSWeb.init;
TOSWeb.init = async function(opts) {
  if (opts && opts.uniques) TOSWeb._registerUniques(opts.uniques);
  return originalInit.call(TOSWeb, opts);
};

window.TOSWeb = TOSWeb;
export { TOSWeb };
export default TOSWeb;

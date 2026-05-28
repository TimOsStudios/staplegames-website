/**
 * TOS SDK Web — Web Page Lifecycle.
 *
 * Page-load funnel that doesn't exist on iOS. Every event here fires
 * **once per session** so we don't spam Firebase. The user explicitly
 * asked for verbose web lifecycle telemetry: "I'm good sending a lot
 * of those so we can gather and understand that data."
 *
 * Events emitted (see EVENTS_MASTER.md §1.8):
 *   cWebPageLoadStart      — top of <script>, before init
 *   cWebDOMReady           — DOMContentLoaded
 *   cWebFirstPaint         — first-paint PerformancePaintTiming
 *   cWebFirstContentfulPaint
 *   cWebLargestContentfulPaint  — settled at first input or pagehide
 *   cWebFullyLoaded        — window 'load'
 *   cWebGameRendered       — manual hook from the game
 *   cWebFirstInteractive   — first pointerdown / keydown / click
 *   cWebVisibilityHidden   — first tab-hide
 *   cWebVisibilityVisible  — first tab-show-after-hide
 *   cWebOffline            — first offline
 *   cWebOnline             — first online (after offline)
 *   cWebOrientationChange  — first rotation
 *   cWebBootError          — error before cWebGameRendered (rate-cap 5)
 *   cWebRuntimeError       — error after cWebGameRendered (rate-cap 10)
 */

import { TOSAnalytics } from './TOSAnalytics.js';
import { EVENTS } from '../catalog/eventCatalog.js';
import { PARAMS } from '../catalog/paramCatalog.js';
import { MAX_BOOT_ERRORS_PER_SESH, MAX_RUNTIME_ERRORS_PER_SESH } from './TOSConstants.js';

let _pageLoadStartMs = 0;
let _gameRendered = false;
let _firstInteractive = false;
let _hiddenOnceFired = false;
let _visibleOnceFired = false;
let _offlineOnceFired = false;
let _onlineOnceFired = false;
let _orientationOnceFired = false;
let _bootErrors = 0;
let _runtimeErrors = 0;
let _clsValue = 0;

// ── Public entrypoints ───────────────────────────────────────────────

/** Called by tos-web-sdk.js as the very first SDK action. */
export function markPageLoadStart() {
  _pageLoadStartMs = performance.now();
  TOSAnalytics.sendEventOncePerSesh(EVENTS.WEB_PAGE_LOAD_START);
}

/** Wire all the listeners that fire web-lifecycle events. */
export function bind() {
  _bindDOMReady();
  _bindLoadComplete();
  _bindPaintObservers();
  _bindLCPObserver();
  _bindCLSObserver();
  _bindFirstInteractive();
  _bindVisibility();
  _bindNetwork();
  _bindOrientation();
  _bindErrors();
  _bindPageHide();
}

/** Game calls this after the first paint of the board. */
export function gameRendered() {
  if (_gameRendered) return;
  _gameRendered = true;
  TOSAnalytics.sendEventOncePerSesh(EVENTS.WEB_GAME_RENDERED, {
    [PARAMS.WEB_RENDER_MS]: Math.round(performance.now() - _pageLoadStartMs),
  });
}

// ── DOM / load events ────────────────────────────────────────────────

function _bindDOMReady() {
  if (document.readyState !== 'loading') {
    _fireDOMReady();
    return;
  }
  document.addEventListener('DOMContentLoaded', _fireDOMReady, { once: true });
}
function _fireDOMReady() {
  TOSAnalytics.sendEventOncePerSesh(EVENTS.WEB_DOM_READY, {
    [PARAMS.WEB_PAINT_MS]: Math.round(performance.now() - _pageLoadStartMs),
  });
}

function _bindLoadComplete() {
  if (document.readyState === 'complete') {
    _fireFullyLoaded();
    return;
  }
  window.addEventListener('load', _fireFullyLoaded, { once: true });
}
function _fireFullyLoaded() {
  let loadMs = Math.round(performance.now() - _pageLoadStartMs);
  try {
    const t = performance.timing;
    if (t && t.loadEventEnd && t.navigationStart) {
      loadMs = t.loadEventEnd - t.navigationStart;
    }
  } catch (_) {}
  TOSAnalytics.sendEventOncePerSesh(EVENTS.WEB_FULLY_LOADED, {
    [PARAMS.WEB_LOAD_MS]: loadMs,
  });
}

// ── Paint observers ──────────────────────────────────────────────────

function _bindPaintObservers() {
  if (typeof PerformanceObserver !== 'function') return;
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-paint') {
          TOSAnalytics.sendEventOncePerSesh(EVENTS.WEB_FIRST_PAINT, {
            [PARAMS.WEB_PAINT_MS]: Math.round(entry.startTime),
          });
        } else if (entry.name === 'first-contentful-paint') {
          TOSAnalytics.sendEventOncePerSesh(EVENTS.WEB_FCP, {
            [PARAMS.WEB_FCP_MS]: Math.round(entry.startTime),
          });
        }
      }
    });
    po.observe({ type: 'paint', buffered: true });
  } catch (_) {}
}

function _bindLCPObserver() {
  if (typeof PerformanceObserver !== 'function') return;
  try {
    let lastLCP = 0;
    const lcpObs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) lastLCP = e.startTime;
    });
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
    const settle = () => {
      try { lcpObs.takeRecords(); } catch (_) {}
      if (lastLCP > 0) {
        TOSAnalytics.sendEventOncePerSesh(EVENTS.WEB_LCP, {
          [PARAMS.WEB_LCP_MS]: Math.round(lastLCP),
        });
      }
      try { lcpObs.disconnect(); } catch (_) {}
    };
    addEventListener('pointerdown', settle, { once: true, capture: true });
    addEventListener('keydown', settle, { once: true, capture: true });
    addEventListener('pagehide', settle, { once: true });
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') settle();
    }, { once: true });
  } catch (_) {}
}

function _bindCLSObserver() {
  if (typeof PerformanceObserver !== 'function') return;
  try {
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) _clsValue += e.value;
      }
    });
    obs.observe({ type: 'layout-shift', buffered: true });
  } catch (_) {}
}

// ── First-interactive ────────────────────────────────────────────────

function _bindFirstInteractive() {
  const handler = () => {
    if (_firstInteractive) return;
    _firstInteractive = true;
    TOSAnalytics.sendEventOncePerSesh(EVENTS.WEB_FIRST_INTERACTIVE, {
      [PARAMS.WEB_INTERACTIVE_MS]: Math.round(performance.now() - _pageLoadStartMs),
    });
    removeEventListener('pointerdown', handler, true);
    removeEventListener('keydown', handler, true);
    removeEventListener('click', handler, true);
  };
  addEventListener('pointerdown', handler, { capture: true, once: false });
  addEventListener('keydown', handler, { capture: true, once: false });
  addEventListener('click', handler, { capture: true, once: false });
}

// ── Visibility ───────────────────────────────────────────────────────

function _bindVisibility() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && !_hiddenOnceFired) {
      _hiddenOnceFired = true;
      TOSAnalytics.sendEventOncePerSesh(EVENTS.WEB_VISIBILITY_HIDDEN);
    } else if (document.visibilityState === 'visible' && _hiddenOnceFired && !_visibleOnceFired) {
      _visibleOnceFired = true;
      TOSAnalytics.sendEventOncePerSesh(EVENTS.WEB_VISIBILITY_VISIBLE);
    }
  });
}

// ── Network ──────────────────────────────────────────────────────────

function _bindNetwork() {
  addEventListener('offline', () => {
    if (_offlineOnceFired) return;
    _offlineOnceFired = true;
    TOSAnalytics.sendEventOncePerSesh(EVENTS.WEB_OFFLINE);
  });
  addEventListener('online', () => {
    if (!_offlineOnceFired || _onlineOnceFired) return;
    _onlineOnceFired = true;
    TOSAnalytics.sendEventOncePerSesh(EVENTS.WEB_ONLINE);
  });
}

// ── Orientation ──────────────────────────────────────────────────────

function _bindOrientation() {
  const fire = () => {
    const o = (window.innerWidth < window.innerHeight) ? 'portrait' : 'landscape';
    TOSAnalytics.setOrientation(o);
    if (_orientationOnceFired) return;
    _orientationOnceFired = true;
    TOSAnalytics.sendEventOncePerSesh(EVENTS.WEB_ORIENTATION_CHANGE, {
      [PARAMS.WEB_ORIENTATION]: o,
    });
  };
  addEventListener('orientationchange', fire);
  if (typeof screen !== 'undefined' && screen.orientation && screen.orientation.addEventListener) {
    try { screen.orientation.addEventListener('change', fire); } catch (_) {}
  }
}

// ── Errors (Crashlytics-lite) ────────────────────────────────────────

function _bindErrors() {
  addEventListener('error', (e) => {
    _trackError(e.message, (e.filename || '') + ':' + (e.lineno || ''));
  });
  addEventListener('unhandledrejection', (e) => {
    let msg = 'unhandledrejection';
    try { msg = String(e.reason && e.reason.message || e.reason || msg); } catch (_) {}
    _trackError(msg, 'promise');
  });
}

function _trackError(message, where) {
  if (_gameRendered) {
    if (_runtimeErrors >= MAX_RUNTIME_ERRORS_PER_SESH) return;
    _runtimeErrors++;
    TOSAnalytics.sendEvent(EVENTS.WEB_RUNTIME_ERROR, {
      [PARAMS.MESSAGE]: String(message || '').slice(0, 100),
      [PARAMS.WHERE]:   String(where || '').slice(0, 100),
    });
  } else {
    if (_bootErrors >= MAX_BOOT_ERRORS_PER_SESH) return;
    _bootErrors++;
    TOSAnalytics.sendEvent(EVENTS.WEB_BOOT_ERROR, {
      [PARAMS.MESSAGE]: String(message || '').slice(0, 100),
      [PARAMS.WHERE]:   String(where || '').slice(0, 100),
    });
  }
}

function _bindPageHide() {
  addEventListener('pagehide', () => {
    if (_clsValue > 0) {
      TOSAnalytics.sendEvent('cWebSessionCLS', {
        [PARAMS.WEB_CLS_SCORE]: Math.round(_clsValue * 1000) / 1000,
      });
    }
  });
}

export const TOSWebLifecycle = {
  markPageLoadStart, bind, gameRendered,
};

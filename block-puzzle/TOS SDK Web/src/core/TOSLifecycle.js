/**
 * TOS SDK Web — TOSLifecycle.
 *
 * Direct port of TOSLifecycle.m on iOS. Replaces:
 *   applicationDidFinishLaunching → init() (called by sdk entrypoint)
 *   applicationDidBecomeActive    → visibilitychange "visible"
 *   applicationDidEnterBackground → visibilitychange "hidden"
 *
 * Owns the session bank ticker, the daily-open + returned-X funnels,
 * the usage-second milestone fan-out, and the LT-days-active milestones.
 *
 * Also owns the gameWon / gameStarted milestone fan-out (delegated
 * here rather than living in the adapter so other games inherit it).
 */

import { TOSAnalytics } from './TOSAnalytics.js';
import { TOSStorage } from './TOSStorage.js';
import { EVENTS } from '../catalog/eventCatalog.js';
import { PARAMS } from '../catalog/paramCatalog.js';
import {
  GAME_WON_MILESTONES, GAME_STARTED_MILESTONES, SCORE_THRESHOLDS,
  LT_DAYS_ACTIVE_TIERS, RETURNED_HOUR_THRESHOLDS, USAGE_SECOND_TIERS,
  USAGE_INTERVAL_PERIOD_SEC,
} from '../catalog/milestoneSchedule.js';
import { MIN_MINUTES_BETWEEN_SESSIONS } from './TOSConstants.js';
import { localDayKey, utcDayKey, secondsBetween } from './TOSCalendar.js';

let _bootTimeMs = 0;
let _lastActiveMs = 0;        // wall-clock of last "active" tick
let _bankerInterval = null;
let _usageInterval10mLastFire = 0;
let _usageTiersFiredThisSesh = new Set();
const ACTIVE_TICK_MS = 1000;

// ── Boot ─────────────────────────────────────────────────────────────

/**
 * Called from `tos-web-sdk.js` once after TOSAnalytics.init() resolves.
 * Fires cColdLaunch / cFirstOpen / cAppUpdated and starts session.
 */
export function start() {
  _bootTimeMs = Date.now();
  _lastActiveMs = _bootTimeMs;

  if (TOSAnalytics.STATE.isFirstLaunch) {
    TOSAnalytics.sendEventOnce(EVENTS.FIRST_OPEN);
  }
  if (TOSAnalytics.STATE.isAppUpdated) {
    TOSAnalytics.sendEventOnce(EVENTS.APP_UPDATED);
    _usageTiersFiredThisSesh.clear();
  }

  // cColdLaunch is sendEventOncePerVC on iOS — fire once per build code.
  TOSAnalytics.sendEventOncePerVC(EVENTS.COLD_LAUNCH);

  startNewSessionIfAppropriate();
  _bindVisibility();
  _bindBanker();
}

// ── Session boundary ─────────────────────────────────────────────────

export function startNewSessionIfAppropriate() {
  const now = new Date();
  const last = TOSAnalytics.getLatestResignActive();
  if (last) {
    const sinceMs = now.getTime() - last.getTime();
    if (sinceMs < MIN_MINUTES_BETWEEN_SESSIONS * 60 * 1000) {
      return; // same session
    }
  }

  // New session boundary crossed
  TOSAnalytics.commitSessionBank();
  TOSAnalytics.bumpSessionCount();
  TOSAnalytics.recordDailyActiveMaybe();

  _usageTiersFiredThisSesh.clear();
  _usageInterval10mLastFire = 0;

  // Fire daily-opens
  _fireDailyOpens();

  // Fire LT-days-active milestones
  for (const n of LT_DAYS_ACTIVE_TIERS) {
    if (TOSAnalytics.STATE.cDaysActiveUTC === n) {
      TOSAnalytics.sendEventOnce(`cLTDaysActive${n}`);
    }
  }

  // Fire Returned-X (vs previousSeshStartDate)
  const prev = TOSAnalytics.getPreviousSeshStartDate();
  if (prev) {
    const hoursSincePrev = (now - prev) / (1000 * 60 * 60);
    for (const t of RETURNED_HOUR_THRESHOLDS) {
      if (hoursSincePrev > t) TOSAnalytics.sendEventOnce(`cReturned${t}`);
    }
  }
  TOSAnalytics.setPreviousSeshStartDate(now);

  // Fire Open-window-since-install (only on sessions 2+)
  if (TOSAnalytics.STATE.cLTSeshCount > 1) {
    _fireOpenWindows();
  }

  // Always fire cSessionStart + cUsage0Seconds at top of session
  TOSAnalytics.sendEvent(EVENTS.SESSION_START);
  if (!_usageTiersFiredThisSesh.has(0)) {
    TOSAnalytics.sendEvent(EVENTS.USAGE_0_SECONDS);
    _usageTiersFiredThisSesh.add(0);
  }
  // FOV once-per-build usage 0
  TOSAnalytics.sendEventOncePerVC(EVENTS.FOV_USAGE_0_SECONDS);

  // After session count bumps, clearColdLaunchSesh on subsequent sessions
  // (the first session of this page-load is still cold-launch=1; the
  //  next session boundary makes it 0).
}

function _fireDailyOpens() {
  const today = localDayKey();
  const todayUTC = utcDayKey();
  const lastLocal = TOSStorage.get('lastSeshLocalDay') || '';
  const lastUtc   = TOSStorage.get('lastSeshUtcDay') || '';

  if (lastLocal !== today) {
    TOSAnalytics.sendEvent(EVENTS.DAILY_OPEN);
    // "TodayAndYest" fires if last opened day is exactly yesterday
    if (lastLocal && _isExactlyYesterday(lastLocal, today)) {
      TOSAnalytics.sendEvent(EVENTS.DAILY_OPEN_TODAY_AND_YEST);
    }
    TOSStorage.set('lastSeshLocalDay', today);
  }
  if (lastUtc !== todayUTC) {
    TOSAnalytics.sendEvent(EVENTS.DAILY_OPEN_UTC);
    if (lastUtc && _isExactlyYesterday(lastUtc, todayUTC)) {
      TOSAnalytics.sendEvent(EVENTS.DAILY_OPEN_TODAY_AND_YEST_UTC);
    }
    TOSStorage.set('lastSeshUtcDay', todayUTC);
  }
}

function _isExactlyYesterday(prevYMD, todayYMD) {
  const [py, pm, pd] = prevYMD.split('-').map(Number);
  const [ty, tm, td] = todayYMD.split('-').map(Number);
  const prev = Date.UTC(py, pm - 1, pd);
  const today = Date.UTC(ty, tm - 1, td);
  return (today - prev) === 86_400_000;
}

function _fireOpenWindows() {
  const sec = TOSAnalytics.secSinceInstall();
  const HOUR = 3600;
  if (sec < 24 * HOUR) TOSAnalytics.sendEventOnce(EVENTS.OPEN_WITHIN_24);
  if (sec >= 24 * HOUR) TOSAnalytics.sendEventOnce(EVENTS.OPEN_AFTER_24);
  if (sec >= 24 * HOUR && sec < 48 * HOUR)  TOSAnalytics.sendEventOnce(EVENTS.OPEN_BETWEEN_24_AND_48);
  if (sec >= 24 * HOUR && sec < 168 * HOUR) TOSAnalytics.sendEventOnce(EVENTS.OPEN_BETWEEN_24_AND_168);
  if (sec >= 144 * HOUR && sec < 168 * HOUR) TOSAnalytics.sendEventOnce(EVENTS.OPEN_BETWEEN_144_AND_168);
  if (sec >= 168 * HOUR) {
    TOSAnalytics.sendEventOnce(EVENTS.OPEN_AFTER_168);
    // cOpen2ndAfter168: second time we see an open >= 168h
    const flag = TOSStorage.getInt('open2ndAfter168Hits', 0);
    if (flag === 1) {
      TOSAnalytics.sendEventOnce(EVENTS.OPEN_2ND_AFTER_168);
      TOSStorage.set('open2ndAfter168Hits', '2');
    } else if (flag === 0) {
      TOSStorage.set('open2ndAfter168Hits', '1');
    }
  }
}

// ── Visibility / banker ──────────────────────────────────────────────

function _bindVisibility() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      _onResignActive();
    } else if (document.visibilityState === 'visible') {
      _onBecomeActive();
    }
  });
  window.addEventListener('pagehide', _onResignActive);
  window.addEventListener('pageshow', _onBecomeActive);
}

function _onResignActive() {
  _tickActiveSeconds();
  const now = new Date();
  TOSAnalytics.setLatestResignActive(now);
  TOSAnalytics.setPreviousSeshEndDate(now);
  TOSAnalytics.commitSessionBank();
}

function _onBecomeActive() {
  _lastActiveMs = Date.now();
  startNewSessionIfAppropriate();
  TOSAnalytics.clearColdLaunchSesh();
}

function _bindBanker() {
  if (_bankerInterval) clearInterval(_bankerInterval);
  _bankerInterval = setInterval(_tickActiveSeconds, ACTIVE_TICK_MS);
}

function _tickActiveSeconds() {
  if (document.visibilityState !== 'visible') return;
  const now = Date.now();
  const delta = (now - _lastActiveMs) / 1000;
  _lastActiveMs = now;
  if (delta <= 0 || delta > 60) return; // ignore wall-clock jumps > 60s
  TOSAnalytics.bankActiveSeconds(delta);
  _checkUsageMilestones();
}

function _checkUsageMilestones() {
  const seshSec = TOSAnalytics.cCurrentSeshTime();
  for (const tier of USAGE_SECOND_TIERS) {
    if (tier === 0) continue;
    if (_usageTiersFiredThisSesh.has(tier)) continue;
    if (seshSec >= tier) {
      TOSAnalytics.sendEvent(`cUsage${tier}Seconds`);
      _usageTiersFiredThisSesh.add(tier);
    }
  }
  // 10-minute repeating bucket
  const bucket = Math.floor(seshSec / USAGE_INTERVAL_PERIOD_SEC);
  if (bucket > _usageInterval10mLastFire) {
    _usageInterval10mLastFire = bucket;
    TOSAnalytics.sendEvent(EVENTS.USAGE_INTERVAL_10M, {
      cBucketIndex: bucket,
    });
  }
}

// ── Milestone fan-out ────────────────────────────────────────────────

/**
 * Called from blockPuzzleUniques.gameWon() after the LT counter has
 * been incremented. Fires:
 *   - cGameWon (every)
 *   - cGameWonBetween24And48 (if applicable)
 *   - all cGameWon{N} milestones whose count matches
 */
export function fanOutGameWon(ltGamesWon, secSinceInstall) {
  const sec = secSinceInstall;
  const HOUR = 3600;
  // Between 24-48h
  if (sec >= 24 * HOUR && sec < 48 * HOUR) {
    TOSAnalytics.sendEvent(EVENTS.GAME_WON_BETWEEN_24_48);
  }
  for (const entry of GAME_WON_MILESTONES) {
    if (entry.gate.count !== ltGamesWon) continue;
    if (entry.gate.maxSecSinceInstall !== undefined && sec > entry.gate.maxSecSinceInstall) continue;
    if (entry.gate.minSecSinceInstall !== undefined && sec < entry.gate.minSecSinceInstall) continue;
    TOSAnalytics.sendEventOnce(entry.name);
  }
}

/**
 * Called from blockPuzzleUniques.newGameStarted() after the LT counter
 * has been incremented.
 */
export function fanOutGameStarted(ltGamesStarted, secSinceInstall) {
  const sec = secSinceInstall;
  const HOUR = 3600;
  if (sec >= 24 * HOUR && sec < 48 * HOUR) {
    TOSAnalytics.sendEvent(EVENTS.GAME_STARTED_BETWEEN_24_48);
  }
  for (const entry of GAME_STARTED_MILESTONES) {
    if (entry.gate.count !== ltGamesStarted) continue;
    if (entry.gate.maxSecSinceInstall !== undefined && sec > entry.gate.maxSecSinceInstall) continue;
    if (entry.gate.minSecSinceInstall !== undefined && sec < entry.gate.minSecSinceInstall) continue;
    TOSAnalytics.sendEventOnce(entry.name);
  }
}

/** Called by the game on every score change. Fires cScoreOver*First. */
export function fanOutScoreThresholds(currentScore) {
  for (const { name, threshold } of SCORE_THRESHOLDS) {
    if (currentScore > threshold) {
      TOSAnalytics.sendEventOnce(name);
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────

export const TOSLifecycle = {
  start, startNewSessionIfAppropriate,
  fanOutGameWon, fanOutGameStarted, fanOutScoreThresholds,
};

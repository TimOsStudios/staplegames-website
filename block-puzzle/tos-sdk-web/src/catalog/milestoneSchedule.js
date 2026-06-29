/**
 * TOS SDK Web — Milestone fan-out tables.
 *
 * Direct port of TOSUniques.m gameWon / newGameStarted methods +
 * ViewController.m score-threshold block. The shape is a flat list of
 * { eventName, gate } entries; the SDK iterates and fires
 * sendEventOnce(name) when gate matches. This keeps the milestone
 * data declarative and easy to add to (single-line addition to
 * extend cGameWon100000 etc.).
 *
 * `gate.count` — match against the game's lifetime cLTGames(Won|Started)
 * `gate.maxSecSinceInstall` — only fire if (now - installDate) < this
 *                             (seconds). undefined = no cap.
 * `gate.minSecSinceInstall` — only fire if (now - installDate) > this.
 *                             undefined = no floor.
 *
 * Schedules are emitted in the order the iOS code emits them.
 */

const MIN = 60;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * cGameWon{N} fan-out, ported from TOSUniques.m:627-728.
 * Includes the Within1/5/10 Minute, Within1/24/168 Hour sub-events.
 */
export const GAME_WON_MILESTONES = Object.freeze([
  // count=1
  { name: 'cGameWon1',                gate: { count: 1 } },
  { name: 'cGameWon1Within1Minute',   gate: { count: 1, maxSecSinceInstall: 1*MIN } },
  { name: 'cGameWon1Within5Minute',   gate: { count: 1, maxSecSinceInstall: 5*MIN } },
  { name: 'cGameWon1Within10Minute',  gate: { count: 1, maxSecSinceInstall: 10*MIN } },
  { name: 'cGameWon1Within1Hour',     gate: { count: 1, maxSecSinceInstall: 1*HOUR } },
  { name: 'cGameWon1Within24Hour',    gate: { count: 1, maxSecSinceInstall: 24*HOUR } },
  { name: 'cGameWon1Within168Hour',   gate: { count: 1, maxSecSinceInstall: 168*HOUR } },
  // count=3
  { name: 'cGameWon3',                gate: { count: 3 } },
  { name: 'cGameWon3Within1Hour',     gate: { count: 3, maxSecSinceInstall: 1*HOUR } },
  { name: 'cGameWon3Within24Hour',    gate: { count: 3, maxSecSinceInstall: 24*HOUR } },
  { name: 'cGameWon3Within168Hour',   gate: { count: 3, maxSecSinceInstall: 168*HOUR } },
  // count=5
  { name: 'cGameWon5',                gate: { count: 5 } },
  { name: 'cGameWon5Within1Hour',     gate: { count: 5, maxSecSinceInstall: 1*HOUR } },
  { name: 'cGameWon5Within24Hour',    gate: { count: 5, maxSecSinceInstall: 24*HOUR } },
  { name: 'cGameWon5Within168Hour',   gate: { count: 5, maxSecSinceInstall: 168*HOUR } },
  // count=10
  { name: 'cGameWon10',               gate: { count: 10 } },
  { name: 'cGameWon10Within1Hour',    gate: { count: 10, maxSecSinceInstall: 1*HOUR } },
  { name: 'cGameWon10Within24Hour',   gate: { count: 10, maxSecSinceInstall: 24*HOUR } },
  { name: 'cGameWon10Within168Hour',  gate: { count: 10, maxSecSinceInstall: 168*HOUR } },
  // count=25
  { name: 'cGameWon25',               gate: { count: 25 } },
  // count=50
  { name: 'cGameWon50',               gate: { count: 50 } },
  { name: 'cGameWon50Within24Hour',   gate: { count: 50, maxSecSinceInstall: 24*HOUR } },
  { name: 'cGameWon50Within168Hour',  gate: { count: 50, maxSecSinceInstall: 168*HOUR } },
  // count=100
  { name: 'cGameWon100',              gate: { count: 100 } },
  { name: 'cGameWon100Within168Hour', gate: { count: 100, maxSecSinceInstall: 168*HOUR } },
  // count=500
  { name: 'cGameWon500',              gate: { count: 500 } },
  { name: 'cGameWon500Within168Hour', gate: { count: 500, maxSecSinceInstall: 168*HOUR } },
  // tail
  { name: 'cGameWon1000',             gate: { count: 1000 } },
  { name: 'cGameWon2000',             gate: { count: 2000 } },
  { name: 'cGameWon5000',             gate: { count: 5000 } },
  { name: 'cGameWon10000',            gate: { count: 10000 } },
  { name: 'cGameWon20000',            gate: { count: 20000 } },
  { name: 'cGameWon50000',            gate: { count: 50000 } },
]);

/**
 * cGameStarted{N} fan-out, ported from TOSUniques.m:749-824.
 */
export const GAME_STARTED_MILESTONES = Object.freeze([
  { name: 'cGameStarted1',                gate: { count: 1 } },
  { name: 'cGameStarted1Within1Minute',   gate: { count: 1, maxSecSinceInstall: 1*MIN } },
  { name: 'cGameStarted1Within5Minute',   gate: { count: 1, maxSecSinceInstall: 5*MIN } },
  { name: 'cGameStarted1Within10Minute',  gate: { count: 1, maxSecSinceInstall: 10*MIN } },
  { name: 'cGameStarted1Within1Hour',     gate: { count: 1, maxSecSinceInstall: 1*HOUR } },
  { name: 'cGameStarted1Within24Hour',    gate: { count: 1, maxSecSinceInstall: 24*HOUR } },
  { name: 'cGameStarted1Within168Hour',   gate: { count: 1, maxSecSinceInstall: 168*HOUR } },
  { name: 'cGameStarted5',                gate: { count: 5 } },
  { name: 'cGameStarted5Within1Hour',     gate: { count: 5, maxSecSinceInstall: 1*HOUR } },
  { name: 'cGameStarted5Within24Hour',    gate: { count: 5, maxSecSinceInstall: 24*HOUR } },
  { name: 'cGameStarted5Within168Hour',   gate: { count: 5, maxSecSinceInstall: 168*HOUR } },
  { name: 'cGameStarted10',               gate: { count: 10 } },
  { name: 'cGameStarted10Within1Hour',    gate: { count: 10, maxSecSinceInstall: 1*HOUR } },
  { name: 'cGameStarted10Within24Hour',   gate: { count: 10, maxSecSinceInstall: 24*HOUR } },
  { name: 'cGameStarted10Within168Hour',  gate: { count: 10, maxSecSinceInstall: 168*HOUR } },
  { name: 'cGameStarted25',               gate: { count: 25 } },
  { name: 'cGameStarted50',               gate: { count: 50 } },
  { name: 'cGameStarted100',              gate: { count: 100 } },
  { name: 'cGameStarted500',              gate: { count: 500 } },
  { name: 'cGameStarted1000',             gate: { count: 1000 } },
  { name: 'cGameStarted2000',             gate: { count: 2000 } },
  { name: 'cGameStarted5000',             gate: { count: 5000 } },
  { name: 'cGameStarted10000',            gate: { count: 10000 } },
  { name: 'cGameStarted20000',            gate: { count: 20000 } },
  { name: 'cGameStarted50000',            gate: { count: 50000 } },
]);

/**
 * cScoreOver{N}First — fan-out triggered every time the current game's
 * score crosses a threshold for the first time on this install.
 * Ported from blocksClassic/ViewController.m:5371-5406.
 */
export const SCORE_THRESHOLDS = Object.freeze([
  { name: 'cScoreOver1First',     threshold: 1 },
  { name: 'cScoreOver10First',    threshold: 10 },
  { name: 'cScoreOver65First',    threshold: 65 },
  { name: 'cScoreOver100First',   threshold: 100 },
  { name: 'cScoreOver200First',   threshold: 200 },
  { name: 'cScoreOver500First',   threshold: 500 },
  { name: 'cScoreOver1000First',  threshold: 1000 },
  { name: 'cScoreOver2000First',  threshold: 2000 },
  { name: 'cScoreOver5000First',  threshold: 5000 },
  { name: 'cScoreOver10000First', threshold: 10000 },
  { name: 'cScoreOver15000First', threshold: 15000 },
  { name: 'cScoreOver20000First', threshold: 20000 },
]);

/**
 * LT-days-active milestone tiers (from TOSLifecycle.m and TOSAnalytics).
 * These are gated on cDaysActiveUTC.
 */
export const LT_DAYS_ACTIVE_TIERS = Object.freeze([
  1, 2, 3, 5, 7, 14, 30, 60, 75, 90, 120, 180, 365, 730,
]);

/**
 * Returned-X hour thresholds (from TOSLifecycle.m).
 */
export const RETURNED_HOUR_THRESHOLDS = Object.freeze([
  24, 48, 72, 168, 336, 720,
]);

/**
 * Usage-second milestones (from TOSLifecycle.m secondActiveOnAppOpen* logic).
 * Each value fires `cUsage{N}Seconds` once when seshSecondsActiveBank
 * first exceeds it during a session.
 */
export const USAGE_SECOND_TIERS = Object.freeze([
  0, 10, 20, 30, 60, 120, 300, 600, 1800, 3600, 36000,
]);

/**
 * 10-minute repeating bucket — fires `cUsageInterval10m` every 600 sec
 * of session time (every-cardinality, not once).
 */
export const USAGE_INTERVAL_PERIOD_SEC = 600;

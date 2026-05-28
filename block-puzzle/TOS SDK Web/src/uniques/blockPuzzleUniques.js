/**
 * TOS SDK Web — Block Puzzle game adapter.
 *
 * Web port of TOSUniques.{h,m} from blocks-classic SG-iOS, scoped to the
 * Block Puzzle web game.
 *
 * Owns:
 *   - LT counters (cLTGamesWon, cLTGamesStarted, cLTBestScore)
 *   - Sesh counters (cSeshGamesWon, cSeshGamesStarted)
 *   - cDaysActiveWins(/UTC) counters
 *   - currentGame snapshot params (cCurrentScore, cGameTime, ...)
 *   - The `uniqueAnalyticsEventParams()` method merged into every event
 *
 * Hooks called by index.html:
 *   blockPuzzleUniques.newGameStarted({ puzzleDifficulty })
 *   blockPuzzleUniques.scoreChanged(currentScore)
 *   blockPuzzleUniques.piecePlaced({ pieceType?, boardFillPct? })
 *   blockPuzzleUniques.linesCleared({ count, scoreDelta? })
 *   blockPuzzleUniques.combo({ size })
 *   blockPuzzleUniques.gameWon({ score, moves?, gameTimeSec?, blocksRemoved? })
 *   blockPuzzleUniques.gameOverShown({ score, moves?, gameTimeSec? })
 *   blockPuzzleUniques.settingChanged(name, enabled)
 */

import { TOSAnalytics } from '../core/TOSAnalytics.js';
import { TOSLifecycle } from '../core/TOSLifecycle.js';
import { TOSStorage } from '../core/TOSStorage.js';
import { EVENTS } from '../catalog/eventCatalog.js';
import { PARAMS } from '../catalog/paramCatalog.js';
import { localDayKey, utcDayKey } from '../core/TOSCalendar.js';

const K = {
  LT_GAMES_STARTED:    'game.cLTGamesStarted',
  LT_GAMES_WON:        'game.cLTGamesWon',
  LT_BEST_SCORE:       'game.cLTBestScore',
  DAYS_ACTIVE_WINS:    'game.cDaysActiveWins',
  DAYS_ACTIVE_WINS_UTC:'game.cDaysActiveWinsUTC',
  LAST_WIN_LOCAL_DAY:  'game.latestWinLocalDay',
  LAST_WIN_UTC_DAY:    'game.latestWinUtcDay',
};

const STATE = {
  // LT counters
  cLTGamesStarted: 0,
  cLTGamesWon: 0,
  cLTBestScore: 0,
  cDaysActiveWins: 0,
  cDaysActiveWinsUTC: 0,

  // Session counters
  cSeshGamesStarted: 0,
  cSeshGamesWon: 0,

  // Current-game snapshot (reset on newGameStarted)
  cPuzzleDifficulty: 1,   // 1 = easy, 2 = hard
  cCurrentScore: 0,
  cGameTime: 0,
  cWinFlag: 0,
  cCurrentMoves: 0,
  cCurrentBlocksRemoved: 0,
  cCurrentCellPiecesGenerated: 0,
  gameStartMs: 0,

  // Settings
  cAppMusicOn: 'no',  // game has no music yet → default no
  cAppSoundOn: 'yes',
};

// ── Hydration (called from TOSAnalytics.init via the adapter contract) ─

export function hydrate(store) {
  STATE.cLTGamesStarted   = store.getInt(K.LT_GAMES_STARTED, 0);
  STATE.cLTGamesWon       = store.getInt(K.LT_GAMES_WON, 0);
  STATE.cLTBestScore      = store.getInt(K.LT_BEST_SCORE, 0);
  STATE.cDaysActiveWins    = store.getInt(K.DAYS_ACTIVE_WINS, 0);
  STATE.cDaysActiveWinsUTC = store.getInt(K.DAYS_ACTIVE_WINS_UTC, 0);
}

// ── Adapter contract ─────────────────────────────────────────────────

export function uniqueAnalyticsEventParams() {
  return {
    [PARAMS.LT_GAMES_WON]:           STATE.cLTGamesWon,
    [PARAMS.LT_GAMES_STARTED]:       STATE.cLTGamesStarted,
    [PARAMS.LT_BEST_SCORE]:          STATE.cLTBestScore,
    [PARAMS.SESH_GAMES_WON]:         STATE.cSeshGamesWon,
    [PARAMS.SESH_GAMES_STARTED]:     STATE.cSeshGamesStarted,
    [PARAMS.DAYS_ACTIVE_WINS]:       STATE.cDaysActiveWins,
    [PARAMS.DAYS_ACTIVE_WINS_UTC]:   STATE.cDaysActiveWinsUTC,
    [PARAMS.PUZZLE_DIFFICULTY]:      STATE.cPuzzleDifficulty,
    [PARAMS.CURRENT_SCORE]:          STATE.cCurrentScore,
    [PARAMS.GAME_TIME]:              STATE.cGameTime,
    [PARAMS.WIN_FLAG]:               STATE.cWinFlag,
    [PARAMS.CURRENT_MOVES]:          STATE.cCurrentMoves,
    [PARAMS.CURRENT_BLOCKS_REMOVED]: STATE.cCurrentBlocksRemoved,
    [PARAMS.CURRENT_CELL_PIECES_GENERATED]: STATE.cCurrentCellPiecesGenerated,
    [PARAMS.APP_MUSIC_ON]:           STATE.cAppMusicOn,
    [PARAMS.APP_SOUND_ON]:           STATE.cAppSoundOn,
  };
}

export function onSessionStart() {
  STATE.cSeshGamesStarted = 0;
  STATE.cSeshGamesWon = 0;
}

export function getLTGamesWon() { return STATE.cLTGamesWon; }

// ── Game hooks (called from index.html) ──────────────────────────────

export function newGameStarted({ puzzleDifficulty = 1, soundOn = true, musicOn = false } = {}) {
  STATE.cPuzzleDifficulty = puzzleDifficulty;
  STATE.cAppSoundOn = soundOn ? 'yes' : 'no';
  STATE.cAppMusicOn = musicOn ? 'yes' : 'no';
  STATE.cCurrentScore = 0;
  STATE.cGameTime = 0;
  STATE.cWinFlag = 0;
  STATE.cCurrentMoves = 0;
  STATE.cCurrentBlocksRemoved = 0;
  STATE.cCurrentCellPiecesGenerated = 0;
  STATE.gameStartMs = Date.now();

  STATE.cLTGamesStarted += 1;
  STATE.cSeshGamesStarted += 1;
  TOSStorage.set(K.LT_GAMES_STARTED, String(STATE.cLTGamesStarted));

  TOSAnalytics.sendEvent(EVENTS.GAME_STARTED);
  TOSLifecycle.fanOutGameStarted(STATE.cLTGamesStarted, TOSAnalytics.secSinceInstall());
}

export function scoreChanged(currentScore) {
  STATE.cCurrentScore = currentScore | 0;
  if (currentScore > STATE.cLTBestScore) {
    STATE.cLTBestScore = currentScore | 0;
    TOSStorage.set(K.LT_BEST_SCORE, String(STATE.cLTBestScore));
  }
  TOSLifecycle.fanOutScoreThresholds(STATE.cCurrentScore);
}

export function piecePlaced(opts = {}) {
  STATE.cCurrentMoves += 1;
  if (typeof opts.cellsPlaced === 'number') {
    STATE.cCurrentCellPiecesGenerated += opts.cellsPlaced;
  }
  TOSAnalytics.sendEventOncePerSesh(EVENTS.PIECE_PLACED_FIRST, opts);
}

export function linesCleared(opts = {}) {
  if (typeof opts.count === 'number') {
    STATE.cCurrentBlocksRemoved += opts.count;
  }
  TOSAnalytics.sendEventOncePerSesh(EVENTS.LINES_CLEARED_FIRST, {
    [PARAMS.LINES_CLEARED_COUNT]: opts.count | 0,
  });
}

export function combo(opts = {}) {
  TOSAnalytics.sendEventOncePerSesh(EVENTS.COMBO_FIRST, {
    [PARAMS.COMBO_SIZE]: opts.size | 0,
  });
}

export function gameOverShown(opts = {}) {
  if (opts.gameTimeSec) STATE.cGameTime = opts.gameTimeSec | 0;
  else if (STATE.gameStartMs) STATE.cGameTime = Math.floor((Date.now() - STATE.gameStartMs) / 1000);
  if (opts.score !== undefined) STATE.cCurrentScore = opts.score | 0;
  if (opts.moves !== undefined) STATE.cCurrentMoves = opts.moves | 0;
  TOSAnalytics.sendEvent(EVENTS.GAME_OVER_SHOWN);
}

export function gameWon({ score, moves, gameTimeSec, blocksRemoved } = {}) {
  if (score !== undefined) STATE.cCurrentScore = score | 0;
  if (moves !== undefined) STATE.cCurrentMoves = moves | 0;
  if (blocksRemoved !== undefined) STATE.cCurrentBlocksRemoved = blocksRemoved | 0;
  if (gameTimeSec !== undefined) STATE.cGameTime = gameTimeSec | 0;
  else if (STATE.gameStartMs) STATE.cGameTime = Math.floor((Date.now() - STATE.gameStartMs) / 1000);
  STATE.cWinFlag = 1;

  STATE.cLTGamesWon += 1;
  STATE.cSeshGamesWon += 1;
  TOSStorage.set(K.LT_GAMES_WON, String(STATE.cLTGamesWon));

  // Days-active-wins counters
  const today = localDayKey();
  const todayUTC = utcDayKey();
  if (TOSStorage.get(K.LAST_WIN_LOCAL_DAY) !== today) {
    STATE.cDaysActiveWins += 1;
    TOSStorage.set(K.DAYS_ACTIVE_WINS, String(STATE.cDaysActiveWins));
    TOSStorage.set(K.LAST_WIN_LOCAL_DAY, today);
  }
  if (TOSStorage.get(K.LAST_WIN_UTC_DAY) !== todayUTC) {
    STATE.cDaysActiveWinsUTC += 1;
    TOSStorage.set(K.DAYS_ACTIVE_WINS_UTC, String(STATE.cDaysActiveWinsUTC));
    TOSStorage.set(K.LAST_WIN_UTC_DAY, todayUTC);
  }

  TOSAnalytics.sendEvent(EVENTS.GAME_WON);
  TOSLifecycle.fanOutGameWon(STATE.cLTGamesWon, TOSAnalytics.secSinceInstall());
  TOSAnalytics.markHasWonGame();
  TOSAnalytics.refreshUserProperties();
}

export function settingChanged(name, enabled) {
  const N = String(name || '').replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  const onEvent = EVENTS[`SETTING_ON_${N.toUpperCase()}`];
  const offEvent = EVENTS[`SETTING_OFF_${N.toUpperCase()}`];
  if (enabled && onEvent) TOSAnalytics.sendEvent(onEvent);
  else if (!enabled && offEvent) TOSAnalytics.sendEvent(offEvent);
  // Update sound/music snapshot for the uniques params
  if (N === 'Sound') STATE.cAppSoundOn = enabled ? 'yes' : 'no';
  if (N === 'Music') STATE.cAppMusicOn = enabled ? 'yes' : 'no';
}

export function settingsViewDidLoad() {
  TOSAnalytics.sendEvent(EVENTS.SETTINGS_VIEW_DID_LOAD);
}

// ── Public adapter object ────────────────────────────────────────────

export const blockPuzzleUniques = {
  hydrate,
  uniqueAnalyticsEventParams,
  onSessionStart,
  getLTGamesWon,
  // game hooks
  newGameStarted,
  scoreChanged,
  piecePlaced,
  linesCleared,
  combo,
  gameOverShown,
  gameWon,
  settingChanged,
  settingsViewDidLoad,
};

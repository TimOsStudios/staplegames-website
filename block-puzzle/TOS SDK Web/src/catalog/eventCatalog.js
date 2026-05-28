/**
 * TOS SDK Web — Event Catalog (locked v1)
 *
 * The single source of truth for every Firebase event name the SDK can fire.
 * Game code should always reference these constants, never raw strings.
 *
 * Naming convention: matches the iOS TOS SDK (cFooBar) so dashboards
 * built on iOS data continue to work when the web events land in the
 * same Firebase project. Web-only events are prefixed `cWeb*`.
 *
 * Order below mirrors EVENTS_MASTER.md sections for grep-ability.
 */

export const EVENTS = Object.freeze({
  // ─ Section 1.1: iOS Lifecycle (kept) ───────────────────────────────
  COLD_LAUNCH:                'cColdLaunch',
  FIRST_OPEN:                 'cFirstOpen',
  APP_UPDATED:                'cAppUpdated',
  SESSION_START:              'cSessionStart',
  APP_LOADED_IN_WINNING:      'cAppLoadedInWinningState',
  APP_LOADED_NOT_IN_WINNING:  'cAppLoadedNotInWinningState',

  // ─ Section 1.2: Daily-open ─────────────────────────────────────────
  DAILY_OPEN:                 'cDailyOpen',
  DAILY_OPEN_UTC:             'cDailyOpenUTC',
  DAILY_OPEN_TODAY_AND_YEST:  'cDailyOpenTodayAndYest',
  DAILY_OPEN_TODAY_AND_YEST_UTC: 'cDailyOpenTodayAndYestUTC',

  // ─ Section 1.3: Returned (once per install) ────────────────────────
  RETURNED_24:                'cReturned24',
  RETURNED_48:                'cReturned48',
  RETURNED_72:                'cReturned72',
  RETURNED_168:               'cReturned168',
  RETURNED_336:               'cReturned336',
  RETURNED_720:               'cReturned720',

  // ─ Section 1.4: Open-window-since-install ⭐ ───────────────────────
  OPEN_WITHIN_24:             'cOpenWithin24',
  OPEN_AFTER_24:              'cOpenAfter24',
  OPEN_BETWEEN_24_AND_48:     'cOpenBetween24And48',
  OPEN_BETWEEN_24_AND_168:    'cOpenBetween24And168',
  OPEN_BETWEEN_144_AND_168:   'cOpenBetween144And168',
  OPEN_AFTER_168:             'cOpenAfter168',
  OPEN_2ND_AFTER_168:         'cOpen2ndAfter168',

  // ─ Section 1.5: Usage timers ───────────────────────────────────────
  FOV_USAGE_0_SECONDS:        'cFOVUsage0Seconds',
  USAGE_0_SECONDS:            'cUsage0Seconds',
  USAGE_10_SECONDS:           'cUsage10Seconds',
  USAGE_20_SECONDS:           'cUsage20Seconds',
  USAGE_30_SECONDS:           'cUsage30Seconds',
  USAGE_60_SECONDS:           'cUsage60Seconds',
  USAGE_120_SECONDS:          'cUsage120Seconds',
  USAGE_300_SECONDS:          'cUsage300Seconds',
  USAGE_600_SECONDS:          'cUsage600Seconds',
  USAGE_1800_SECONDS:         'cUsage1800Seconds',
  USAGE_3600_SECONDS:         'cUsage3600Seconds',
  USAGE_36000_SECONDS:        'cUsage36000Seconds',
  USAGE_INTERVAL_10M:         'cUsageInterval10m',

  // ─ Section 1.6: LT days active ─────────────────────────────────────
  LT_DAYS_ACTIVE_1:           'cLTDaysActive1',
  LT_DAYS_ACTIVE_2:           'cLTDaysActive2',
  LT_DAYS_ACTIVE_3:           'cLTDaysActive3',
  LT_DAYS_ACTIVE_5:           'cLTDaysActive5',
  LT_DAYS_ACTIVE_7:           'cLTDaysActive7',
  LT_DAYS_ACTIVE_14:          'cLTDaysActive14',
  LT_DAYS_ACTIVE_30:          'cLTDaysActive30',
  LT_DAYS_ACTIVE_60:          'cLTDaysActive60',
  LT_DAYS_ACTIVE_75:          'cLTDaysActive75',
  LT_DAYS_ACTIVE_90:          'cLTDaysActive90',
  LT_DAYS_ACTIVE_120:         'cLTDaysActive120',
  LT_DAYS_ACTIVE_180:         'cLTDaysActive180',
  LT_DAYS_ACTIVE_365:         'cLTDaysActive365',
  LT_DAYS_ACTIVE_730:         'cLTDaysActive730',

  // ─ Section 1.8 NEW: Web Page Lifecycle ─────────────────────────────
  WEB_PAGE_LOAD_START:        'cWebPageLoadStart',
  WEB_DOM_READY:              'cWebDOMReady',
  WEB_FIRST_PAINT:            'cWebFirstPaint',
  WEB_FCP:                    'cWebFirstContentfulPaint',
  WEB_LCP:                    'cWebLargestContentfulPaint',
  WEB_FULLY_LOADED:           'cWebFullyLoaded',
  WEB_GAME_RENDERED:          'cWebGameRendered',
  WEB_FIRST_INTERACTIVE:      'cWebFirstInteractive',
  WEB_VISIBILITY_HIDDEN:      'cWebVisibilityHidden',
  WEB_VISIBILITY_VISIBLE:     'cWebVisibilityVisible',
  WEB_OFFLINE:                'cWebOffline',
  WEB_ONLINE:                 'cWebOnline',
  WEB_ORIENTATION_CHANGE:     'cWebOrientationChange',
  WEB_BOOT_ERROR:             'cWebBootError',
  WEB_RUNTIME_ERROR:          'cWebRuntimeError',

  // ─ Section 2: Gameplay core ⭐ ─────────────────────────────────────
  GAME_STARTED:               'cGameStarted',
  GAME_WON:                   'cGameWon',
  GAME_OVER_SHOWN:            'cGameOverShown',
  GAME_STARTED_BETWEEN_24_48: 'cGameStartedBetween24And48',
  GAME_WON_BETWEEN_24_48:     'cGameWonBetween24And48',

  // First-per-session pattern (locked per user instruction)
  PIECE_PLACED_FIRST:         'cPiecePlacedFirst',
  LINES_CLEARED_FIRST:        'cLinesClearedFirst',
  COMBO_FIRST:                'cComboFirst',

  // ─ Section 4: Settings ─────────────────────────────────────────────
  SETTINGS_VIEW_DID_LOAD:     'cSettingsViewDidLoad',
  SETTING_ON_SOUND:           'cSettingOnSound',
  SETTING_OFF_SOUND:          'cSettingOffSound',
  SETTING_ON_MUSIC:           'cSettingOnMusic',
  SETTING_OFF_MUSIC:          'cSettingOffMusic',
  SETTING_ON_VIBRATE:         'cSettingOnVibrate',
  SETTING_OFF_VIBRATE:        'cSettingOffVibrate',

  // ─ Section 5: Legal / Consent (per "by the book" decision) ─────────
  TERMS_AND_PRIVACY_SHOWN:    'cTermsAndPrivacyShown',
  TERMS_AND_PRIVACY_ACCEPTED: 'cTermsAndPrivacyAccepted',
  TERMS_CLICKED:              'cTermsClicked',
  PRIVACY_CLICKED:            'cPrivacyClicked',
  LEGAL_TERMS_TAPPED:         'cLegalTermsTapped',
  LEGAL_PRIVACY_TAPPED:       'cLegalPrivacyTapped',
  LEGAL_DO_NOT_SELL_SHOWN:    'cLegalDoNotSellShown',
  LEGAL_DO_NOT_SELL_ENABLED:  'cLegalDoNotSellEnabled',
  LEGAL_DO_NOT_SELL_DISABLED: 'cLegalDoNotSellDisabled',
  DATA_REQUEST:               'cDataRequest',
  DELETE_DATA_REQUEST:        'cDeleteDataRequest',

  // ─ Section 8: Rate prompt (stub for v1, wired when added) ──────────
  RATE_PREP_SHOULD_SHOW:      'cRatePrepShouldShow',
  RATE_PREP_YES:              'cRateDoYouLikeYesTapped',
  RATE_PREP_NO:               'cRateDoYouLikeNoTapped',
  RATE_DIALOG_SHOULD_SHOW:    'cRateDialogShouldShow',

  // ─ Section 12: Storage / diagnostics ───────────────────────────────
  STORAGE_ERROR:              'cStorageError',
});

/**
 * Every event the SDK can fire. Used at init time to install one-time /
 * once-per-sesh / once-per-VC gates and to verify no fire-site references
 * an unknown event in dev mode.
 */
export const ALL_EVENT_NAMES = Object.freeze(Object.values(EVENTS));

/**
 * Dynamic-name patterns used by the milestone fan-out tables and the
 * lifecycle helpers (cReturned24, cUsage300Seconds, cLTDaysActive7,
 * cGameWon1Within24Hour, cGameStarted5Within1Hour, cScoreOver100First, ...).
 *
 * Listed here as regexes so dev mode doesn't warn about them, but the
 * declarative truth still lives in `milestoneSchedule.js` /
 * `TOSLifecycle.js` / `EVENTS_MASTER.md`.
 */
export const DYNAMIC_EVENT_PATTERNS = Object.freeze([
  /^cReturned(24|48|72|168|336|720)$/,
  /^cUsage(0|10|20|30|60|120|300|600|1800|3600|36000)Seconds$/,
  /^cLTDaysActive(1|2|3|5|7|14|30|60|75|90|120|180|365|730)$/,
  /^cGameWon\d+(Within\d+(Minute|Hour))?$/,
  /^cGameStarted\d+(Within\d+(Minute|Hour))?$/,
  /^cScoreOver\d+First$/,
  /^cWebSessionCLS$/,
]);

/** Quick sanity helper used by dev mode + tests. */
export function isKnownEvent(name) {
  if (ALL_EVENT_NAMES.includes(name)) return true;
  for (const re of DYNAMIC_EVENT_PATTERNS) if (re.test(name)) return true;
  return false;
}

/**
 * TOS SDK Web — Param + User-Property Catalog (locked v1)
 *
 * Names match the iOS SDK 1:1 so dashboards built on iOS data work
 * unchanged when the web events arrive. Web-only fields are
 * prefixed `cWeb*`.
 */

/** Baseline event params — attached to every event by TOSAnalytics. */
export const PARAMS = Object.freeze({
  // iOS-parity baseline
  DAYS_SINCE_INSTALL:        'cDaysSinceInstall',
  DAYS_SINCE_PREVIOUS_SESH:  'cDaysSincePreviousSesh',
  DAYS_ACTIVE:               'cDaysActive',
  DAYS_ACTIVE_UTC:           'cDaysActiveUTC',
  LT_SESH_TIME:              'cLTSeshTime',
  LT_SESH_COUNT:             'cLTSeshCount',
  CURRENT_SESH_TIME:         'cCurrentSeshTime',
  COLD_LAUNCH_SESH:          'cColdLaunchSesh',
  CONSENT_STATE:             'cConsentState',
  VC:                        'VC',

  // Web-only baseline
  WEB_PLATFORM:              'cWebPlatform',
  WEB_REFERRER_HOST:         'cWebReferrerHost',
  WEB_ORIENTATION:           'cWebOrientation',

  // Web attribution, parsed from landing URL query params
  WEB_ATTRIBUTION_PRESENT:   'cWebAttributionPresent',
  WEB_SOURCE:                'cWebSource',
  WEB_MEDIA:                 'cWebMedia',
  WEB_CAMPAIGN:              'cWebCampaign',
  WEB_CONTENT:               'cWebContent',
  WEB_TERM:                  'cWebTerm',
  WEB_CLICK_ID:              'cWebClickId',
  WEB_LANDING_PATH:          'cWebLandingPath',

  // Web lifecycle event-specific
  WEB_PAINT_MS:              'cWebPaintMs',
  WEB_FCP_MS:                'cWebFcpMs',
  WEB_LCP_MS:                'cWebLcpMs',
  WEB_LOAD_MS:               'cWebLoadMs',
  WEB_RENDER_MS:             'cWebRenderMs',
  WEB_INTERACTIVE_MS:        'cWebInteractiveMs',
  WEB_INP_MS:                'cWebInpMs',
  WEB_CLS_SCORE:             'cWebClsScore',

  // Web error event-specific
  MESSAGE:                   'cMessage',
  WHERE:                     'cWhere',

  // Game-specific (filled by the per-game adapter, but the SDK
  // namespaces them here for grep-ability)
  LT_GAMES_WON:              'cLTGamesWon',
  LT_GAMES_STARTED:          'cLTGamesStarted',
  LT_BEST_SCORE:             'cLTBestScore',
  SESH_GAMES_WON:            'cSeshGamesWon',
  SESH_GAMES_STARTED:        'cSeshGamesStarted',
  DAYS_ACTIVE_WINS:          'cDaysActiveWins',
  DAYS_ACTIVE_WINS_UTC:      'cDaysActiveWinsUTC',
  PUZZLE_DIFFICULTY:         'cPuzzleDifficulty',
  CURRENT_SCORE:             'cCurrentScore',
  GAME_TIME:                 'cGameTime',
  WIN_FLAG:                  'cWinFlag',
  CURRENT_MOVES:             'cCurrentMoves',
  CURRENT_BLOCKS_REMOVED:    'cCurrentBlocksRemoved',
  CURRENT_CELL_PIECES_GENERATED: 'cCurrentCellPiecesGenerated',
  APP_MUSIC_ON:              'cAppMusicOn',
  APP_SOUND_ON:              'cAppSoundOn',

  // Settings / etc. supplemental
  COMBO_SIZE:                'cComboSize',
  LINES_CLEARED_COUNT:       'cLinesClearedCount',
});

/** Firebase User Properties — set sticky, segment users in dashboards. */
export const USER_PROPS = Object.freeze({
  TOS_ID:                    'TOS_ID',
  TOS_SDK_VERSION:           'TOS_SDK_VERSION',
  TOS_GROUP:                 'TOS_GROUP',
  TOS_GROUP_SUB:             'TOS_GROUP_SUB',
  TOS_GROUP_SUB_SUB:         'TOS_GROUP_SUB_SUB',
  TOS_GROUP_SUB3:            'TOS_GROUP_SUB3',
  TOS_GROUP_SUB4:            'TOS_GROUP_SUB4',
  TOS_GROUP_AB:              'TOS_GROUP_AB',
  TOS_GROUP_100:             'TOS_GROUP_100',
  TOS_TEST_TAG:              'TOS_TEST_TAG',
  INSTALL_VC:                'INSTALL_VC',
  VC:                        'VC',
  IS_DEV_MODE:               'IS_DEV_MODE',
  LT_GAMES_WON:              'LT_GAMES_WON',
  DAYS_SINCE_INSTALL:        'DAYS_SINCE_INSTALL',
  HAS_WON_GAME:              'HAS_WON_GAME',

  // Web-only
  WEB_PLATFORM:              'WEB_PLATFORM',
  WEB_REFERRER_HOST:         'WEB_REFERRER_HOST',
  WEB_VIEWPORT_BUCKET:       'WEB_VIEWPORT_BUCKET',
  WEB_PWA_INSTALLED:         'WEB_PWA_INSTALLED',
  WEB_LANG:                  'WEB_LANG',
  WEB_CONNECTION:            'WEB_CONNECTION',

  // Consent
  CONSENT_COOKIES:           'CONSENT_COOKIES',
  CONSENT_DO_NOT_SELL:       'CONSENT_DO_NOT_SELL',
  CONSENT_COUNTRY:           'CONSENT_COUNTRY',
});

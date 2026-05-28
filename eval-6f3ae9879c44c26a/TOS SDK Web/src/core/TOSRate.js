/**
 * TOS SDK Web — TOSRate (stub).
 *
 * Rate-prompt funnel events. Web v1 ships the funnel hooks but doesn't
 * render any prompt UI — the iOS prompt was `SKStoreReviewController`,
 * which has no web equivalent. When the team adds a web rate prompt,
 * the dialogShouldShow() hook is the wire-up point: it fires the event
 * and (when implemented) shows a sheet.
 *
 * The decision split (cRatePrepShouldShow → DoYouLike Y/N →
 * RateDialogShouldShow) is kept identical to iOS so dashboards work.
 */

import { TOSAnalytics } from './TOSAnalytics.js';
import { EVENTS } from '../catalog/eventCatalog.js';

export const TOSRate = {
  prepShouldShow()    { TOSAnalytics.sendEvent(EVENTS.RATE_PREP_SHOULD_SHOW); },
  prepYes()           { TOSAnalytics.sendEvent(EVENTS.RATE_PREP_YES); },
  prepNo()            { TOSAnalytics.sendEvent(EVENTS.RATE_PREP_NO); },
  dialogShouldShow()  { TOSAnalytics.sendEvent(EVENTS.RATE_DIALOG_SHOULD_SHOW); },
};

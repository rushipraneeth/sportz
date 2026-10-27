/**
 * Centralized Match Status Normalizer
 * Standardizes status codes across providers and sports into reliable categories and display labels.
 */

export const STATUS_CATEGORIES = {
  UPCOMING: 'upcoming',
  LIVE: 'live',
  HALFTIME: 'halftime',
  COMPLETED: 'completed',
  POSTPONED: 'postponed',
  CANCELLED: 'cancelled',
  ABANDONED: 'abandoned',
  SUSPENDED: 'suspended',
  UNKNOWN: 'unknown'
};

/**
 * Standard database status enum mapping (PostgreSQL match_status: 'scheduled', 'live', 'finished')
 */
export const DB_MATCH_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINISHED: 'finished'
};

const FOOTBALL_STATUS_DEFINITIONS = {
  // Scheduled
  TBD: { category: STATUS_CATEGORIES.UPCOMING, displayText: 'Time TBD', isInPlay: false, dbStatus: DB_MATCH_STATUS.SCHEDULED },
  NS: { category: STATUS_CATEGORIES.UPCOMING, displayText: 'Not Started', isInPlay: false, dbStatus: DB_MATCH_STATUS.SCHEDULED },
  
  // In Play / Live
  '1H': { category: STATUS_CATEGORIES.LIVE, displayText: '1st Half', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  HT: { category: STATUS_CATEGORIES.HALFTIME, displayText: 'Half-Time', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  '2H': { category: STATUS_CATEGORIES.LIVE, displayText: '2nd Half', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  ET: { category: STATUS_CATEGORIES.LIVE, displayText: 'Extra Time', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  BT: { category: STATUS_CATEGORIES.HALFTIME, displayText: 'Break Time', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  P: { category: STATUS_CATEGORIES.LIVE, displayText: 'Penalty Shootout', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  LIVE: { category: STATUS_CATEGORIES.LIVE, displayText: 'Live', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  
  // Stoppage / Suspended / Interrupted
  SUSP: { category: STATUS_CATEGORIES.SUSPENDED, displayText: 'Suspended', isInPlay: false, dbStatus: DB_MATCH_STATUS.LIVE },
  INT: { category: STATUS_CATEGORIES.SUSPENDED, displayText: 'Interrupted', isInPlay: false, dbStatus: DB_MATCH_STATUS.LIVE },
  
  // Postponed / Cancelled / Abandoned
  PST: { category: STATUS_CATEGORIES.POSTPONED, displayText: 'Postponed', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  CANC: { category: STATUS_CATEGORIES.CANCELLED, displayText: 'Cancelled', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  ABD: { category: STATUS_CATEGORIES.ABANDONED, displayText: 'Abandoned', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  
  // Completed
  FT: { category: STATUS_CATEGORIES.COMPLETED, displayText: 'Full-Time', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  AET: { category: STATUS_CATEGORIES.COMPLETED, displayText: 'After Extra Time', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  PEN: { category: STATUS_CATEGORIES.COMPLETED, displayText: 'Penalties', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  AWD: { category: STATUS_CATEGORIES.COMPLETED, displayText: 'Technical Loss', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  WO: { category: STATUS_CATEGORIES.COMPLETED, displayText: 'Walkover', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED }
};

const BASKETBALL_STATUS_DEFINITIONS = {
  NS: { category: STATUS_CATEGORIES.UPCOMING, displayText: 'Not Started', isInPlay: false, dbStatus: DB_MATCH_STATUS.SCHEDULED },
  TBD: { category: STATUS_CATEGORIES.UPCOMING, displayText: 'Time TBD', isInPlay: false, dbStatus: DB_MATCH_STATUS.SCHEDULED },
  Q1: { category: STATUS_CATEGORIES.LIVE, displayText: '1st Quarter', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  Q2: { category: STATUS_CATEGORIES.LIVE, displayText: '2nd Quarter', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  HT: { category: STATUS_CATEGORIES.HALFTIME, displayText: 'Half-Time', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  Q3: { category: STATUS_CATEGORIES.LIVE, displayText: '3rd Quarter', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  Q4: { category: STATUS_CATEGORIES.LIVE, displayText: '4th Quarter', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  OT: { category: STATUS_CATEGORIES.LIVE, displayText: 'Overtime', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  BT: { category: STATUS_CATEGORIES.HALFTIME, displayText: 'Break Time', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  LIVE: { category: STATUS_CATEGORIES.LIVE, displayText: 'Live', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  FT: { category: STATUS_CATEGORIES.COMPLETED, displayText: 'Final', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  AOT: { category: STATUS_CATEGORIES.COMPLETED, displayText: 'Final / OT', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  POST: { category: STATUS_CATEGORIES.POSTPONED, displayText: 'Postponed', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  CANC: { category: STATUS_CATEGORIES.CANCELLED, displayText: 'Cancelled', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  ABD: { category: STATUS_CATEGORIES.ABANDONED, displayText: 'Abandoned', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  AW: { category: STATUS_CATEGORIES.COMPLETED, displayText: 'Awarded', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  WO: { category: STATUS_CATEGORIES.COMPLETED, displayText: 'Walkover', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED }
};

const HOCKEY_STATUS_DEFINITIONS = {
  NS: { category: STATUS_CATEGORIES.UPCOMING, displayText: 'Not Started', isInPlay: false, dbStatus: DB_MATCH_STATUS.SCHEDULED },
  TBD: { category: STATUS_CATEGORIES.UPCOMING, displayText: 'Time TBD', isInPlay: false, dbStatus: DB_MATCH_STATUS.SCHEDULED },
  P1: { category: STATUS_CATEGORIES.LIVE, displayText: '1st Period', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  P2: { category: STATUS_CATEGORIES.LIVE, displayText: '2nd Period', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  P3: { category: STATUS_CATEGORIES.LIVE, displayText: '3rd Period', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  OT: { category: STATUS_CATEGORIES.LIVE, displayText: 'Overtime', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  PT: { category: STATUS_CATEGORIES.LIVE, displayText: 'Penalties', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  SO: { category: STATUS_CATEGORIES.LIVE, displayText: 'Shootout', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  LIVE: { category: STATUS_CATEGORIES.LIVE, displayText: 'Live', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  FT: { category: STATUS_CATEGORIES.COMPLETED, displayText: 'Final', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  AOT: { category: STATUS_CATEGORIES.COMPLETED, displayText: 'Final / OT', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  AP: { category: STATUS_CATEGORIES.COMPLETED, displayText: 'Final / Penalties', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  POST: { category: STATUS_CATEGORIES.POSTPONED, displayText: 'Postponed', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  CANC: { category: STATUS_CATEGORIES.CANCELLED, displayText: 'Cancelled', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  ABD: { category: STATUS_CATEGORIES.ABANDONED, displayText: 'Abandoned', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  AW: { category: STATUS_CATEGORIES.COMPLETED, displayText: 'Awarded', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  WO: { category: STATUS_CATEGORIES.COMPLETED, displayText: 'Walkover', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED }
};

const VOLLEYBALL_STATUS_DEFINITIONS = {
  NS: { category: STATUS_CATEGORIES.UPCOMING, displayText: 'Not Started', isInPlay: false, dbStatus: DB_MATCH_STATUS.SCHEDULED },
  TBD: { category: STATUS_CATEGORIES.UPCOMING, displayText: 'Time TBD', isInPlay: false, dbStatus: DB_MATCH_STATUS.SCHEDULED },
  S1: { category: STATUS_CATEGORIES.LIVE, displayText: 'Set 1', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  S2: { category: STATUS_CATEGORIES.LIVE, displayText: 'Set 2', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  S3: { category: STATUS_CATEGORIES.LIVE, displayText: 'Set 3', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  S4: { category: STATUS_CATEGORIES.LIVE, displayText: 'Set 4', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  S5: { category: STATUS_CATEGORIES.LIVE, displayText: 'Set 5', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  LIVE: { category: STATUS_CATEGORIES.LIVE, displayText: 'Live', isInPlay: true, dbStatus: DB_MATCH_STATUS.LIVE },
  FT: { category: STATUS_CATEGORIES.COMPLETED, displayText: 'Final', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  POST: { category: STATUS_CATEGORIES.POSTPONED, displayText: 'Postponed', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  CANC: { category: STATUS_CATEGORIES.CANCELLED, displayText: 'Cancelled', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  ABD: { category: STATUS_CATEGORIES.ABANDONED, displayText: 'Abandoned', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  AW: { category: STATUS_CATEGORIES.COMPLETED, displayText: 'Awarded', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED },
  WO: { category: STATUS_CATEGORIES.COMPLETED, displayText: 'Walkover', isInPlay: false, dbStatus: DB_MATCH_STATUS.FINISHED }
};

/**
 * Normalizes a provider's match status code into standardized category, display label, and database status.
 * @param {string} rawStatus - The provider status code (e.g. '1H', 'HT', 'FT', 'NS', 'PST')
 * @param {string} sport - Sport type ('football', 'basketball', 'hockey', 'volleyball')
 * @returns {{ category: string, detailedStatus: string, displayText: string, isInPlay: boolean, dbStatus: string }}
 */
export function normalizeMatchStatus(rawStatus, sport = 'football') {
  if (!rawStatus || typeof rawStatus !== 'string') {
    return {
      category: STATUS_CATEGORIES.UNKNOWN,
      detailedStatus: 'UNKNOWN',
      displayText: 'Unknown Status',
      isInPlay: false,
      dbStatus: DB_MATCH_STATUS.SCHEDULED
    };
  }

  const cleanCode = rawStatus.trim().toUpperCase();

  let dict = FOOTBALL_STATUS_DEFINITIONS;
  const normalizedSport = (sport || '').toLowerCase();
  if (normalizedSport === 'basketball') dict = BASKETBALL_STATUS_DEFINITIONS;
  else if (normalizedSport === 'hockey') dict = HOCKEY_STATUS_DEFINITIONS;
  else if (normalizedSport === 'volleyball') dict = VOLLEYBALL_STATUS_DEFINITIONS;

  if (dict[cleanCode]) {
    const entry = dict[cleanCode];
    return {
      category: entry.category,
      detailedStatus: cleanCode,
      displayText: entry.displayText,
      isInPlay: entry.isInPlay,
      dbStatus: entry.dbStatus
    };
  }

  // Fallback for general strings
  if (['LIVE', 'IN PLAY', 'INPLAY', 'IN_PLAY'].includes(cleanCode)) {
    return {
      category: STATUS_CATEGORIES.LIVE,
      detailedStatus: cleanCode,
      displayText: 'Live',
      isInPlay: true,
      dbStatus: DB_MATCH_STATUS.LIVE
    };
  }

  if (['FINISHED', 'FINAL', 'ENDED', 'COMPLETED'].includes(cleanCode)) {
    return {
      category: STATUS_CATEGORIES.COMPLETED,
      detailedStatus: cleanCode,
      displayText: 'Finished',
      isInPlay: false,
      dbStatus: DB_MATCH_STATUS.FINISHED
    };
  }

  if (['SCHEDULED', 'NOT STARTED', 'UPCOMING'].includes(cleanCode)) {
    return {
      category: STATUS_CATEGORIES.UPCOMING,
      detailedStatus: cleanCode,
      displayText: 'Scheduled',
      isInPlay: false,
      dbStatus: DB_MATCH_STATUS.SCHEDULED
    };
  }

  return {
    category: STATUS_CATEGORIES.UNKNOWN,
    detailedStatus: cleanCode,
    displayText: cleanCode,
    isInPlay: false,
    dbStatus: DB_MATCH_STATUS.SCHEDULED
  };
}

export function isMatchLive(status) {
  const normalized = typeof status === 'string' ? normalizeMatchStatus(status) : status;
  return normalized?.isInPlay === true || normalized?.category === STATUS_CATEGORIES.LIVE || normalized?.category === STATUS_CATEGORIES.HALFTIME;
}

export function isMatchUpcoming(status) {
  const normalized = typeof status === 'string' ? normalizeMatchStatus(status) : status;
  return normalized?.category === STATUS_CATEGORIES.UPCOMING;
}

export function isMatchCompleted(status) {
  const normalized = typeof status === 'string' ? normalizeMatchStatus(status) : status;
  return [
    STATUS_CATEGORIES.COMPLETED,
    STATUS_CATEGORIES.POSTPONED,
    STATUS_CATEGORIES.CANCELLED,
    STATUS_CATEGORIES.ABANDONED
  ].includes(normalized?.category);
}

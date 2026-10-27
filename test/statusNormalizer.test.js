import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  normalizeMatchStatus,
  isMatchLive,
  isMatchUpcoming,
  isMatchCompleted,
  STATUS_CATEGORIES,
  DB_MATCH_STATUS
} from '../src/utils/statusNormalizer.js';
import { getMatchStatus } from '../src/utils/match-status.js';

describe('Match Status Normalization Suite', () => {
  it('correctly maps live football first half (1H)', () => {
    const res = normalizeMatchStatus('1H', 'football');
    assert.strictEqual(res.category, STATUS_CATEGORIES.LIVE);
    assert.strictEqual(res.dbStatus, DB_MATCH_STATUS.LIVE);
    assert.strictEqual(res.isInPlay, true);
    assert.strictEqual(res.displayText, '1st Half');
    assert.strictEqual(isMatchLive('1H'), true);
  });

  it('correctly maps football half-time (HT)', () => {
    const res = normalizeMatchStatus('HT', 'football');
    assert.strictEqual(res.category, STATUS_CATEGORIES.HALFTIME);
    assert.strictEqual(res.dbStatus, DB_MATCH_STATUS.LIVE);
    assert.strictEqual(res.isInPlay, true);
    assert.strictEqual(res.displayText, 'Half-Time');
    assert.strictEqual(isMatchLive('HT'), true);
  });

  it('correctly maps football second half (2H)', () => {
    const res = normalizeMatchStatus('2H', 'football');
    assert.strictEqual(res.category, STATUS_CATEGORIES.LIVE);
    assert.strictEqual(res.dbStatus, DB_MATCH_STATUS.LIVE);
    assert.strictEqual(res.isInPlay, true);
    assert.strictEqual(res.displayText, '2nd Half');
    assert.strictEqual(isMatchLive('2H'), true);
  });

  it('correctly maps extra time (ET) and break time (BT)', () => {
    const et = normalizeMatchStatus('ET', 'football');
    assert.strictEqual(et.category, STATUS_CATEGORIES.LIVE);
    assert.strictEqual(et.isInPlay, true);

    const bt = normalizeMatchStatus('BT', 'football');
    assert.strictEqual(bt.category, STATUS_CATEGORIES.HALFTIME);
    assert.strictEqual(bt.isInPlay, true);
  });

  it('correctly maps penalty shootout (P)', () => {
    const res = normalizeMatchStatus('P', 'football');
    assert.strictEqual(res.category, STATUS_CATEGORIES.LIVE);
    assert.strictEqual(res.dbStatus, DB_MATCH_STATUS.LIVE);
    assert.strictEqual(res.displayText, 'Penalty Shootout');
    assert.strictEqual(res.isInPlay, true);
  });

  it('correctly maps upcoming match statuses (NS, TBD)', () => {
    const ns = normalizeMatchStatus('NS', 'football');
    assert.strictEqual(ns.category, STATUS_CATEGORIES.UPCOMING);
    assert.strictEqual(ns.dbStatus, DB_MATCH_STATUS.SCHEDULED);
    assert.strictEqual(ns.isInPlay, false);
    assert.strictEqual(isMatchUpcoming('NS'), true);

    const tbd = normalizeMatchStatus('TBD', 'football');
    assert.strictEqual(tbd.category, STATUS_CATEGORIES.UPCOMING);
    assert.strictEqual(tbd.dbStatus, DB_MATCH_STATUS.SCHEDULED);
    assert.strictEqual(tbd.isInPlay, false);
  });

  it('correctly maps completed match statuses (FT, AET, PEN)', () => {
    const ft = normalizeMatchStatus('FT', 'football');
    assert.strictEqual(ft.category, STATUS_CATEGORIES.COMPLETED);
    assert.strictEqual(ft.dbStatus, DB_MATCH_STATUS.FINISHED);
    assert.strictEqual(ft.isInPlay, false);
    assert.strictEqual(isMatchCompleted('FT'), true);

    const aet = normalizeMatchStatus('AET', 'football');
    assert.strictEqual(aet.category, STATUS_CATEGORIES.COMPLETED);
    assert.strictEqual(aet.dbStatus, DB_MATCH_STATUS.FINISHED);

    const pen = normalizeMatchStatus('PEN', 'football');
    assert.strictEqual(pen.category, STATUS_CATEGORIES.COMPLETED);
    assert.strictEqual(pen.dbStatus, DB_MATCH_STATUS.FINISHED);
  });

  it('distinguishes postponed, cancelled, and abandoned matches', () => {
    const pst = normalizeMatchStatus('PST', 'football');
    assert.strictEqual(pst.category, STATUS_CATEGORIES.POSTPONED);
    assert.strictEqual(pst.dbStatus, DB_MATCH_STATUS.FINISHED);
    assert.strictEqual(pst.isInPlay, false);

    const canc = normalizeMatchStatus('CANC', 'football');
    assert.strictEqual(canc.category, STATUS_CATEGORIES.CANCELLED);
    assert.strictEqual(canc.dbStatus, DB_MATCH_STATUS.FINISHED);

    const abd = normalizeMatchStatus('ABD', 'football');
    assert.strictEqual(abd.category, STATUS_CATEGORIES.ABANDONED);
    assert.strictEqual(abd.dbStatus, DB_MATCH_STATUS.FINISHED);
  });

  it('distinguishes suspended and interrupted matches from active in-play', () => {
    const susp = normalizeMatchStatus('SUSP', 'football');
    assert.strictEqual(susp.category, STATUS_CATEGORIES.SUSPENDED);
    assert.strictEqual(susp.isInPlay, false);

    const int = normalizeMatchStatus('INT', 'football');
    assert.strictEqual(int.category, STATUS_CATEGORIES.SUSPENDED);
    assert.strictEqual(int.isInPlay, false);
  });

  it('handles unknown or malformed statuses gracefully without crashing', () => {
    const unk = normalizeMatchStatus('RANDOM_CODE_123', 'football');
    assert.strictEqual(unk.category, STATUS_CATEGORIES.UNKNOWN);
    assert.strictEqual(unk.dbStatus, DB_MATCH_STATUS.SCHEDULED);
    assert.strictEqual(unk.isInPlay, false);

    const empty = normalizeMatchStatus(null, 'football');
    assert.strictEqual(empty.category, STATUS_CATEGORIES.UNKNOWN);

    const undefinedStatus = normalizeMatchStatus(undefined, 'football');
    assert.strictEqual(undefinedStatus.category, STATUS_CATEGORIES.UNKNOWN);
  });

  it('does not confuse 0-0 score with unstarted match if status is live', () => {
    const liveStatus = normalizeMatchStatus('1H', 'football');
    const match = {
      homeScore: 0,
      awayScore: 0,
      status: liveStatus.dbStatus,
      detailedStatus: liveStatus.detailedStatus
    };

    assert.strictEqual(match.status, DB_MATCH_STATUS.LIVE);
    assert.strictEqual(isMatchLive(match.detailedStatus), true);
  });

  it('supports basketball, hockey, and volleyball quarter/period statuses', () => {
    const q1 = normalizeMatchStatus('Q1', 'basketball');
    assert.strictEqual(q1.category, STATUS_CATEGORIES.LIVE);
    assert.strictEqual(q1.isInPlay, true);

    const p2 = normalizeMatchStatus('P2', 'hockey');
    assert.strictEqual(p2.category, STATUS_CATEGORIES.LIVE);
    assert.strictEqual(p2.isInPlay, true);

    const s3 = normalizeMatchStatus('S3', 'volleyball');
    assert.strictEqual(s3.category, STATUS_CATEGORIES.LIVE);
    assert.strictEqual(s3.isInPlay, true);
  });
});

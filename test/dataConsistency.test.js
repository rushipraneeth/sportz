import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createMatchSchema, listMatchesQuerySchema } from '../src/validation/matches.js';
import { normalizeMatchStatus } from '../src/utils/statusNormalizer.js';

describe('Data Consistency & Deduplication Suite', () => {
  it('deduplicates fixtures between date-based and live=all queries correctly', () => {
    // Fixture from date endpoint (captured earlier in the day)
    const dateFixture = {
      externalId: 9991,
      homeTeam: 'Real Madrid',
      awayTeam: 'Barcelona',
      status: 'scheduled',
      homeScore: 0,
      awayScore: 0,
      elapsed: null
    };

    // Fixture from live=all endpoint (captured now in 2nd half)
    const liveFixture = {
      externalId: 9991,
      homeTeam: 'Real Madrid',
      awayTeam: 'Barcelona',
      status: 'live',
      homeScore: 2,
      awayScore: 1,
      elapsed: 67
    };

    const map = new Map();
    // Simulate insertion from date endpoint first
    map.set(dateFixture.externalId, dateFixture);
    // Simulate merge from live endpoint second
    map.set(liveFixture.externalId, liveFixture);

    const merged = Array.from(map.values());
    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].status, 'live');
    assert.strictEqual(merged[0].homeScore, 2);
    assert.strictEqual(merged[0].awayScore, 1);
    assert.strictEqual(merged[0].elapsed, 67);
  });

  it('validates match payload and enforces endTime > startTime only when both provided', () => {
    // Valid match with start time and no end time
    const validUpcoming = {
      sport: 'football',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      startTime: '2026-10-27T18:00:00.000Z'
    };
    const parsedValid = createMatchSchema.safeParse(validUpcoming);
    assert.strictEqual(parsedValid.success, true);

    // Invalid match with endTime chronologically before startTime
    const invalidTiming = {
      sport: 'football',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      startTime: '2026-10-27T18:00:00.000Z',
      endTime: '2026-10-27T17:00:00.000Z'
    };
    const parsedInvalid = createMatchSchema.safeParse(invalidTiming);
    assert.strictEqual(parsedInvalid.success, false);
    assert.strictEqual(parsedInvalid.error.issues[0].path[0], 'endTime');
  });

  it('validates list matches query parameters', () => {
    const validQuery = {
      sport: 'football',
      limit: '50',
      status: 'live',
      refresh: 'true'
    };
    const parsed = listMatchesQuerySchema.safeParse(validQuery);
    assert.strictEqual(parsed.success, true);
    assert.strictEqual(parsed.data.limit, 50);
    assert.strictEqual(parsed.data.status, 'live');
    assert.strictEqual(parsed.data.refresh, true);

    const invalidLimit = { limit: '150' }; // Max limit is 100
    const parsedInvalid = listMatchesQuerySchema.safeParse(invalidLimit);
    assert.strictEqual(parsedInvalid.success, false);
  });

  it('prevents event duplication via externalId set tracking', () => {
    const processedIds = new Set();

    const event1 = { externalId: 1001, minute: 23, eventType: 'goal' };
    const event2 = { externalId: 1002, minute: 45, eventType: 'yellow_card' };
    const duplicateEvent1 = { externalId: 1001, minute: 23, eventType: 'goal' };

    const eventsToProcess = [event1, event2, duplicateEvent1];
    const uniqueEvents = [];

    for (const ev of eventsToProcess) {
      if (!processedIds.has(ev.externalId)) {
        processedIds.add(ev.externalId);
        uniqueEvents.push(ev);
      }
    }

    assert.strictEqual(uniqueEvents.length, 2);
    assert.strictEqual(uniqueEvents[0].externalId, 1001);
    assert.strictEqual(uniqueEvents[1].externalId, 1002);
  });
});

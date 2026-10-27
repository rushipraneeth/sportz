import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { fetchApiSports, ApiSportsError, getApiHeaders } from '../src/services/sports/apiClient.js';

describe('API Client & Provider Error Handling Suite', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.API_SPORTS_KEY;

  beforeEach(() => {
    process.env.API_SPORTS_KEY = 'test_mock_api_key_12345';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey) {
      process.env.API_SPORTS_KEY = originalKey;
    } else {
      delete process.env.API_SPORTS_KEY;
    }
  });

  it('correctly sets both x-apisports-key and x-rapidapi-key headers', () => {
    const headers = getApiHeaders('v3.football.api-sports.io');
    assert.strictEqual(headers['x-apisports-key'], 'test_mock_api_key_12345');
    assert.strictEqual(headers['x-rapidapi-key'], 'test_mock_api_key_12345');
    assert.strictEqual(headers['x-rapidapi-host'], 'v3.football.api-sports.io');
  });

  it('throws ApiSportsError if API_SPORTS_KEY is missing', () => {
    delete process.env.API_SPORTS_KEY;
    assert.throws(() => getApiHeaders('v3.football.api-sports.io'), (err) => {
      assert.strictEqual(err.name, 'ApiSportsError');
      assert.strictEqual(err.isAuthError, true);
      return true;
    });
  });

  it('handles successful API response containing matches', async () => {
    const mockPayload = {
      get: 'fixtures',
      parameters: { live: 'all' },
      errors: [],
      results: 1,
      response: [
        {
          fixture: { id: 101, status: { short: '1H', elapsed: 25 } },
          teams: { home: { name: 'Arsenal' }, away: { name: 'Chelsea' } },
          goals: { home: 1, away: 0 }
        }
      ]
    };

    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => mockPayload
    });

    const result = await fetchApiSports('v3.football.api-sports.io', '/fixtures?live=all');
    assert.strictEqual(result.results, 1);
    assert.strictEqual(result.response.length, 1);
    assert.strictEqual(result.response[0].teams.home.name, 'Arsenal');
  });

  it('handles successful response containing zero matches without error', async () => {
    const mockPayload = {
      get: 'fixtures',
      parameters: { live: 'all' },
      errors: [],
      results: 0,
      response: []
    };

    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => mockPayload
    });

    const result = await fetchApiSports('v3.football.api-sports.io', '/fixtures?live=all');
    assert.strictEqual(result.results, 0);
    assert.strictEqual(result.response.length, 0);
  });

  it('detects provider rateLimit error disguised in HTTP 200 OK envelope', async () => {
    // API-Sports returns HTTP 200 with error map when rate limits or plan boundaries are hit
    const rateLimitPayload = {
      get: 'fixtures',
      parameters: { date: '2026-10-27' },
      errors: {
        rateLimit: 'Too many requests. Your rate limit is 100 requests per day.'
      },
      results: 0,
      response: []
    };

    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => rateLimitPayload
    });

    await assert.rejects(
      fetchApiSports('v3.football.api-sports.io', '/fixtures?date=2026-10-27', { maxRetries: 0 }),
      (err) => {
        assert.strictEqual(err.name, 'ApiSportsError');
        assert.strictEqual(err.statusCode, 429);
        assert.strictEqual(err.isRateLimit, true);
        assert.match(err.message, /rate limit/i);
        return true;
      }
    );
  });

  it('detects token/auth errors disguised in HTTP 200 OK envelope', async () => {
    const authErrorPayload = {
      get: 'fixtures',
      parameters: {},
      errors: {
        token: 'Error/ApiKey Invalid'
      },
      results: 0,
      response: []
    };

    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => authErrorPayload
    });

    await assert.rejects(
      fetchApiSports('v3.football.api-sports.io', '/fixtures', { maxRetries: 0 }),
      (err) => {
        assert.strictEqual(err.name, 'ApiSportsError');
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.isAuthError, true);
        return true;
      }
    );
  });

  it('throws ApiSportsError on HTTP 429 response', async () => {
    global.fetch = async () => ({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests'
    });

    await assert.rejects(
      fetchApiSports('v3.football.api-sports.io', '/fixtures', { maxRetries: 0 }),
      (err) => {
        assert.strictEqual(err.name, 'ApiSportsError');
        assert.strictEqual(err.statusCode, 429);
        assert.strictEqual(err.isRateLimit, true);
        return true;
      }
    );
  });

  it('throws ApiSportsError on HTTP 500 error after retries', async () => {
    let callCount = 0;
    global.fetch = async () => {
      callCount++;
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Provider crash'
      };
    };

    await assert.rejects(
      fetchApiSports('v3.football.api-sports.io', '/fixtures', { maxRetries: 1, backoffBaseMs: 10 }),
      (err) => {
        assert.strictEqual(err.name, 'ApiSportsError');
        assert.strictEqual(err.statusCode, 500);
        return true;
      }
    );

    assert.strictEqual(callCount, 2); // Initial attempt + 1 retry
  });

  it('throws on malformed response missing response array', async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: 'data' })
    });

    await assert.rejects(
      fetchApiSports('v3.football.api-sports.io', '/fixtures', { maxRetries: 0 }),
      (err) => {
        assert.strictEqual(err.name, 'ApiSportsError');
        assert.strictEqual(err.statusCode, 502);
        return true;
      }
    );
  });
});

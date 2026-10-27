import { fetchApiSports, ApiSportsError } from './apiClient.js';
import { normalizeMatchStatus } from '../../utils/statusNormalizer.js';
import { upsertMatches, getMatches } from '../matchService.js';
import { fetchEspnSoccerMatches, fetchEspnSoccerEvents } from './espnService.js';

const DOMAIN = process.env.API_SPORTS_FOOTBALL_DOMAIN || 'v3.football.api-sports.io';
const CACHE_TTL = parseInt(process.env.MATCH_CACHE_TTL_MS || '60000', 10);

let lastFetchTime = 0;
let inFlightFetch = null;
const richMatchCache = new Map();

function normalizeFixture(fixtureData) {
    const rawStatus = fixtureData.fixture?.status?.short;
    const normalized = normalizeMatchStatus(rawStatus, 'football');

    return {
        id: fixtureData.fixture.id,
        externalId: fixtureData.fixture.id,
        sport: 'football',
        homeTeam: fixtureData.teams.home.name,
        awayTeam: fixtureData.teams.away.name,
        status: normalized.dbStatus,
        statusDetail: normalized.detailedStatus,
        displayText: normalized.displayText,
        isInPlay: normalized.isInPlay,
        startTime: fixtureData.fixture.date ? new Date(fixtureData.fixture.date) : null,
        endTime: null,
        homeScore: fixtureData.goals?.home ?? 0,
        awayScore: fixtureData.goals?.away ?? 0,
        leagueName: fixtureData.league?.name || null,
        leagueLogo: fixtureData.league?.logo || null,
        homeLogo: fixtureData.teams?.home?.logo || null,
        awayLogo: fixtureData.teams?.away?.logo || null,
        venue: fixtureData.fixture?.venue?.name || null,
        elapsed: fixtureData.fixture?.status?.elapsed || null,
        league: fixtureData.league,
        teamsInfo: fixtureData.teams,
        fixtureInfo: fixtureData.fixture
    };
}

function enrichDbMatch(dbMatch) {
    const rich = richMatchCache.get(dbMatch.externalId);
    return {
        ...dbMatch,
        id: dbMatch.id || dbMatch.externalId,
        league: rich?.league || {
            name: dbMatch.leagueName,
            logo: dbMatch.leagueLogo
        },
        teamsInfo: rich?.teamsInfo || {
            home: { name: dbMatch.homeTeam, logo: dbMatch.homeLogo },
            away: { name: dbMatch.awayTeam, logo: dbMatch.awayLogo }
        },
        fixtureInfo: rich?.fixtureInfo || {
            venue: { name: dbMatch.venue },
            status: {
                short: dbMatch.statusDetail || dbMatch.status,
                elapsed: dbMatch.elapsed
            }
        }
    };
}

export const getFootballMatches = async (forceRefresh = false) => {
    const now = Date.now();

    // 1. Serve fresh data from PostgreSQL cache if within TTL, fallback to in-memory cache
    if (!forceRefresh && (now - lastFetchTime < CACHE_TTL)) {
        console.log("⚽ [FootballService] Serving fixtures from Cache.");
        const dbMatches = await getMatches('football', 100);
        if (dbMatches && dbMatches.length > 0) {
            return dbMatches.map(enrichDbMatch);
        }
        if (richMatchCache.size > 0) {
            return Array.from(richMatchCache.values()).map(enrichDbMatch);
        }
    }

    // 2. In-flight request deduplication
    if (inFlightFetch) {
        console.log("⚽ [FootballService] Joining in-flight fetch request...");
        return await inFlightFetch;
    }

    inFlightFetch = (async () => {
        console.log("⚽ [FootballService] Fetching from API-SPORTS...");
        try {
            const todayUtc = new Date().toISOString().split('T')[0];

            // Primary query: today's fixtures
            const fixturesJson = await fetchApiSports(DOMAIN, `/fixtures?date=${todayUtc}`);
            const rawFixtures = fixturesJson.response || [];

            // Secondary live query: live fixtures across competitions
            let rawLiveFixtures = [];
            try {
                const liveJson = await fetchApiSports(DOMAIN, `/fixtures?live=all`);
                if (Array.isArray(liveJson.response)) {
                    rawLiveFixtures = liveJson.response;
                }
            } catch (liveErr) {
                console.warn(`[FootballService] /fixtures?live=all unavailable: ${liveErr.message}. Relying on date fixtures.`);
            }

            const fixtureMap = new Map();
            for (const f of rawFixtures) {
                fixtureMap.set(f.fixture.id, f);
            }
            for (const f of rawLiveFixtures) {
                fixtureMap.set(f.fixture.id, f);
            }

            const combinedFixtures = Array.from(fixtureMap.values());
            console.log(`⚽ [FootballService] Received ${combinedFixtures.length} total fixtures (${rawLiveFixtures.length} live).`);

            const normalizedFixtures = combinedFixtures.map(normalizeFixture);
            for (const f of normalizedFixtures) {
                richMatchCache.set(f.externalId, f);
            }

            let cachedMatches = normalizedFixtures;
            try {
                cachedMatches = await upsertMatches(normalizedFixtures);
            } catch (dbErr) {
                console.warn(`[FootballService] PostgreSQL unavailable: ${dbErr.message}. Serving normalized in-memory data.`);
            }
            lastFetchTime = Date.now();

            return cachedMatches.map(enrichDbMatch);
        } catch (err) {
            console.error(`⚽ [FootballService] API-SPORTS fetch failed: ${err.message}.`);

            // Automated fallback to ESPN Open Soccer feed (100% free, no key required)
            console.log(`⚽ [FootballService] Attempting ESPN Open Soccer fallback...`);
            try {
                const espnMatches = await fetchEspnSoccerMatches();
                if (espnMatches.length > 0) {
                    console.log(`⚽ [FootballService] Loaded ${espnMatches.length} matches from ESPN Open Soccer.`);
                    for (const f of espnMatches) {
                        richMatchCache.set(f.externalId, f);
                    }
                    let cachedMatches = espnMatches;
                    try {
                        cachedMatches = await upsertMatches(espnMatches);
                    } catch (dbErr) {
                        console.warn(`[FootballService] PostgreSQL unavailable: ${dbErr.message}.`);
                    }
                    lastFetchTime = Date.now();
                    return cachedMatches.map(enrichDbMatch);
                }
            } catch (espnErr) {
                console.warn(`[FootballService] ESPN fallback error: ${espnErr.message}`);
            }

            // Fallback to last known PostgreSQL data or memory
            const fallbackMatches = await getMatches('football', 100);
            if (fallbackMatches && fallbackMatches.length > 0) {
                console.warn(`⚽ [FootballService] Serving ${fallbackMatches.length} matches from PostgreSQL cache.`);
                return fallbackMatches.map(m => ({
                    ...enrichDbMatch(m),
                    isStale: true,
                    fetchError: err.message
                }));
            }

            if (richMatchCache.size > 0) {
                return Array.from(richMatchCache.values()).map(enrichDbMatch);
            }

            throw err;
        } finally {
            inFlightFetch = null;
        }
    })();

    return await inFlightFetch;
};

export const getFootballEvents = async (externalFixtureId) => {
    if (!externalFixtureId) return [];

    try {
        const json = await fetchApiSports(DOMAIN, `/fixtures/events?fixture=${externalFixtureId}`);
        const events = json.response || [];

        if (events.length > 0) {
            return events.map((eventData, index) => {
                let eventType = 'event';
                const typeStr = (eventData.type || '').toLowerCase();
                const detailStr = (eventData.detail || '').toLowerCase();

                if (typeStr === 'goal') {
                    if (detailStr.includes('penalty')) eventType = 'penalty';
                    else if (detailStr.includes('own goal')) eventType = 'own_goal';
                    else eventType = 'goal';
                } else if (typeStr === 'card') {
                    if (detailStr.includes('yellow')) eventType = 'yellow_card';
                    else if (detailStr.includes('red')) eventType = 'red_card';
                    else eventType = 'card';
                } else if (typeStr === 'subst') {
                    eventType = 'substitution';
                } else if (typeStr === 'var') {
                    eventType = 'var';
                }

                const playerName = eventData.player?.name || null;
                const assistName = eventData.assist?.name || null;
                const teamName = eventData.team?.name || null;

                let message = `${eventData.type}: ${eventData.detail}`;
                if (playerName) message += ` by ${playerName}`;
                if (assistName) message += ` (Assist: ${assistName})`;

                const elapsed = eventData.time?.elapsed || 0;
                const safeExternalId = Math.abs(((Number(externalFixtureId % 100000) * 31 + elapsed * 17 + index) % 2147483640) + 1);

                return {
                    externalId: safeExternalId,
                    minute: elapsed,
                    sequence: index,
                    period: eventData.time?.extra ? 'Extra Time' : 'Normal',
                    eventType,
                    actor: playerName,
                    team: teamName,
                    message,
                    metadata: {
                        detail: eventData.detail,
                        comments: eventData.comments
                    }
                };
            });
        }

        // If no events from API-SPORTS, check ESPN
        const espnEvents = await fetchEspnSoccerEvents(externalFixtureId);
        return espnEvents;
    } catch (err) {
        console.warn(`[FootballService] Error fetching events for ${externalFixtureId}: ${err.message}. Checking ESPN fallback.`);
        const espnEvents = await fetchEspnSoccerEvents(externalFixtureId);
        return espnEvents;
    }
};

export const findFootballMatchInMemory = (id) => {
    const numId = Number(id);
    for (const match of richMatchCache.values()) {
        if (match.id === numId || match.externalId === numId) {
            return enrichDbMatch(match);
        }
    }
    return null;
};

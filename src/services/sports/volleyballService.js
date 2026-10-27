import { fetchApiSports } from './apiClient.js';
import { normalizeMatchStatus } from '../../utils/statusNormalizer.js';
import { upsertMatches, getMatches } from '../matchService.js';

const DOMAIN = process.env.API_SPORTS_VOLLEYBALL_DOMAIN || 'v1.volleyball.api-sports.io';
const CACHE_TTL = parseInt(process.env.MATCH_CACHE_TTL_MS || '60000', 10);

let lastFetchTime = 0;
let inFlightFetch = null;
const richMatchCache = new Map();

function enrichDbMatch(dbMatch) {
    const richData = richMatchCache.get(dbMatch.externalId);
    return {
        ...dbMatch,
        id: dbMatch.id || dbMatch.externalId,
        league: richData?.league || { name: dbMatch.leagueName, logo: dbMatch.leagueLogo },
        teamsInfo: richData?.teamsInfo || {
            home: { name: dbMatch.homeTeam, logo: dbMatch.homeLogo },
            away: { name: dbMatch.awayTeam, logo: dbMatch.awayLogo }
        },
        fixtureInfo: richData?.fixtureInfo || {
            venue: { name: dbMatch.venue },
            status: { short: dbMatch.statusDetail || dbMatch.status },
            scores: { home: dbMatch.homeScore, away: dbMatch.awayScore }
        }
    };
}

export const getVolleyballMatches = async (forceRefresh = false) => {
    const now = Date.now();
    
    if (!forceRefresh && (now - lastFetchTime < CACHE_TTL)) {
        console.log("🏐 [VolleyballService] Returning fixtures from Cache.");
        const dbMatches = await getMatches('volleyball', 100);
        if (dbMatches && dbMatches.length > 0) {
            return dbMatches.map(enrichDbMatch);
        }
        if (richMatchCache.size > 0) {
            return Array.from(richMatchCache.values()).map(enrichDbMatch);
        }
    }

    if (inFlightFetch) return await inFlightFetch;

    inFlightFetch = (async () => {
        console.log("🏐 [VolleyballService] Fetching volleyball data...");
        try {
            const today = new Date().toISOString().split('T')[0];
            const json = await fetchApiSports(DOMAIN, `/games?date=${today}`);
            const games = json.response || [];
            
            const fixtures = games.map(gameData => {
                const normalized = normalizeMatchStatus(gameData.status?.short, 'volleyball');
                const fixture = {
                    id: gameData.id,
                    externalId: gameData.id,
                    sport: 'volleyball',
                    homeTeam: gameData.teams.home.name,
                    awayTeam: gameData.teams.away.name,
                    status: normalized.dbStatus,
                    statusDetail: normalized.detailedStatus,
                    displayText: normalized.displayText,
                    isInPlay: normalized.isInPlay,
                    startTime: gameData.date ? new Date(gameData.date) : null,
                    endTime: null,
                    homeScore: gameData.scores?.home ?? 0,
                    awayScore: gameData.scores?.away ?? 0,
                    leagueName: gameData.league?.name || null,
                    leagueLogo: gameData.league?.logo || null,
                    homeLogo: gameData.teams?.home?.logo || null,
                    awayLogo: gameData.teams?.away?.logo || null,
                    venue: gameData.country?.name || null,
                    league: gameData.league,
                    teamsInfo: gameData.teams,
                    fixtureInfo: {
                        venue: gameData.country,
                        status: gameData.status,
                        scores: gameData.scores
                    }
                };
                richMatchCache.set(gameData.id, fixture);
                return fixture;
            });

            let cachedMatches = fixtures;
            try {
                cachedMatches = await upsertMatches(fixtures);
            } catch (dbErr) {
                console.warn(`[VolleyballService] PostgreSQL unavailable: ${dbErr.message}`);
            }
            lastFetchTime = Date.now();
            return cachedMatches.map(enrichDbMatch);
        } catch (err) {
            console.error("Error in getVolleyballMatches:", err.message);
            const fallbackMatches = await getMatches('volleyball', 100);
            if (fallbackMatches && fallbackMatches.length > 0) {
                return fallbackMatches.map(m => ({ ...enrichDbMatch(m), isStale: true, fetchError: err.message }));
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

export const getVolleyballEvents = async () => [];

export const findVolleyballMatchInMemory = (id) => {
    const numId = Number(id);
    for (const match of richMatchCache.values()) {
        if (match.id === numId || match.externalId === numId) {
            return enrichDbMatch(match);
        }
    }
    return null;
};

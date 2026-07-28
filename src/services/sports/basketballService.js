import { MATCH_STATUS } from '../../validation/matches.js';
import { fetchApiSports } from './apiClient.js';
import { upsertMatches, getMatches } from '../matchService.js';

const DOMAIN = process.env.API_SPORTS_BASKETBALL_DOMAIN || 'v1.basketball.api-sports.io';

const mapStatus = (statusShort) => {
    const scheduled = ['NS', 'TBD'];
    const live = ['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'BT', 'HT', 'LIVE'];
    const finished = ['FT', 'AOT', 'POST', 'CANC', 'AW', 'WO', 'ABD'];

    if (live.includes(statusShort)) return MATCH_STATUS.LIVE;
    if (finished.includes(statusShort)) return MATCH_STATUS.FINISHED;
    return MATCH_STATUS.SCHEDULED;
};

let lastFetchTime = 0;
const CACHE_TTL = 60000; // 60 seconds
const richMatchCache = new Map(); // In-memory cache for rich API data

export const getBasketballMatches = async () => {
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - lastFetchTime < CACHE_TTL) {
        console.log("🏀 [BasketballService] Returning fixtures from PostgreSQL Cache.");
        const dbMatches = await getMatches('basketball', 100);
        
        return dbMatches.map(dbMatch => {
            const richData = richMatchCache.get(dbMatch.externalId);
            return {
                ...dbMatch,
                league: richData?.league,
                teamsInfo: richData?.teams,
                fixtureInfo: {
                    venue: richData?.country, // Usually country/city
                    status: richData?.status,
                    scores: richData?.scores,
                    timer: richData?.status?.timer
                }
            };
        });
    }

    console.log("🏀 [BasketballService] Cache stale. Fetching live API-SPORTS data...");
    try {
        // Fetch today's fixtures
        const today = new Date().toISOString().split('T')[0];
        const json = await fetchApiSports(DOMAIN, `/games?date=${today}`);
        
        json.response.forEach(gameData => {
            richMatchCache.set(gameData.id, gameData);
        });
        
        const fixtures = json.response.map(gameData => {
            return {
                externalId: gameData.id,
                sport: 'basketball',
                homeTeam: gameData.teams.home.name,
                awayTeam: gameData.teams.away.name,
                status: mapStatus(gameData.status.short),
                startTime: new Date(gameData.date),
                endTime: null, 
                homeScore: gameData.scores.home.total ?? 0,
                awayScore: gameData.scores.away.total ?? 0,
            };
        });

        // Cache the data in PostgreSQL
        const cachedMatches = await upsertMatches(fixtures);
        
        // Update last fetch time
        lastFetchTime = now;
        
        // Merge rich data before returning
        return cachedMatches.map(dbMatch => {
            const richData = richMatchCache.get(dbMatch.externalId);
            return {
                ...dbMatch,
                league: richData?.league,
                teamsInfo: richData?.teams,
                fixtureInfo: {
                    venue: richData?.country,
                    status: richData?.status,
                    scores: richData?.scores,
                    timer: richData?.status?.timer
                }
            };
        });
    } catch (err) {
        console.error("Error in getBasketballMatches:", err);
        throw err;
    }
};

export const getBasketballEvents = async (externalFixtureId) => {
    // API-SPORTS Basketball doesn't typically have a dedicated robust live commentary events endpoint 
    // for all games. We will return an empty array or basic summary text here for now.
    return [];
};

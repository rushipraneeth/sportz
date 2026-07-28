import { MATCH_STATUS } from '../../validation/matches.js';
import { fetchApiSports } from './apiClient.js';
import { upsertMatches, getMatches } from '../matchService.js';

const DOMAIN = process.env.API_SPORTS_VOLLEYBALL_DOMAIN || 'v1.volleyball.api-sports.io';

const mapStatus = (statusShort) => {
    const scheduled = ['NS', 'TBD'];
    const live = ['S1', 'S2', 'S3', 'S4', 'S5', 'LIVE'];
    const finished = ['FT', 'AW', 'POST', 'CANC', 'ABD', 'WO'];

    if (live.includes(statusShort)) return MATCH_STATUS.LIVE;
    if (finished.includes(statusShort)) return MATCH_STATUS.FINISHED;
    return MATCH_STATUS.SCHEDULED;
};

let lastFetchTime = 0;
const CACHE_TTL = 60000;
const richMatchCache = new Map();

export const getVolleyballMatches = async () => {
    const now = Date.now();
    
    if (now - lastFetchTime < CACHE_TTL) {
        console.log("🏐 [VolleyballService] Returning fixtures from PostgreSQL Cache.");
        const dbMatches = await getMatches('volleyball', 100);
        
        return dbMatches.map(dbMatch => {
            const richData = richMatchCache.get(dbMatch.externalId);
            return {
                ...dbMatch,
                league: richData?.league,
                teamsInfo: richData?.teams,
                fixtureInfo: {
                    venue: richData?.country,
                    status: richData?.status,
                    scores: richData?.scores
                }
            };
        });
    }

    console.log("🏐 [VolleyballService] Cache stale. Fetching live API-SPORTS data...");
    try {
        const today = new Date().toISOString().split('T')[0];
        const json = await fetchApiSports(DOMAIN, `/games?date=${today}`);
        
        json.response.forEach(gameData => {
            richMatchCache.set(gameData.id, gameData);
        });
        
        const fixtures = json.response.map(gameData => {
            return {
                externalId: gameData.id,
                sport: 'volleyball',
                homeTeam: gameData.teams.home.name,
                awayTeam: gameData.teams.away.name,
                status: mapStatus(gameData.status.short),
                startTime: new Date(gameData.date),
                endTime: null, 
                homeScore: gameData.scores.home ?? 0,
                awayScore: gameData.scores.away ?? 0,
            };
        });

        const cachedMatches = await upsertMatches(fixtures);
        lastFetchTime = now;
        
        return cachedMatches.map(dbMatch => {
            const richData = richMatchCache.get(dbMatch.externalId);
            return {
                ...dbMatch,
                league: richData?.league,
                teamsInfo: richData?.teams,
                fixtureInfo: {
                    venue: richData?.country,
                    status: richData?.status,
                    scores: richData?.scores
                }
            };
        });
    } catch (err) {
        console.error("Error in getVolleyballMatches:", err);
        throw err;
    }
};

export const getVolleyballEvents = async (externalFixtureId) => {
    return [];
};

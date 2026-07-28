import { MATCH_STATUS } from '../../validation/matches.js';
import { fetchApiSports } from './apiClient.js';
import { upsertMatches, getMatches } from '../matchService.js';

const DOMAIN = process.env.API_SPORTS_HOCKEY_DOMAIN || 'v1.hockey.api-sports.io';

const mapStatus = (statusShort) => {
    const scheduled = ['NS', 'TBD'];
    const live = ['P1', 'P2', 'P3', 'OT', 'PT', 'SO', 'LIVE'];
    const finished = ['FT', 'AOT', 'AP', 'POST', 'CANC', 'ABD', 'AW', 'WO'];

    if (live.includes(statusShort)) return MATCH_STATUS.LIVE;
    if (finished.includes(statusShort)) return MATCH_STATUS.FINISHED;
    return MATCH_STATUS.SCHEDULED;
};

let lastFetchTime = 0;
const CACHE_TTL = 60000;
const richMatchCache = new Map();

export const getHockeyMatches = async () => {
    const now = Date.now();
    
    if (now - lastFetchTime < CACHE_TTL) {
        console.log("🏒 [HockeyService] Returning fixtures from PostgreSQL Cache.");
        const dbMatches = await getMatches('hockey', 100);
        
        return dbMatches.map(dbMatch => {
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
    }

    console.log("🏒 [HockeyService] Cache stale. Fetching live API-SPORTS data...");
    try {
        const today = new Date().toISOString().split('T')[0];
        const json = await fetchApiSports(DOMAIN, `/games?date=${today}`);
        
        json.response.forEach(gameData => {
            richMatchCache.set(gameData.id, gameData);
        });
        
        const fixtures = json.response.map(gameData => {
            return {
                externalId: gameData.id,
                sport: 'hockey',
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
                    scores: richData?.scores,
                    timer: richData?.status?.timer
                }
            };
        });
    } catch (err) {
        console.error("Error in getHockeyMatches:", err);
        throw err;
    }
};

export const getHockeyEvents = async (externalFixtureId) => {
    return [];
};

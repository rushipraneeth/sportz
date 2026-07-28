import { MATCH_STATUS } from '../../validation/matches.js';
import { fetchApiSports } from './apiClient.js';

const DOMAIN = process.env.API_SPORTS_FOOTBALL_DOMAIN || 'v3.football.api-sports.io';

/**
 * Maps API-SPORTS status short strings to our internal statuses.
 */
const mapStatus = (statusShort) => {
    // API-SPORTS statuses: https://www.api-football.com/documentation-v3#responses-status
    const scheduled = ['TBD', 'NS'];
    const live = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'];
    const finished = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];

    if (live.includes(statusShort)) return MATCH_STATUS.LIVE;
    if (finished.includes(statusShort)) return MATCH_STATUS.FINISHED;
    return MATCH_STATUS.SCHEDULED;
};

import { upsertMatches, getMatches } from '../matchService.js';

let lastFetchTime = 0;
const CACHE_TTL = 60000; // 60 seconds
const richMatchCache = new Map(); // In-memory cache for rich API data (logos, venue, etc.)

export const getFootballMatches = async () => {
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - lastFetchTime < CACHE_TTL) {
        console.log("⚽ [FootballService] Returning fixtures from PostgreSQL Cache.");
        // Fetch from DB using matchService
        const dbMatches = await getMatches('football', 100);
        
        // Merge rich data from memory
        return dbMatches.map(dbMatch => {
            const richData = richMatchCache.get(dbMatch.externalId);
            return {
                ...dbMatch,
                league: richData?.league,
                teamsInfo: richData?.teams,
                fixtureInfo: richData?.fixture
            };
        });
    }

    console.log("⚽ [FootballService] Cache stale. Fetching live API-SPORTS data...");
    try {
        // Fetch today's fixtures
        const today = new Date().toISOString().split('T')[0];
        const json = await fetchApiSports(DOMAIN, `/fixtures?date=${today}`);
        
        json.response.forEach(fixtureData => {
            richMatchCache.set(fixtureData.fixture.id, fixtureData);
        });
        
        const fixtures = json.response.map(fixtureData => {
            return {
                externalId: fixtureData.fixture.id,
                sport: 'football',
                homeTeam: fixtureData.teams.home.name,
                awayTeam: fixtureData.teams.away.name,
                status: mapStatus(fixtureData.fixture.status.short),
                startTime: new Date(fixtureData.fixture.date),
                endTime: null, 
                homeScore: fixtureData.goals.home ?? 0,
                awayScore: fixtureData.goals.away ?? 0,
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
                fixtureInfo: richData?.fixture
            };
        });
    } catch (err) {
        console.error("Error in getFootballMatches:", err);
        throw err;
    }
};

export const getFootballEvents = async (externalFixtureId) => {
    try {
        const json = await fetchApiSports(DOMAIN, `/fixtures/events?fixture=${externalFixtureId}`);
        
        return json.response.map((eventData, index) => {
            // Map API-SPORTS event to our commentary format
            let eventType = 'event';
            if (eventData.type === 'Goal') {
                if (eventData.detail.toLowerCase().includes('penalty')) eventType = 'penalty';
                else if (eventData.detail.toLowerCase().includes('own goal')) eventType = 'own_goal';
                else eventType = 'goal';
            }
            else if (eventData.type === 'Card') {
                if (eventData.detail.toLowerCase().includes('yellow')) eventType = 'yellow_card';
                else if (eventData.detail.toLowerCase().includes('red')) eventType = 'red_card';
                else eventType = 'card';
            }
            else if (eventData.type === 'subst') eventType = 'substitution';
            else if (eventData.type === 'Var') eventType = 'var';

            const playerName = eventData.player?.name;
            const assistName = eventData.assist?.name;
            const teamName = eventData.team?.name;

            let message = `${eventData.type}: ${eventData.detail}`;
            if (playerName) {
                message += ` by ${playerName}`;
            }
            if (assistName) {
                message += ` (Assist: ${assistName})`;
            }

            return {
                // we create a synthetic external ID for events using fixture ID, event time, and index
                externalId: parseInt(`${externalFixtureId}${eventData.time?.elapsed || 0}${index}`),
                minute: eventData.time?.elapsed || 0,
                sequence: index,
                period: eventData.time?.extra ? `Extra Time` : `Normal`,
                eventType: eventType,
                actor: playerName || null,
                team: teamName || null,
                message: message,
                metadata: {
                    detail: eventData.detail,
                    comments: eventData.comments
                }
            };
        });
    } catch (err) {
        console.error(`Error in getFootballEvents for ${externalFixtureId}:`, err);
        return [];
    }
};

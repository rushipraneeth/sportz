import { getFootballMatches, getFootballEvents, findFootballMatchInMemory } from './footballService.js';
import { getBasketballMatches, getBasketballEvents, findBasketballMatchInMemory } from './basketballService.js';
import { getVolleyballMatches, getVolleyballEvents, findVolleyballMatchInMemory } from './volleyballService.js';
import { getHockeyMatches, getHockeyEvents, findHockeyMatchInMemory } from './hockeyService.js';

class SportsProvider {
    constructor() {
        this.services = {
            football: {
                getMatches: getFootballMatches,
                getMatchEvents: getFootballEvents,
                findMatchInMemory: findFootballMatchInMemory
            },
            basketball: {
                getMatches: getBasketballMatches,
                getMatchEvents: getBasketballEvents,
                findMatchInMemory: findBasketballMatchInMemory
            },
            volleyball: {
                getMatches: getVolleyballMatches,
                getMatchEvents: getVolleyballEvents,
                findMatchInMemory: findVolleyballMatchInMemory
            },
            hockey: {
                getMatches: getHockeyMatches,
                getMatchEvents: getHockeyEvents,
                findMatchInMemory: findHockeyMatchInMemory
            }
        };
    }

    /**
     * Get matches for a given sport (with caching and optional forced refresh).
     * @param {string} sport - e.g., 'football'
     * @param {boolean} forceRefresh
     */
    async getMatches(sport = 'football', forceRefresh = false) {
        const service = this.services[(sport || 'football').toLowerCase()];
        if (!service) {
            throw new Error(`Sport '${sport}' is not supported yet.`);
        }
        return await service.getMatches(forceRefresh);
    }

    /**
     * Get match events (commentary) for a given sport and match ID.
     * @param {string} sport 
     * @param {string|number} externalId 
     */
    async getMatchEvents(sport = 'football', externalId) {
        const service = this.services[(sport || 'football').toLowerCase()];
        if (!service) {
            throw new Error(`Sport '${sport}' is not supported yet.`);
        }
        return await service.getMatchEvents(externalId);
    }

    /**
     * Finds a match by internal id or externalId across all in-memory caches.
     * @param {number|string} id 
     */
    findMatchById(id) {
        return findFootballMatchInMemory(id) ||
               findBasketballMatchInMemory(id) ||
               findHockeyMatchInMemory(id) ||
               findVolleyballMatchInMemory(id) ||
               null;
    }
}

export const sportsProvider = new SportsProvider();

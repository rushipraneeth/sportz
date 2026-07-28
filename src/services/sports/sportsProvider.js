import { getFootballMatches, getFootballEvents } from './footballService.js';
import { getBasketballMatches, getBasketballEvents } from './basketballService.js';
import { getVolleyballMatches, getVolleyballEvents } from './volleyballService.js';
import { getHockeyMatches, getHockeyEvents } from './hockeyService.js';

class SportsProvider {
    constructor() {
        this.services = {
            football: {
                getMatches: getFootballMatches,
                getMatchEvents: getFootballEvents
            },
            basketball: {
                getMatches: getBasketballMatches,
                getMatchEvents: getBasketballEvents
            },
            volleyball: {
                getMatches: getVolleyballMatches,
                getMatchEvents: getVolleyballEvents
            },
            hockey: {
                getMatches: getHockeyMatches,
                getMatchEvents: getHockeyEvents
            }
        };
    }

    /**
     * Get matches for a given sport (with caching).
     * @param {string} sport - e.g., 'football'
     */
    async getMatches(sport) {
        const service = this.services[sport.toLowerCase()];
        if (!service) {
            throw new Error(`Sport '${sport}' is not supported yet.`);
        }
        return await service.getMatches();
    }

    /**
     * Get match events (commentary) for a given sport and match ID.
     * @param {string} sport 
     * @param {string|number} externalId 
     */
    async getMatchEvents(sport, externalId) {
        const service = this.services[sport.toLowerCase()];
        if (!service) {
            throw new Error(`Sport '${sport}' is not supported yet.`);
        }
        return await service.getMatchEvents(externalId);
    }
}

export const sportsProvider = new SportsProvider();

import { matchIdParamSchema } from "../validation/matches.js";
import { listCommentaryQuerySchema, createCommentarySchema } from "../validation/commentary.js";
import * as matchService from "../services/matchService.js";

import { sportsProvider } from "../services/sports/sportsProvider.js";

const MAX_LIMIT = 100;

export const getCommentary = async (req, res) => {
    const paramsParsed = matchIdParamSchema.safeParse(req.params);
    if (!paramsParsed.success) {
        return res.status(400).json({
            error: "Invalid match ID.",
            details: paramsParsed.error
        });
    }

    const queryParsed = listCommentaryQuerySchema.safeParse(req.query);
    if (!queryParsed.success) {
        return res.status(400).json({
            error: "Invalid query.",
            details: queryParsed.error
        });
    }

    const limit = Math.min(queryParsed.data.limit ?? 100, MAX_LIMIT);
    const matchId = paramsParsed.data.id;

    try {
        const match = await matchService.getMatchById(matchId);
        if (!match) {
            return res.status(404).json({
                error: "Match not found",
                details: `No match found with ID ${matchId}`
            });
        }

        // Add requested backend logs
        console.log(`\n--- FETCHING EVENTS ---`);
        console.log(`Selected Match ID: ${matchId}, External ID: ${match.externalId}, Sport: ${match.sport}`);
        console.log(`API Endpoint: ${process.env.API_SPORTS_BASE_URL || 'https://v3.football.api-sports.io'}/fixtures/events?fixture=${match.externalId}`);
        
        let data = [];
        
        if (match.status === 'scheduled') {
            console.log("Match has not started yet. Returning empty events.");
        } else {
            // Fetch live match events from API-SPORTS
            data = await sportsProvider.getMatchEvents(match.sport, match.externalId);
            console.log(`Events Returned: ${data.length}`);
            
            // Attach fake IDs so the frontend can route them to the right match
            data = data.map(event => ({
                ...event,
                id: event.externalId,
                matchId: match.id
            }));
            
            // Limit the results if needed
            if (data.length > limit) {
                data = data.slice(0, limit);
            }
        }
        
        console.log(`-----------------------\n`);

        return res.json({ data });
    } catch (e) {
        console.error("GET /commentary error:", e);
        return res.status(500).json({
            error: "Failed to fetch commentary",
            details: "An unexpected error occurred"
        });
    }
};

export const createCommentary = async (req, res) => {
    const paramsParsed = matchIdParamSchema.safeParse(req.params);
    if (!paramsParsed.success) {
        return res.status(400).json({
            error: "Invalid match ID.",
            details: paramsParsed.error
        });
    }

    const bodyParsed = createCommentarySchema.safeParse(req.body);
    if (!bodyParsed.success) {
        return res.status(400).json({
            error: "Invalid payload.",
            details: bodyParsed.error
        });
    }

    const matchId = paramsParsed.data.id;

    try {
        const match = await matchService.getMatchById(matchId);
        if (!match) {
            return res.status(404).json({
                error: "Match not found.",
                details: `No match found with ID ${matchId}`
            });
        }

        const result = await matchService.createCommentary(matchId, bodyParsed.data);

        if (res.app.locals.broadcastCommentary) {
            res.app.locals.broadcastCommentary(result.matchId, result);
        }

        return res.status(201).json({
            data: result,
        });
    } catch (e) {
        console.error("POST /commentary error:", e);

        if (e.cause?.code === "23503") {
            return res.status(404).json({
                error: "Match not found.",
                details: `No match found with ID ${matchId}`,
            });
        }

        return res.status(500).json({
            error: "Failed to create commentary",
            details: "An unexpected error occurred",
        });
    }
};

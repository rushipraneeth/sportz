import { listMatchesQuerySchema, createMatchSchema } from "../validation/matches.js";
import * as matchService from "../services/matchService.js";

import { sportsProvider } from "../services/sports/sportsProvider.js";

const MAX_LIMIT = 100;

export const getMatches = async (req, res) => {
    const parsed = listMatchesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid query.",
            details: parsed.error
        });
    }

    const sport = parsed.data.sport || 'football'; // Default to football if not provided

    try {
        const data = await sportsProvider.getMatches(sport);
        return res.json({ data });
    } catch (e) {
        console.error(e);
        return res.status(500).json({
            error: "Failed to list matches",
            details: e.message
        });
    }
};

export const createMatch = async (req, res) => {
    const parsed = createMatchSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid payload.",
            details: parsed.error
        });
    }

    try {
        const event = await matchService.createMatch(parsed.data);

        if (res.app.locals.broadcastMatchCreated) {
            res.app.locals.broadcastMatchCreated(event);
        }

        return res.status(201).json({
            data: event,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({
            error: "Failed to create match",
            details: e.message
        });
    }
};

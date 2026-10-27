import { listMatchesQuerySchema, createMatchSchema } from "../validation/matches.js";
import * as matchService from "../services/matchService.js";
import { sportsProvider } from "../services/sports/sportsProvider.js";

export const getMatches = async (req, res) => {
    const parsed = listMatchesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid query parameters.",
            details: parsed.error.issues
        });
    }

    const sport = parsed.data.sport || 'football';
    const forceRefresh = Boolean(parsed.data.refresh);

    try {
        const data = await sportsProvider.getMatches(sport, forceRefresh);
        
        // Filter by status if query parameter is provided
        const filteredData = parsed.data.status 
            ? data.filter(m => m.status === parsed.data.status)
            : data;

        const isStale = data.some(m => m.isStale);
        const fetchError = data.find(m => m.fetchError)?.fetchError || null;

        return res.json({
            data: filteredData,
            meta: {
                total: filteredData.length,
                sport,
                isStale,
                fetchError,
                timestamp: new Date().toISOString()
            }
        });
    } catch (e) {
        console.error(`[MatchController] Error listing matches for ${sport}:`, e.message);
        
        const statusCode = e.statusCode || (e.isRateLimit ? 429 : 500);
        return res.status(statusCode).json({
            error: e.message || "Failed to list matches from provider.",
            statusCode,
            isRateLimit: Boolean(e.isRateLimit),
            isAuthError: Boolean(e.isAuthError),
            details: e.errors || null
        });
    }
};

export const createMatch = async (req, res) => {
    const parsed = createMatchSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid match payload.",
            details: parsed.error.issues
        });
    }

    try {
        const event = await matchService.createMatch(parsed.data);

        if (res.app.locals?.broadcastMatchCreated) {
            res.app.locals.broadcastMatchCreated(event);
        }

        return res.status(201).json({
            data: event,
        });
    } catch (e) {
        console.error("[MatchController] Error creating match:", e.message);
        return res.status(500).json({
            error: "Failed to create match",
            details: e.message
        });
    }
};

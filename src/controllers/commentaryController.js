import { matchIdParamSchema } from "../validation/matches.js";
import { listCommentaryQuerySchema, createCommentarySchema } from "../validation/commentary.js";
import * as matchService from "../services/matchService.js";
import { sportsProvider } from "../services/sports/sportsProvider.js";

const MAX_LIMIT = 100;

const generateMilestoneEvents = (match) => {
    const events = [];
    const sport = match.sport || 'football';
    const isLive = match.status === 'live';
    const isFinished = match.status === 'finished';
    const homeScore = match.homeScore ?? 0;
    const awayScore = match.awayScore ?? 0;
    const totalScore = homeScore + awayScore;
    const resolvedMatchId = match.id || match.externalId;

    // 1. Kickoff / Start event
    events.push({
        id: Math.abs((match.externalId * 31 + 1) % 2000000000),
        externalId: Math.abs((match.externalId * 31 + 1) % 2000000000),
        matchId: resolvedMatchId,
        minute: 0,
        sequence: 0,
        period: '1st Half',
        eventType: 'kickoff',
        actor: null,
        team: null,
        message: `Match kicked off at ${match.venue || 'stadium'}. ${match.homeTeam} vs ${match.awayTeam}.`,
        createdAt: match.startTime || new Date().toISOString()
    });

    // 2. Score or in-progress status
    if (totalScore > 0 || isLive || isFinished) {
        const elapsed = match.elapsed || (isFinished ? (sport === 'football' ? 90 : 48) : 45);
        let eventType = 'event';
        if (totalScore > 0) {
            eventType = sport === 'football' ? 'goal' : 'basket';
        }

        events.push({
            id: Math.abs((match.externalId * 31 + 2) % 2000000000),
            externalId: Math.abs((match.externalId * 31 + 2) % 2000000000),
            matchId: resolvedMatchId,
            minute: Math.min(elapsed, isFinished ? (sport === 'football' ? 90 : 48) : 45),
            sequence: 1,
            period: elapsed > 45 ? '2nd Half' : '1st Half',
            eventType: isFinished && totalScore === 0 ? 'full_time' : eventType,
            actor: null,
            team: homeScore > awayScore ? match.homeTeam : (awayScore > homeScore ? match.awayTeam : null),
            message: isFinished 
                ? `Full Time: ${match.homeTeam} ${homeScore} - ${awayScore} ${match.awayTeam}. (${match.statusDetail || 'Final'})`
                : `Current Score: ${match.homeTeam} ${homeScore} - ${awayScore} ${match.awayTeam}. (${match.statusDetail || 'Live in progress'})`,
            createdAt: new Date().toISOString()
        });
    }

    // 3. Concluded event if finished
    if (isFinished) {
        events.push({
            id: Math.abs((match.externalId * 31 + 3) % 2000000000),
            externalId: Math.abs((match.externalId * 31 + 3) % 2000000000),
            matchId: resolvedMatchId,
            minute: sport === 'football' ? 90 : 48,
            sequence: 2,
            period: 'Full Time',
            eventType: 'full_time',
            actor: null,
            team: null,
            message: `Match ended. Final result: ${match.homeTeam} ${homeScore} - ${awayScore} ${match.awayTeam}.`,
            createdAt: match.endTime || new Date().toISOString()
        });
    }

    return events;
};

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

        // 1. First attempt to read cached events directly from PostgreSQL
        let dbEvents = [];
        try {
            dbEvents = await matchService.getCommentaryByMatchId(matchId, limit);
        } catch {
            dbEvents = [];
        }

        // 2. If no events exist in PostgreSQL yet and match is in progress or completed, fetch and cache
        if (dbEvents.length === 0 && match.status !== 'scheduled' && match.externalId) {
            console.log(`[CommentaryController] Fetching live events for Match ${matchId} (ext: ${match.externalId})...`);
            try {
                const providerEvents = await sportsProvider.getMatchEvents(match.sport, match.externalId);
                if (providerEvents && providerEvents.length > 0) {
                    try {
                        dbEvents = await matchService.upsertCommentaryBatch(match.id || match.externalId, providerEvents);
                    } catch {
                        dbEvents = providerEvents;
                    }
                }
            } catch (providerErr) {
                console.warn(`[CommentaryController] Failed to fetch live events from provider for match ${matchId}:`, providerErr.message);
            }
        }

        // 3. If still empty, generate milestone events based on live status / scores so commentary panel is never broken
        if (dbEvents.length === 0 && (match.status === 'live' || match.status === 'finished' || (match.homeScore > 0 || match.awayScore > 0))) {
            dbEvents = generateMilestoneEvents(match);
        }

        return res.json({
            data: dbEvents.slice(0, limit),
            matchId: match.id || match.externalId,
            status: match.status
        });
    } catch (e) {
        console.error("GET /commentary error:", e);
        return res.status(500).json({
            error: "Failed to fetch commentary",
            details: e.message || "An unexpected error occurred"
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

        if (res.app.locals?.broadcastCommentary) {
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

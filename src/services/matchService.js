import { db } from "../db/db.js";
import { matches, commentary } from "../db/schema.js";
import { desc, asc, eq, or, sql, and } from "drizzle-orm";
import { normalizeMatchStatus } from "../utils/statusNormalizer.js";
import { getMatchStatus } from "../utils/match-status.js";
import { sportsProvider } from "./sports/sportsProvider.js";

/**
 * Retrieves matches from the database, prioritizing live matches first,
 * followed by scheduled matches (by start time), and completed matches.
 */
export const getMatches = async (sport, limit = 100, statusFilter = null) => {
    try {
        let query = db.select().from(matches);
        const conditions = [];

        if (sport) {
            conditions.push(eq(matches.sport, sport.toLowerCase()));
        }

        if (statusFilter) {
            conditions.push(eq(matches.status, statusFilter));
        }

        if (conditions.length > 0) {
            query = query.where(and(...conditions));
        }

        const statusPriority = sql`CASE 
            WHEN ${matches.status} = 'live' THEN 1 
            WHEN ${matches.status} = 'scheduled' THEN 2 
            ELSE 3 
        END`;

        return await query
            .orderBy(statusPriority, asc(matches.startTime), desc(matches.lastRefreshedAt))
            .limit(limit);
    } catch (err) {
        console.warn(`[MatchService] Database query unavailable: ${err.message}.`);
        return [];
    }
};

export const createMatch = async (matchData) => {
    const { startTime, endTime, homeScore, awayScore, status, sport } = matchData;
    
    // Normalize status if provided, or derive from timing
    let resolvedStatus = status;
    let resolvedDetail = matchData.statusDetail;

    if (status) {
        const normalized = normalizeMatchStatus(status, sport);
        resolvedStatus = normalized.dbStatus;
        resolvedDetail = normalized.detailedStatus;
    } else {
        resolvedStatus = getMatchStatus(startTime, endTime) || 'scheduled';
    }

    const [event] = await db
        .insert(matches)
        .values({
            ...matchData,
            status: resolvedStatus,
            statusDetail: resolvedDetail,
            startTime: startTime ? new Date(startTime) : null,
            endTime: endTime ? new Date(endTime) : null,
            homeScore: homeScore ?? 0,
            awayScore: awayScore ?? 0,
            lastRefreshedAt: new Date(),
        })
        .returning();

    return event;
};

export const getMatchById = async (id) => {
    const numId = Number(id);
    if (isNaN(numId)) return null;

    try {
        const [match] = await db
            .select()
            .from(matches)
            .where(or(eq(matches.id, numId), eq(matches.externalId, numId)))
            .limit(1);
        
        if (match) return match;
    } catch {
        // Fall back to memory cache
    }
    
    return sportsProvider.findMatchById(numId);
};

export const getMatchByExternalId = async (externalId) => {
    const numId = Number(externalId);
    if (isNaN(numId)) return null;

    try {
        const [match] = await db
            .select()
            .from(matches)
            .where(eq(matches.externalId, numId))
            .limit(1);
        
        if (match) return match;
    } catch {
        // Fall back to memory cache
    }
    
    return sportsProvider.findMatchById(numId);
};

/**
 * Upserts an array of normalized match records with atomic conflict handling.
 */
export const upsertMatches = async (matchesData) => {
    if (!matchesData || matchesData.length === 0) return [];
    
    try {
        const results = [];
        for (const match of matchesData) {
            const now = new Date();
            const [upserted] = await db.insert(matches)
                .values({
                    externalId: match.externalId,
                    sport: match.sport,
                    homeTeam: match.homeTeam,
                    awayTeam: match.awayTeam,
                    status: match.status,
                    statusDetail: match.statusDetail || null,
                    startTime: match.startTime ? new Date(match.startTime) : null,
                    endTime: match.endTime ? new Date(match.endTime) : null,
                    homeScore: match.homeScore ?? 0,
                    awayScore: match.awayScore ?? 0,
                    leagueName: match.leagueName || match.league?.name || null,
                    leagueLogo: match.leagueLogo || match.league?.logo || null,
                    homeLogo: match.homeLogo || match.teamsInfo?.home?.logo || null,
                    awayLogo: match.awayLogo || match.teamsInfo?.away?.logo || null,
                    venue: match.venue || match.fixtureInfo?.venue?.name || null,
                    elapsed: match.elapsed ?? match.fixtureInfo?.status?.elapsed ?? null,
                    lastRefreshedAt: now
                })
                .onConflictDoUpdate({
                    target: matches.externalId,
                    set: {
                        status: match.status,
                        statusDetail: match.statusDetail || sql`${matches.statusDetail}`,
                        homeScore: match.homeScore,
                        awayScore: match.awayScore,
                        endTime: match.endTime ? new Date(match.endTime) : sql`${matches.endTime}`,
                        leagueName: match.leagueName || match.league?.name || sql`${matches.leagueName}`,
                        leagueLogo: match.leagueLogo || match.league?.logo || sql`${matches.leagueLogo}`,
                        homeLogo: match.homeLogo || match.teamsInfo?.home?.logo || sql`${matches.homeLogo}`,
                        awayLogo: match.awayLogo || match.teamsInfo?.away?.logo || sql`${matches.awayLogo}`,
                        venue: match.venue || match.fixtureInfo?.venue?.name || sql`${matches.venue}`,
                        elapsed: match.elapsed ?? match.fixtureInfo?.status?.elapsed ?? sql`${matches.elapsed}`,
                        lastRefreshedAt: now
                    }
                })
                .returning();
            results.push(upserted);
        }
        return results;
    } catch (dbErr) {
        console.warn(`[MatchService] Database upsert unavailable (${dbErr.message}). Using normalized memory data.`);
        return matchesData;
    }
};

export const getCommentaryByMatchId = async (matchId, limit = 100) => {
    const numId = Number(matchId);
    if (isNaN(numId)) return [];

    try {
        return await db
            .select()
            .from(commentary)
            .where(or(eq(commentary.matchId, numId), eq(commentary.externalId, numId)))
            .orderBy(asc(commentary.minute), asc(commentary.sequence), asc(commentary.createdAt))
            .limit(limit);
    } catch {
        return [];
    }
};

export const createCommentary = async (matchId, commentaryData) => {
    const numId = Number(matchId);
    try {
        const [result] = await db
            .insert(commentary)
            .values({
                ...commentaryData,
                matchId: numId,
            })
            .returning();
            
        return result;
    } catch (err) {
        console.warn(`[MatchService] DB commentary insert unavailable (${err.message}). Returning memory commentary.`);
        return {
            id: Date.now() % 2000000000,
            matchId: numId,
            ...commentaryData,
            createdAt: new Date().toISOString()
        };
    }
};

export const upsertCommentaryBatch = async (matchId, events) => {
    if (!events || events.length === 0) return [];
    const numId = Number(matchId);

    try {
        const insertedEvents = [];
        for (const event of events) {
            if (event.externalId) {
                const [upserted] = await db.insert(commentary)
                    .values({
                        externalId: event.externalId,
                        matchId: numId,
                        minute: event.minute,
                        sequence: event.sequence,
                        period: event.period,
                        eventType: event.eventType,
                        actor: event.actor,
                        team: event.team,
                        message: event.message,
                        metadata: event.metadata,
                        tags: event.tags || null
                    })
                    .onConflictDoUpdate({
                        target: commentary.externalId,
                        set: {
                            message: event.message,
                            metadata: event.metadata,
                            actor: event.actor,
                            team: event.team
                        }
                    })
                    .returning();
                insertedEvents.push(upserted);
            } else {
                const [created] = await db.insert(commentary)
                    .values({
                        ...event,
                        matchId: numId
                    })
                    .returning();
                insertedEvents.push(created);
            }
        }
        return insertedEvents;
    } catch (err) {
        console.warn(`[MatchService] DB commentary upsert unavailable (${err.message}). Returning memory events.`);
        return events.map((e, idx) => ({
            ...e,
            id: e.id || e.externalId || (Date.now() + idx),
            matchId: numId
        }));
    }
};

import { db } from "../db/db.js";
import { matches, commentary } from "../db/schema.js";
import { desc, eq } from "drizzle-orm";
import { getMatchStatus } from "../utils/match-status.js";

export const getMatches = async (sport, limit) => {
    let query = db.select().from(matches);
    
    if (sport) {
        query = query.where(eq(matches.sport, sport));
    }
    
    return await query.orderBy(desc(matches.createdAt)).limit(limit);
};

export const createMatch = async (matchData) => {
    const { startTime, endTime, homeScore, awayScore } = matchData;

    const [event] = await db
        .insert(matches)
        .values({
            ...matchData,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            homeScore: homeScore ?? 0,
            awayScore: awayScore ?? 0,
            status: getMatchStatus(startTime, endTime),
        })
        .returning();

    return event;
};

export const getMatchById = async (id) => {
    const [match] = await db
        .select()
        .from(matches)
        .where(eq(matches.id, id))
        .limit(1);
    
    return match;
};

export const upsertMatches = async (matchesData) => {
    if (!matchesData || matchesData.length === 0) return [];
    
    // Drizzle doesn't have a simple bulk upsert with dynamic fields easily, so we can do it one by one or via transaction
    const results = [];
    for (const match of matchesData) {
        const [upserted] = await db.insert(matches)
            .values({
                externalId: match.externalId,
                sport: match.sport,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                status: match.status,
                startTime: match.startTime,
                endTime: match.endTime,
                homeScore: match.homeScore,
                awayScore: match.awayScore
            })
            .onConflictDoUpdate({
                target: matches.externalId,
                set: {
                    status: match.status,
                    homeScore: match.homeScore,
                    awayScore: match.awayScore,
                    endTime: match.endTime
                }
            })
            .returning();
        results.push(upserted);
    }
    return results;
};

export const getCommentaryByMatchId = async (matchId, limit) => {
    return await db
        .select()
        .from(commentary)
        .where(eq(commentary.matchId, matchId))
        .orderBy(desc(commentary.createdAt))
        .limit(limit);
};

export const createCommentary = async (matchId, commentaryData) => {
    const [result] = await db
        .insert(commentary)
        .values({
            ...commentaryData,
            matchId: matchId,
        })
        .returning();
        
    return result;
};

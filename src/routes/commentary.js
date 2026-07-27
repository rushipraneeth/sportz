import { Router } from "express";
import { db } from "../db/db.js";
import { commentary, matches } from "../db/schema.js";
import { createCommentarySchema, listCommentaryQuerySchema } from "../validation/commentary.js";
import { matchIdParamSchema } from "../validation/matches.js";
import { eq, desc } from "drizzle-orm";

export const commentaryRouter = Router({ mergeParams: true });

const MAX_LIMIT = 100;

// GET all commentary for a match
commentaryRouter.get("/", async (req, res) => {
    // Validate match ID from params
    const paramsParsed = matchIdParamSchema.safeParse(req.params);
    if (!paramsParsed.success) {
        return res.status(400).json({
            error: "Invalid match ID.",
            details: paramsParsed.error
        });
    }

    // Validate query
    const queryParsed = listCommentaryQuerySchema.safeParse(req.query);
    if (!queryParsed.success) {
        return res.status(400).json({
            error: "Invalid query.",
            details: queryParsed.error
        });
    }

    const limit = Math.min(queryParsed.data.limit ?? 100, MAX_LIMIT);

    try {
        const data = await db
            .select()
            .from(commentary)
            .where(eq(commentary.matchId, paramsParsed.data.id))
            .orderBy(desc(commentary.createdAt))
            .limit(limit);

        return res.json({
            data
        });
    } catch (e) {
        console.error("GET /commentary error:", e);

        return res.status(500).json({
            error: "Failed to fetch commentary",
            details: "An unexpected error occurred"
        });
    }
});

// POST a new commentary for a match
commentaryRouter.post("/", async (req, res) => {
    // Validate match ID from params
    const paramsParsed = matchIdParamSchema.safeParse(req.params);
    if (!paramsParsed.success) {
        return res.status(400).json({
            error: "Invalid match ID.",
            details: paramsParsed.error
        });
    }

    // Validate body
    const bodyParsed = createCommentarySchema.safeParse(req.body);
    if (!bodyParsed.success) {
        return res.status(400).json({
            error: "Invalid payload.",
            details: bodyParsed.error
        });
    }

    try {
        const [match] = await db
            .select()
            .from(matches)
            .where(eq(matches.id, paramsParsed.data.id))
            .limit(1);

        if (!match) {
            return res.status(404).json({
                error: "Match not found.",
                details: `No match found with ID ${paramsParsed.data.id}`
            });
        }

        console.log("1. About to insert into DB");

        const [result] = await db
            .insert(commentary)
            .values({
                ...bodyParsed.data,
                matchId: paramsParsed.data.id,
            })
            .returning();

        console.log("2. Insert complete");
        console.log(result);

        console.log("3. broadcastCommentary type:", typeof res.app.locals.broadcastCommentary);

        res.app.locals.broadcastCommentary(result.matchId, result);

        console.log("4. Broadcast finished");

        return res.status(201).json({
            data: result,
        });
    } catch (e) {
        console.error("POST /commentary error:", e);

        if (e.cause?.code === "23503") {
            return res.status(404).json({
                error: "Match not found.",
                details: `No match found with ID ${paramsParsed.data.id}`,
            });
        }

        return res.status(500).json({
            error: "Failed to create commentary",
            details: "An unexpected error occurred",
        });
    }
});

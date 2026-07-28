import { Router } from "express";
import * as commentaryController from "../controllers/commentaryController.js";

export const commentaryRouter = Router({ mergeParams: true });

// GET all commentary for a match
commentaryRouter.get("/", commentaryController.getCommentary);

// POST a new commentary for a match
commentaryRouter.post("/", commentaryController.createCommentary);

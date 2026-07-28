import { Router } from "express";
import * as matchController from "../controllers/matchController.js";

export const router = Router();

// GET all matches
router.get("/", matchController.getMatches);

// CREATE a match
router.post("/", matchController.createMatch);
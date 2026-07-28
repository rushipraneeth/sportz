import AgentAPI from "apminsight";

AgentAPI.config();
import express from "express";
import http from "http";
import { router } from "./routes/matches.js";
import { attachWebSocketServer } from "./ws/server.js";
import {securityMiddleware} from "./arcjet.js";
import {commentaryRouter} from "./routes/commentary.js";

import cors from "cors";

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || "0.0.0.0";
const app = express();
const server = http.createServer(app);
app.set("trust proxy", ["127.0.0.1", "10.0.0.0/8"]);

// Configure CORS
const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL // Placeholder for future Vercel domain
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g., curl, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from Express server!");
});
//
// app.use(securityMiddleware());

app.use("/matches", router);
app.use("/matches/:id/commentary", commentaryRouter);

const { broadcastMatchCreated,broadcastCommentary } = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastCommentary = broadcastCommentary;

import { startPolling } from './services/polling/pollingService.js';
startPolling(app.locals);


server.on("error", (error) => {
  console.error("HTTP Server Error:", error);
});

server.listen(PORT, HOST, () => {
  const resolvedPort = server.address().port;
  const baseURL =
      HOST === "0.0.0.0"
          ? `http://localhost:${resolvedPort}`
          : `http://${HOST}:${resolvedPort}`;

  console.log(`Server is running on ${baseURL}`);
  console.log(
      `WebSocket Server is running on ${baseURL.replace("http", "ws")}/ws`
  );
});
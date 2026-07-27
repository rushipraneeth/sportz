import express from "express";
import http from "http";
import { router } from "./routes/matches.js";
import { attachWebSocketServer } from "./ws/server.js";
import {securityMiddleware} from "./arcjet.js";

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || "0.0.0.0";
const app = express();
const server = http.createServer(app);
app.set("trust proxy", true);
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from Express server!");
});

app.use(securityMiddleware());

app.use("/matches", router);

const { broadcastMatchCreated } = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;


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
import { WebSocket, WebSocketServer } from "ws";
import { protectWs } from "../arcjet.js";

const matchSubscribers = new Map();

function subscribe(matchId, socket) {
    if (!matchSubscribers.has(matchId)) {
        matchSubscribers.set(matchId, new Set());
    }
    matchSubscribers.get(matchId).add(socket);
}

function unsubscribe(matchId, socket) {
    const subscribers = matchSubscribers.get(matchId);
    if (!subscribers) return;

    subscribers.delete(socket);
    if (subscribers.size === 0) {
        matchSubscribers.delete(matchId);
    }
}

function cleanUpSubscriptions(socket) {
    if (!socket.subscriptions) return;
    for (const matchId of socket.subscriptions) {
        unsubscribe(matchId, socket);
    }
    socket.subscriptions.clear();
}

function broadcastToMatch(matchId, payload) {
    const subscribers = matchSubscribers.get(matchId);
    if (!subscribers || subscribers.size === 0) return;

    const message = JSON.stringify(payload);
    for (const client of subscribers) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

function broadCastToAll(wss, payload) {
    const message = JSON.stringify(payload);
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

function sendJson(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
}

function handleMessage(socket, data) {
    let message;
    try {
        message = JSON.parse(data.toString());
    } catch {
        sendJson(socket, {
            type: "error",
            message: "Invalid JSON format",
        });
        return;
    }

    if (!message || typeof message !== 'object') {
        sendJson(socket, { type: "error", message: "Payload must be a valid JSON object" });
        return;
    }

    // Ping / Pong heartbeat
    if (message.type === "ping") {
        sendJson(socket, { type: "pong", timestamp: Date.now() });
        return;
    }

    if (message.type === "subscribe" && Number.isInteger(message.matchId)) {
        subscribe(message.matchId, socket);
        socket.subscriptions.add(message.matchId);

        sendJson(socket, {
            type: "subscribed",
            matchId: message.matchId,
        });
        return;
    }

    if (message.type === "unsubscribe" && Number.isInteger(message.matchId)) {
        unsubscribe(message.matchId, socket);
        socket.subscriptions.delete(message.matchId);

        sendJson(socket, {
            type: "unsubscribed",
            matchId: message.matchId,
        });
        return;
    }

    sendJson(socket, {
        type: "error",
        message: `Unknown or unhandled message type: ${message.type}`,
    });
}

export function attachWebSocketServer(server) {
    const wss = new WebSocketServer({
        noServer: true,
        maxPayload: 1024 * 1024,
    });

    server.on("upgrade", async (req, socket, head) => {
        const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

        if (url.pathname !== "/ws") {
            return;
        }

        const isDebug =
            process.env.WS_ARCJET_DEBUG === "true" &&
            process.env.NODE_ENV !== "production";

        if (!isDebug) {
            try {
                const decision = await protectWs(req);
                if (decision.isDenied && decision.isDenied()) {
                    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
                    socket.destroy();
                    return;
                }
            } catch (err) {
                console.error("[WebSocket] Arcjet error during upgrade:", err.message);
                socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
                socket.destroy();
                return;
            }
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req);
        });
    });

    wss.on("error", (error) => {
        console.error("WebSocket Server Error:", error);
    });

    // Heartbeat interval to terminate dead connections
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                cleanUpSubscriptions(ws);
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);
    interval.unref();

    wss.on("close", () => {
        clearInterval(interval);
    });

    wss.on("connection", (socket, req) => {
        socket.isAlive = true;
        socket.subscriptions = new Set();

        socket.on("pong", () => {
            socket.isAlive = true;
        });

        sendJson(socket, {
            type: "welcome",
            timestamp: Date.now(),
        });

        socket.on("message", (data) => {
            handleMessage(socket, data);
        });

        socket.on("close", () => {
            cleanUpSubscriptions(socket);
        });

        socket.on("error", (err) => {
            console.error("WebSocket Client Error:", err.message);
        });
    });

    function broadcastMatchCreated(match) {
        broadCastToAll(wss, {
            type: "match_created",
            data: match,
        });
    }

    function broadcastMatchUpdated(match) {
        const payload = {
            type: "match_updated",
            data: match,
        };
        // Broadcast to all dashboard clients to update match cards & scores
        broadCastToAll(wss, payload);
        // Also send directly to clients focused on this specific match
        if (match.id) broadcastToMatch(match.id, payload);
        if (match.externalId && match.externalId !== match.id) {
            broadcastToMatch(match.externalId, payload);
        }
    }

    function broadcastCommentary(matchId, comment) {
        const payload = {
            type: "commentary",
            data: {
                ...comment,
                matchId: comment.matchId || matchId
            },
        };
        broadcastToMatch(matchId, payload);
        if (comment.externalId && comment.externalId !== matchId) {
            broadcastToMatch(comment.externalId, payload);
        }
    }

    return {
        broadcastMatchCreated,
        broadcastMatchUpdated,
        broadcastCommentary,
    };
}
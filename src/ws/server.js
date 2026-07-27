import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

const matchSubscribers = new Map();

function subscribe(matchId, socket) {
    console.log("========== SUBSCRIBE ==========");
    console.log("Match ID:", matchId);
    console.log("Type:", typeof matchId);

    if (!matchSubscribers.has(matchId)) {
        console.log("Creating new Set for match", matchId);
        matchSubscribers.set(matchId, new Set());
    }

    matchSubscribers.get(matchId).add(socket);

    console.log("Current Subscribers Map:");
    console.log(matchSubscribers);
    console.log("===============================");
}

function unsubscribe(matchId, socket) {
    console.log("========== UNSUBSCRIBE ==========");
    console.log("Match ID:", matchId);

    const subscribers = matchSubscribers.get(matchId);

    if (!subscribers) {
        console.log("No subscribers found.");
        console.log("=================================");
        return;
    }

    subscribers.delete(socket);

    if (subscribers.size === 0) {
        matchSubscribers.delete(matchId);
        console.log("Removed empty subscriber set.");
    }

    console.log("Current Subscribers Map:");
    console.log(matchSubscribers);
    console.log("=================================");
}

function cleanUpSubscriptions(socket) {
    for (const matchId of socket.subscriptions) {
        unsubscribe(matchId, socket);
    }
}

function broadcatToMatch(matchId, payload) {
    console.log("========== BROADCAST ==========");
    console.log("Broadcasting Match ID:", matchId);
    console.log("Type:", typeof matchId);

    console.log("Current Subscribers Map:");
    console.log(matchSubscribers);

    const subscribers = matchSubscribers.get(matchId);

    console.log("Subscribers:", subscribers);

    if (!subscribers || subscribers.size === 0) {
        console.log("❌ No subscribers found for Match ID:", matchId);
        console.log("=================================");
        return;
    }

    console.log("✅ Total Subscribers:", subscribers.size);

    const message = JSON.stringify(payload);

    for (const client of subscribers) {
        console.log("Client ReadyState:", client.readyState);

        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
            console.log("✅ Message sent");
        } else {
            console.log("❌ Client not OPEN");
        }
    }

    console.log("=================================");
}

function handleMessage(socket, data) {
    let message;

    try {
        message = JSON.parse(data.toString());
    } catch {
        sendJson(socket, {
            type: "error",
            message: "Invalid JSON",
        });

        return;
    }

    if (
        message?.type === "subscribe" &&
        Number.isInteger(message.matchId)
    ) {
        subscribe(message.matchId, socket);
        socket.subscriptions.add(message.matchId);

        sendJson(socket, {
            type: "subscribed",
            matchId: message.matchId,
        });

        return;
    }

    if (
        message?.type === "unsubscribe" &&
        Number.isInteger(message.matchId)
    ) {
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
        message: "Unknown message type",
    });
}

function sendJson(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify(payload));
}

function broadCastToAll(wss, payload) {
    for (const client of wss.clients) {
        if (client.readyState !== WebSocket.OPEN) continue;

        client.send(JSON.stringify(payload));
    }
}

export function attachWebSocketServer(server) {
    const wss = new WebSocketServer({
        server,
        path: "/ws",
        maxPayload: 1024 * 1024,
    });

    wss.on("error", (error) => {
        console.error("WebSocket Server Error:", error);
    });

    wss.on("connection", (socket, req) => {
        console.log("==================================");
        console.log("New WebSocket connection");
        console.log("IP:", req.socket.remoteAddress);

        socket.subscriptions = new Set();

        // Arcjet is disabled temporarily for debugging
        console.log("⚠ Arcjet check skipped (debug mode)");

        console.log("Client connected successfully");

        sendJson(socket, {
            type: "welcome",
        });

        socket.on("message", (data, isBinary) => {
            console.log("================================");
            console.log("MESSAGE EVENT TRIGGERED");
            console.log("Binary:", isBinary);
            console.log("Raw Buffer:", data);
            console.log("As String:", data.toString());

            handleMessage(socket, data);

            console.log("================================");
        });

        socket.on("close", (code, reason) => {
            console.log(
                `Client disconnected (${code}) ${reason.toString()}`
            );

            cleanUpSubscriptions(socket);
        });

        socket.on("error", (err) => {
            console.error("WebSocket Error:", err);
        });

        console.log("==================================");
    });

    function broadcastMatchCreated(match) {
        broadCastToAll(wss, {
            type: "match_created",
            data: match,
        });
    }

    function broadcastCommentary(matchId, comment) {
        broadcatToMatch(matchId, {
            type: "commentary",
            data: comment,
        });
    }

    return {
        broadcastMatchCreated,
        broadcastCommentary,
    };
}
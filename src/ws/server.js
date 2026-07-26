import { WebSocket, WebSocketServer } from "ws";

function sendJson(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify(payload));
}

function broadCast(wss, payload) {
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

    wss.on("connection", (socket) => {
        console.log("Client connected");

        sendJson(socket, {
            type: "welcome",
        });

        socket.on("error", (err) => {
            console.error(err);
        });

        socket.on("close", () => {
            console.log("Client disconnected");
        });
    });

    function broadcastMatchCreated(match) {
        broadCast(wss, {
            type: "match_created",
            data: match,
        });
    }

    return {
        broadcastMatchCreated,
    };
}
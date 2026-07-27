import { WebSocket, WebSocketServer } from "ws";
import {wsArcjet} from "../arcjet.js";

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

    wss.on("error", (error) => {

        console.error("WebSocket Server Error:", error);
    });

    wss.on("connection", async (socket,req,res) => {
        if(wsArcjet){
            try{
                const decision = await wsArcjet.protect(req);

                if (decision.isErrored()) {
                    socket.close(1011, 'Security service unavailable');
                    return;
                }

                if(decision.isDenied()){
                    const code = decision.reason.isRateLimit() ? 1013 : 1008;
                    const reason = decision.reason.isRateLimit() ? 'Rate limit Exceeded' : 'Access Denied';

                    socket.close(code,reason);
                    return;
                }


            }catch(e){
                console.error('WS connection error',e);
                socket.close(1011,'Server Security Error');
                return;
            }
        }
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
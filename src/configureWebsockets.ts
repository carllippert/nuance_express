import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

import { WebSocketWithVAD } from './websockets/scoringVad';
import { SHARED_TRANSCRIPTION_STATE, sendServerStateMessage } from './websockets/streamingSpeech';
import * as Sentry from "@sentry/node";

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || "no-secret";

import jwt from "jsonwebtoken";

function onSocketPreError(err: Error) {
    console.error('WebSocket error:', err);
}

function onSocketPostError(err: Error) {
    console.error('WebSocket error:', err);
}

export const configureWebsockets = (server: Server) => {

    const wss = new WebSocketServer({ noServer: true })

    //you can put your jwt in the query string
    //minute 8 https://www.youtube.com/watch?v=Gq7fenbjehs
    server.on('upgrade', (request, socket, head) => {
        socket.on('error', onSocketPreError);

        wss.handleUpgrade(request, socket, head, (ws) => {
            socket.removeListener('error', onSocketPreError);
            wss.emit('connection', ws, request);
        })
    })

    wss.on('connection', (ws: WebSocket, request) => {
        // console.log("request: ", request);
        const authHeader = request.headers["authorization"];
        const token = authHeader && authHeader.split(" ")[1];

        const current_user_timezone = request.headers["x-timezone-name"];
        const current_seconds_from_gmt = request.headers["x-timezone-offset"];

        console.log("current_user_timezone:", current_user_timezone);
        console.log("current_seconds_from_gmt:", current_seconds_from_gmt);

        if (!current_user_timezone || !current_seconds_from_gmt) {
            console.error("No User Timezone Provided:");

            //Not Authorized
            ws.send(JSON.stringify({ key: "error", value: "401" }));
            // Use the 1008 close code for policy violation or a custom code for unauthorized access
            ws.close(1008, 'Unauthorized'); // You can send a string reason along with the close code
            return;
        }

        // console.log("Token:", token);
        // console.log("authHeader:", authHeader);

        jwt.verify(token, SUPABASE_JWT_SECRET, (err, user) => {
            console.log('User:', user);
            if (!user) {
                console.error("JWT Verification failed with error:", err);

                //Not Authorized
                ws.send(JSON.stringify({ key: "error", value: "401" }));
                // Use the 1008 close code for policy violation or a custom code for unauthorized access
                ws.close(1008, 'Unauthorized'); // You can send a string reason along with the close code
                return;
            }

            let id = user.sub.toString();
            //some systems are case sensitive so we just uppercase everywhere
            const user_id = id.toUpperCase();

            if (err) {
                console.error("JWT Verification failed with error:", err);

                //Not Authorized
                ws.send(JSON.stringify({ key: "error", value: "401" }));
                // Use the 1008 close code for policy violation or a custom code for unauthorized access
                ws.close(1008, 'Unauthorized'); // You can send a string reason along with the close code
                return;
            } else {
                console.log("JWT Verified");
                console.log('New WebSocket connection', request.url);
                sendServerStateMessage(ws, SHARED_TRANSCRIPTION_STATE.CONNECTED);
                new WebSocketWithVAD(ws, user_id, String(current_user_timezone), String(current_seconds_from_gmt));
                Sentry.setUser({ id: user_id });
            }
        });

        ws.on('error', onSocketPostError);
    })
}



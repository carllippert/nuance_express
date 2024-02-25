import express from 'express';
import { WebSocketServer, WebSocket } from 'ws'
import { configureExpressRoutes } from './configureExpressRoutes';

// import { WebSocketWithVAD } from './websockets/vadAudioChunk';
import { WebSocketWithVAD } from './websockets/vadStream';
import { SHARED_TRANSCRIPTION_STATE, sendServerStateMessage } from './websockets/streamingSpeech';

if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

export const app = express();
export const port = process.env.PORT || 3000;

configureExpressRoutes(app)

const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
})

const wss = new WebSocketServer({ noServer: true })

function onSocketPreError(err: Error) {
    console.error('WebSocket error:', err);
}

function onSocketPostError(err: Error) {
    console.error('WebSocket error:', err);
}

//you can put your jwt in the query string
//minute 8 https://www.youtube.com/watch?v=Gq7fenbjehs
server.on('upgrade', (request, socket, head) => {
    socket.on('error', onSocketPreError);
    //perform auth here
    let authFailed = false; //TODO: 
    if (authFailed) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
        socket.removeListener('error', onSocketPreError);
        wss.emit('connection', ws, request);
    })
})

wss.on('connection', (ws: WebSocket, request) => {
    console.log('New WebSocket connection', request.url);
    sendServerStateMessage(ws, SHARED_TRANSCRIPTION_STATE.CONNECTED);
    new WebSocketWithVAD(ws);
    ws.on('error', onSocketPostError);
})

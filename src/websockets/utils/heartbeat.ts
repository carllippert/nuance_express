import WebSocket from 'ws';

const HEARTBEAT_INTERVAL = 10000; // 10 seconds
const HEARTBEAT_VALUE = new Uint8Array([0]);

export function setupHeartbeat(ws: WebSocket) {
    let isAlive = true;

    function ping() {
        console.log("ping");
        ws.send(HEARTBEAT_VALUE, { binary: true });
    }

    let interval = setInterval(() => {
        if (!isAlive) {
            console.log("Terminating dead connection. No Pong received.");
            ws.send(JSON.stringify({ key: "error", value: "4000" }));
            ws.close(4000, 'Connection was closed abnormally');
            clearInterval(interval);
            return;
        }
        isAlive = false;
        ping();
    }, HEARTBEAT_INTERVAL);

    ws.on('message', (message: WebSocket.Data) => {
        if (Buffer.isBuffer(message) && message.length === 1 && message[0] === 0x00) {
            console.log("Received pong");
            isAlive = true;
        }
    });

    ws.on('close', () => {
        clearInterval(interval);
    });
}
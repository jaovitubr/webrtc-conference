export class WebSocketSignalingChannel {
    onjoin = null;
    onleave = null;
    onoffer = null;
    onicecandidate = null;
    onanswer = null;

    constructor() {
        setInterval(() => {
            if (this.socket?.readyState !== 1) return;
            this.socket.send("\r\n");
        }, 5000);
    }

    #socketHandle(event) {
        if (event.data === "\r\n") return;

        const message = JSON.parse(event.data);

        switch (message.type) {
            case "join":
                this.onjoin?.(message.clientId);
                break;
            case "leave":
                this.onleave?.(message.clientId);
                break;
            case "offer":
                const offer = new RTCSessionDescription(message.data);
                this.onoffer?.(message.clientId, offer);
                break;
            case "candidate":
                const candidate = new RTCIceCandidate(message.data);
                this.onicecandidate?.(message.clientId, candidate);
                break;
            case "answer":
                const answer = new RTCSessionDescription(message.data);
                this.onanswer?.(message.clientId, answer);
                break;
        }
    }

    #socketConnect(room) {
        this.socketConnection = new Promise((resolve, reject) => {
            const url = new URL("ws://127.0.0.1:8787/walkie_talkie");
            url.searchParams.set("room", room);

            const ws = new WebSocket(url);
            ws.onmessage = (event) => this.#socketHandle(event);

            function handler() {
                ws.onopen = null;
                ws.onclose = null;

                if (ws.readyState === 1) resolve(ws);
                else reject("open error");
            }

            ws.onopen = handler;
            ws.onclose = handler;
        });

        return this.socketConnection;
    }

    async #emit(type, data) {
        const socket = await this.socketConnection;

        socket?.send(JSON.stringify({
            ...data,
            type,
        }));
    }

    async join(room) {
        clearTimeout(this.reconnectTimeout);

        this.socketConnection?.then(socket => {
            socket.onclose = null;
            socket.close();
        });
        this.socketConnection = null;

        try {
            const socket = await this.#socketConnect(room);

            socket.onclose = () => {
                this.socketConnection = null;
                this.reconnectTimeout = setTimeout(() => {
                    this.join(room);
                }, 1000);
            };
        } catch {
            this.reconnectTimeout = setTimeout(() => {
                this.join(room);
            }, 1000);
        }
    }

    emitOffer(clientId, offer) {
        this.#emit("offer", {
            clientId,
            data: offer,
        });
    }

    emitCandidate(clientId, candidate) {
        this.#emit("candidate", {
            clientId,
            data: candidate,
        });
    }

    emitAnswer(clientId, answer) {
        this.#emit("answer", {
            clientId,
            data: answer,
        });
    }
}

export class SocketIOSignalingChannel {
    onjoin = null;
    onleave = null;
    onoffer = null;
    onicecandidate = null;
    onanswer = null;

    constructor() {
        this.socket = io();

        this.socket.on("join", (clientId) => {
            this.onjoin?.(clientId);
        });

        this.socket.on("leave", (clientId) => {
            this.onleave?.(clientId);
        });

        this.socket.on("offer", (clientId, data) => {
            this.onoffer?.(clientId, new RTCSessionDescription(data));
        });

        this.socket.on("candidate", (clientId, data) => {
            this.onicecandidate?.(clientId, new RTCIceCandidate(data));
        });

        this.socket.on("answer", (clientId, data) => {
            this.onanswer?.(clientId, new RTCSessionDescription(data));
        });
    }

    join(room) {
        this.socket.emit("join", room);
    }

    emitOffer(clientId, offer) {
        this.socket.emit("offer", clientId, offer);
    }

    emitCandidate(clientId, candidate) {
        this.socket.emit("candidate", clientId, candidate);
    }

    emitAnswer(clientId, answer) {
        this.socket.emit("answer", clientId, answer);
    }
}
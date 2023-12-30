export class WebSocketSignalingChannel {
    onjoin = null;
    onleave = null;
    onoffer = null;
    onicecandidate = null;
    onanswer = null;

    room = null;

    currentSeq = 1;
    queueIsProcessing = false;
    queue = [];

    constructor(endpoint) {
        this.endpoint = endpoint;

        setInterval(() => {
            if (this.socket?.readyState !== 1) return;
            this.socket.send("\r\n");
        }, 5000);
    }

    #socketHandle(event) {
        if (!event.data) return;

        const message = JSON.parse(event.data);

        switch (message.type) {
            case "response":
                const queueItem = this.queue.find(item => item.seq === message.seq);
                queueItem?.handleResponse(message);
                break;
            case "join":
                this.onjoin?.(message.connectionId);
                break;
            case "leave":
                this.onleave?.(message.connectionId);
                break;
            case "offer":
                const offer = new RTCSessionDescription(message.data);
                this.onoffer?.(message.connectionId, offer);
                break;
            case "candidate":
                const candidate = new RTCIceCandidate(message.data);
                this.onicecandidate?.(message.connectionId, candidate);
                break;
            case "answer":
                const answer = new RTCSessionDescription(message.data);
                this.onanswer?.(message.connectionId, answer);
                break;
        }
    }

    #socketConnect(room) {
        this.socketConnection = new Promise((resolve, reject) => {
            const url = new URL(this.endpoint);
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

    async #queueConsume() {
        if (this.queueIsProcessing) return;

        const item = this.queue[0];
        if (!item) return;

        this.queueIsProcessing = true;

        const timeout = setTimeout(() => {
            console.log(item)
            item.callback?.(new Error("timeout"), null);

            this.queue = this.queue.filter(_item => _item != item);
            this.queueIsProcessing = false;
            this.#queueConsume();
        }, 5000);

        try {
            const socket = await this.socketConnection;

            item.handleResponse = (res) => {
                clearTimeout(timeout);

                item.callback?.(null, res);

                this.queue = this.queue.filter(_item => _item != item);
                this.queueIsProcessing = false;
                this.#queueConsume();
            }

            socket?.send(JSON.stringify(item));
        } catch (error) {
            clearTimeout(timeout);

            item.callback?.(error, null);

            this.queue = this.queue.filter(_item => _item != item);
            this.queueIsProcessing = false;
            this.#queueConsume();
        }
    }

    async #emit(type, data) {
        return new Promise((resolve, reject) => {
            const callback = (err, res) => {
                if (err) reject(err);
                else resolve(res);
            }

            const seq = this.currentSeq++;

            this.queue.push({
                type,
                seq,
                room: this.room,
                ...data,
                callback,
            });

            this.#queueConsume();
        });
    }

    async join(room) {
        clearTimeout(this.reconnectTimeout);

        this.queue.forEach(item => {
            item.callback?.(new Error("aborted"), null);
        });
        this.currentSeq = 1;
        this.queue = [];

        this.socketConnection?.then(socket => {
            socket.onclose = null;
            socket.close();
        });
        this.socketConnection = null;

        this.room = room;

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

    emitOffer(connectionId, offer) {
        return this.#emit("offer", {
            connectionId,
            data: offer,
        });
    }

    emitCandidate(connectionId, candidate) {
        return this.#emit("candidate", {
            connectionId,
            data: candidate,
        });
    }

    emitAnswer(connectionId, answer) {
        return this.#emit("answer", {
            connectionId,
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

        this.socket.on("join", (connectionId) => {
            this.onjoin?.(connectionId);
        });

        this.socket.on("leave", (connectionId) => {
            this.onleave?.(connectionId);
        });

        this.socket.on("offer", (connectionId, data) => {
            this.onoffer?.(connectionId, new RTCSessionDescription(data));
        });

        this.socket.on("candidate", (connectionId, data) => {
            this.onicecandidate?.(connectionId, new RTCIceCandidate(data));
        });

        this.socket.on("answer", (connectionId, data) => {
            this.onanswer?.(connectionId, new RTCSessionDescription(data));
        });
    }

    join(room) {
        this.socket.emit("join", room);
    }

    emitOffer(connectionId, offer) {
        this.socket.emit("offer", connectionId, offer);
    }

    emitCandidate(connectionId, candidate) {
        this.socket.emit("candidate", connectionId, candidate);
    }

    emitAnswer(connectionId, answer) {
        this.socket.emit("answer", connectionId, answer);
    }
}
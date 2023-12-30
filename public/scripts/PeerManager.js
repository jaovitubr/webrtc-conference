export function PeerClient(options) {
    const peerConnection = new RTCPeerConnection({
        iceServers: options.iceServers,
    });

    const connectionId = options.connectionId;
    const localStream = options.localStream;
    const signalingChannel = options.signalingChannel;

    let clientStream;
    let onstream = null;

    function log(...args) {
        console.log(
            `%c[PeerConnection:${connectionId}]`,
            "background-color: #0079c9; color: white",
            ...args,
        );
    }

    function onLocalIceCandidate(candidate) {
        log("Local ice candidate", candidate);

        signalingChannel.emitCandidate(connectionId, candidate);
    }

    function onRemoteStream(stream) {
        log("client stream", stream);

        onstream?.({
            connectionId,
            stream,
        });
    }

    async function addAnswer(answer) {
        peerConnection.setRemoteDescription(answer);
    }

    async function addIceCandidate(candidate) {
        peerConnection.addIceCandidate(candidate);
    }

    async function emitOffer() {
        const offer = await peerConnection.createOffer({
            offerToReceiveAudio: localStream.getAudioTracks().length > 0,
            offerToReceiveVideo: localStream.getVideoTracks().length > 0,
        });
        peerConnection.setLocalDescription(offer);

        signalingChannel.emitOffer(connectionId, offer);
    }

    async function emitAnswer(offer) {
        peerConnection.setRemoteDescription(offer);

        const answer = await peerConnection.createAnswer();
        peerConnection.setLocalDescription(answer);

        signalingChannel.emitAnswer(connectionId, answer);
    }

    peerConnection.onconnectionstatechange = () => {
        log(`Connection state: ${peerConnection.connectionState}`);
    }

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) onLocalIceCandidate(event.candidate);
    }

    peerConnection.ontrack = (event) => {
        if (clientStream && event.track) {
            clientStream.addTrack(event.track);
            return;
        }

        clientStream = event.streams?.[0] || new MediaStream(event.track);

        onRemoteStream(clientStream);
    };

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    function close() {
        peerConnection.close();
        peerConnection.onconnectionstatechange = null;
        peerConnection.onicecandidate = null;
        peerConnection.ontrack = null;

        clientStream?.getTracks().forEach(track => track.stop());
    }

    return {
        emitOffer,
        emitAnswer,
        addAnswer,
        addIceCandidate,
        close,

        get id() {
            return connectionId;
        },

        get stream() {
            return clientStream;
        },

        get onstream() {
            return onstream;
        },
        set onstream(value) {
            onstream = value;
        }
    }
}

export default function PeerManager(options) {
    const signalingChannel = options.signalingChannel;
    const clients = new Map();

    let localStream;
    let onstream = null;

    function log(...args) {
        console.log(
            `%c[PeerManager]`,
            "background-color: #0079c9; color: white",
            ...args,
        );
    }

    function GetOrCreateClient(connectionId) {
        if (clients.has(connectionId)) return clients.get(connectionId);

        const client = PeerClient({
            localStream,
            connectionId,
            signalingChannel,
            iceServers: options.iceServers,
        });

        client.onstream = (...args) => onstream?.(...args);

        clients.set(connectionId, client);

        return client;
    }

    function onClientJoin(connectionId) {
        log("client join", connectionId);

        GetOrCreateClient(connectionId).emitOffer();
    }

    function onClientOffer(connectionId, offer) {
        log("client offer", connectionId, offer);

        GetOrCreateClient(connectionId).emitAnswer(offer);
    }

    function onClientAnswer(connectionId, answer) {
        if (!clients.has(connectionId)) return;

        log("client answer", connectionId, answer);

        clients.get(connectionId).addAnswer(answer);
    }

    function onClientIceCandidate(connectionId, candidate) {
        if (!clients.has(connectionId)) return;

        log("client ice candidate", connectionId, candidate);

        clients.get(connectionId).addIceCandidate(candidate);
    }

    function onClientLeave(connectionId) {
        if (!clients.has(connectionId)) return;

        log("client leave", connectionId);

        clients.get(connectionId).close();
        clients.delete(connectionId);
    }

    async function start() {
        if (localStream) throw new Error("already initialized");

        localStream = await navigator.mediaDevices.getUserMedia({
            audio: options.audio,
            video: options.video,
        });

        log("Started local stream", localStream);

        signalingChannel.onjoin = onClientJoin;
        signalingChannel.onoffer = onClientOffer;
        signalingChannel.onanswer = onClientAnswer;
        signalingChannel.onicecandidate = onClientIceCandidate;
        signalingChannel.onleave = onClientLeave;

        onstream?.({
            connectionId: null,
            stream: localStream,
        });
    }

    function stop() {
        clients.forEach(client => client.close());
        clients.clear();

        localStream?.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    return {
        start,
        stop,

        get signalingChannel() {
            return signalingChannel;
        },
        get localStream() {
            return localStream;
        },
        get clients() {
            return clients;
        },

        get onstream() {
            return onstream;
        },
        set onstream(value) {
            onstream = value;
        }
    }
}
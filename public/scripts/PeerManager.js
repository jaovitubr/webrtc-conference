export function PeerClient(options) {
    const peerConnection = new RTCPeerConnection({
        iceServers: options.iceServers,
    });

    const clientId = options.clientId;
    const localStream = options.localStream;
    const signalingChannel = options.signalingChannel;

    let clientStream;
    let onstream = null;

    function log(...args) {
        console.log(
            `%c[PeerConnection:${clientId}]`,
            "background-color: #0079c9; color: white",
            ...args,
        );
    }

    function onLocalIceCandidate(candidate) {
        log("Local ice candidate", candidate);

        signalingChannel.emitCandidate(clientId, candidate);
    }

    function onRemoteStream(stream) {
        log("client stream", stream);

        onstream?.({
            clientId,
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

        signalingChannel.emitOffer(clientId, offer);
    }

    async function emitAnswer(offer) {
        peerConnection.setRemoteDescription(offer);

        const answer = await peerConnection.createAnswer();
        peerConnection.setLocalDescription(answer);

        signalingChannel.emitAnswer(clientId, answer);
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
            return clientId;
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

    function GetOrCreateClient(clientId) {
        if (clients.has(clientId)) return clients.get(clientId);

        const client = PeerClient({
            localStream,
            clientId,
            signalingChannel,
            iceServers: options.iceServers,
        });

        client.onstream = (...args) => onstream?.(...args);

        clients.set(clientId, client);

        return client;
    }

    function onClientJoin(clientId) {
        log("client join", clientId);

        GetOrCreateClient(clientId).emitOffer();
    }

    function onClientOffer(clientId, offer) {
        log("client offer", clientId, offer);

        GetOrCreateClient(clientId).emitAnswer(offer);
    }

    function onClientAnswer(clientId, answer) {
        if (!clients.has(clientId)) return;

        log("client answer", clientId, answer);

        clients.get(clientId).addAnswer(answer);
    }

    function onClientIceCandidate(clientId, candidate) {
        if (!clients.has(clientId)) return;

        log("client ice candidate", clientId, candidate);

        clients.get(clientId).addIceCandidate(candidate);
    }

    function onClientLeave(clientId) {
        if (!clients.has(clientId)) return;

        log("client leave", clientId);

        clients.get(clientId).close();
        clients.delete(clientId);
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
            clientId: null,
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
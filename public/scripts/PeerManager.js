import EventEmitter from "./EventEmitter.js";

export default function PeerManager(options) {
    const peerConnection = new RTCPeerConnection({
        iceServers: options.iceServers,
    });
    const eventEmitter = new EventEmitter();

    const signalingChannel = options.signaling;

    function log(...args) {
        console.log(
            "%c[PeerManager]",
            "background-color: #0079c9; color: white",
            ...args,
        );
    }

    function onConnectionStateChange(connectionState) {
        log(`Connection state: ${connectionState}`)
    }

    function onIceCandidate(candidate) {
        log("Received ICE Candidate", candidate);
        signalingChannel.sendCandidate(candidate);
    }

    function onRemoteStream(stream) {
        log("Received remote stream", stream);

        eventEmitter.emit("stream", stream);
    }

    async function onRemoteOffer(offer) {
        peerConnection.setRemoteDescription(offer);

        const answer = await peerConnection.createAnswer();
        peerConnection.setLocalDescription(answer);

        signalingChannel.sendAnswer(answer);
    }

    async function onRemoteAnswer(answer) {
        peerConnection.setRemoteDescription(answer);
    }

    async function onRemoteCandidate(candidate) {
        peerConnection.addIceCandidate(candidate);
    }

    function StartHandlers() {
        peerConnection.onconnectionstatechange = () => {
            onConnectionStateChange(peerConnection.connectionState);
        }

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) onIceCandidate(event.candidate);
        }

        peerConnection.ontrack = (event) => {
            const stream = event.streams?.[0] || new MediaStream(event.track);

            onRemoteStream({
                isRemote: true,
                stream,
            });
        };

        signalingChannel.onOffer = onRemoteOffer;
        signalingChannel.onAnswer = onRemoteAnswer;
        signalingChannel.onCandidate = onRemoteCandidate;
    }

    async function StartLocalStream() {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: !!options.audio,
            video: !!options.video,
        });

        log("Started local stream", stream);

        for (const track of stream.getTracks()) {
            peerConnection.addTrack(track, stream);
        }

        eventEmitter.emit("stream", {
            isRemote: false,
            stream,
        });

        const offer = await peerConnection.createOffer({
            offerToReceiveAudio: !!options.audio,
            offerToReceiveVideo: !!options.video,
        });

        peerConnection.setLocalDescription(offer);
        signalingChannel.sendOffer(offer);
    }

    return {
        addEventListener: (event, callback) => eventEmitter.on(event, callback),
        removeEventListener: (event, callback) => eventEmitter.off(event, callback),

        start() {
            StartHandlers();
            StartLocalStream();
        },
    }
}
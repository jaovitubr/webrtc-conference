import PeerManager from "./PeerManager.js";
import SignalingChannel from "./SignalingChannel.js";

const iceServers = [
    { url: "stun:stun.services.mozilla.com" },
    { url: "stun:stun.l.google.com:19302" },
];

let localStream;

document.getElementById("mute").addEventListener("click", () => {
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
    });
});

function handleStream(event) {
    const audioElem = document.createElement("audio");

    if (event.isRemote === false) {
        localStream = event.stream;
        audioElem.muted = true;
    }

    audioElem.controls = true;
    audioElem.autoplay = true;
    audioElem.srcObject = event.stream;

    document.querySelector("main").appendChild(audioElem);

    event.stream.oninactive = () => {
        audioElem.remove();
    };
}

const peer = PeerManager({
    audio: true,
    iceServers,
    signaling: await SignalingChannel({
        room: "test",
    }),
});

peer.addEventListener("stream", handleStream);

peer.start()
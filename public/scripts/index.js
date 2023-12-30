import PeerManager from "./PeerManager.js";
import { WebSocketSignalingChannel } from "./SignalingChannel.js";

const iceServers = [
    { url: "stun:stun.services.mozilla.com" },
    { url: "stun:stun.l.google.com:19302" },
];

const peer = PeerManager({
    audio: true,
    iceServers,
    signalingChannel: new WebSocketSignalingChannel("wss://jzv15f4oha.execute-api.sa-east-1.amazonaws.com/dev"),
});
window.peer = peer
async function JoinRoom(room) {
    peer.stop();
    await peer.start();
    peer.localStream?.getAudioTracks().forEach(track => track.enabled = false);
    peer.signalingChannel.join(room);
}

document.getElementById("channel").addEventListener("change", function () {
    JoinRoom(this.value);
});

document.getElementById("push-to-talk").addEventListener("mousedown", function () {
    this.style.backgroundColor = "lime";

    peer.localStream?.getAudioTracks().forEach(track => {
        track.enabled = true;
    });
});

window.addEventListener("mouseup", function () {
    document.getElementById("push-to-talk").style.backgroundColor = null;

    peer.localStream?.getAudioTracks().forEach(track => {
        track.enabled = false;
    });
});

function handleStream(event) {
    if (!event.connectionId) return;

    const audioElem = document.createElement("audio");

    audioElem.dataset.id = event.connectionId;
    audioElem.controls = true;
    audioElem.autoplay = true;
    audioElem.playsinline = true;
    audioElem.srcObject = event.stream;

    document.querySelector("main").appendChild(audioElem);

    event.stream.oninactive = () => {
        audioElem.remove();
    };
}

peer.onstream = handleStream;
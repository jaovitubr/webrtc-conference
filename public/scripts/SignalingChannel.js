export default async function SignalingChannel(options) {
    return new Promise((resolve, reject) => {
        const socket = io({
            query: {
                room: options?.room || ""
            }
        });

        const signaling = {
            sendCandidate: (candidate) => socket.emit("candidate", candidate),
            sendOffer: (offer) => socket.emit("offer", offer),
            sendAnswer: (answer) => socket.emit("answer", answer),

            set onCandidate(callback) {
                socket.on("candidate", (data) => {
                    callback(new RTCIceCandidate(data));
                });
            },
            set onOffer(callback) {
                socket.on("offer", (data) => {
                    callback(new RTCSessionDescription(data));
                });
            },
            set onAnswer(callback) {
                socket.on("answer", (data) => {
                    callback(new RTCSessionDescription(data));
                });
            },
        }

        socket.on("connect", () => resolve(signaling));
        socket.on("error", reject);
    });
}
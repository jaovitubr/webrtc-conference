const express = require("express");
const app = express();
const fs = require("fs");

const http = require("https").createServer({
    key: fs.readFileSync("./certificate/key.pem"),
    cert: fs.readFileSync("./certificate/cert.pem")
}, app);

const io = require("socket.io")(http);

app.use(express.static("public"));

io.on("connection", (socket) => {
    const room = socket.handshake.query.room;

    socket.join(room);
    console.log("user connected to room", room);

    socket.on("candidate", (data) => {
        console.log("candidate", data);
        socket.broadcast.to(room).emit("candidate", data);
    });

    socket.on("offer", (data) => {
        console.log("offer", data);
        socket.broadcast.to(room).emit("offer", data);
    });

    socket.on("answer", (data) => {
        console.log("answer", data);
        socket.broadcast.to(room).emit("answer", data);
    });
});

http.listen(443, () => {
    console.log("listening on *:443");
});
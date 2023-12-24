const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

app.get("/rooms", (req, res) => {
    res.json([]);
});

io.on("connection", (socket) => {
    let currentRoom;

    socket.on("join", (newRoom) => {
        if (currentRoom) {
            socket.leave(currentRoom);
            socket.broadcast.to(currentRoom).emit("leave", socket.id);
        }

        socket.join(newRoom);
        socket.broadcast.to(newRoom).emit("join", socket.id);

        currentRoom = newRoom;
    });

    socket.on("candidate", (clientId, data) => {
        socket.broadcast.to(clientId).emit("candidate", socket.id, data);
    });

    socket.on("offer", (clientId, data) => {
        socket.broadcast.to(clientId).emit("offer", socket.id, data);
    });

    socket.on("answer", (clientId, data) => {
        socket.broadcast.to(clientId).emit("answer", socket.id, data);
    });

    socket.on("disconnect", () => {
        if (!currentRoom) return;
        socket.broadcast.to(currentRoom).emit("leave", socket.id);
    });
});

http.listen(3000, () => {
    console.log(`Listening on port ${http.address().port}`);
});
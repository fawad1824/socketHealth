const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);


io.on('connection', (socket) => {
    console.log('Socket Connected');

    socket.on('offer', (data) => {
        socket.broadcast.emit('offer', data);
    });
    socket.on('answer', (data) => {
        socket.broadcast.emit('answer', data);
    });
    socket.on('ice-candidate', (data) => {
        socket.broadcast.emit('ice-candidate', data);
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

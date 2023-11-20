const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const clients = {}; // Store clients and their rooms

io.on('connection', (socket) => {
    console.log('socket connected');

    socket.on('join', (roomId) => {
        socket.join(roomId);
        clients[socket.id] = { roomId };
        console.log(`User joined room: ${roomId}`);
        io.to(roomId).emit('userJoined', socket.id);
    });

    socket.on('disconnect', () => {
        const { roomId } = clients[socket.id] || {};
        console.log(`User disconnected from room: ${roomId}`);
        if (roomId) {
            socket.leave(roomId);
            io.to(roomId).emit('userLeft', socket.id);
            delete clients[socket.id];
        }
    });

    socket.on('offer', ({ to, offer }) => {
        io.to(to).emit('offer', { offer, from: socket.id });
    });

    socket.on('answer', ({ to, answer }) => {
        io.to(to).emit('answer', { answer, from: socket.id });
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
        io.to(to).emit('ice-candidate', { candidate, from: socket.id });
    });

    socket.on('message', ({ to, from, message }) => {
        io.to(to).emit('message', { message, from });
    });

    socket.on('disconnect', () => {
        const { roomId } = clients[socket.id] || {};
        console.log(`User disconnected from room: ${roomId}`);
        if (roomId) {
            socket.leave(roomId);
            io.to(roomId).emit('userLeft', socket.id); // Broadcast to the room that a user left
            delete clients[socket.id];
        }
    });
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

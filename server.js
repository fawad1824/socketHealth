const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const roomsRouter = require('./routes/rooms');
const db = require('./db'); // Path to your db.js file

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORS middleware
app.use(cors());

db.raw('show tables')
    .then(() => {
        console.log('Database connected!');
    })
    .catch((err) => {
        console.error('Error connecting to database:', err);
    });

io.on('connection', (socket) => {

    console.log('socket connected');

    socket.on('join', (roomId) => {
        io.to(roomId).emit('userJoined', socket.id);
        io.to(roomId).emit('usersInRoom', rooms[roomId]);
    });


    socket.on('disconnect', () => {
        io.to(roomId).emit('userLeft', socket.id);
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
});
app.use('/api/', roomsRouter);



const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

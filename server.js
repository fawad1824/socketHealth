const express = require('express');
require('dotenv').config();
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
app.use(cors()); // Enable CORS for all routes



db.raw('show tables')
    .then(() => {
        console.log('Database connected!');
    })
    .catch((err) => {
        console.error('Error connecting to database:', err);
    });

const rooms = {}; // Store rooms and their sockets


 socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST','PUT'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
});

io.on('connection', (socket) => {

    console.log('socket connected');

    socket.on('join', (roomId) => {
        // Join the room
        socket.join(roomId);

        // Store the socket in the room
        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }
        rooms[roomId].push(socket.id);

        // Notify other users in the room about the new user
        io.to(roomId).emit('userJoined', socket.id);
        io.to(roomId).emit('usersInRoom', rooms[roomId]);
    });

    socket.on('disconnect', () => {
        // Find the room the socket is in and remove it from the room
        Object.keys(rooms).forEach((roomId) => {
            const index = rooms[roomId].indexOf(socket.id);
            if (index !== -1) {
                rooms[roomId].splice(index, 1);
                io.to(roomId).emit('userLeft', socket.id);
            }
        });
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


const port = process.env.PORT;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});



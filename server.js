const express = require('express');
require('dotenv').config();
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const app = express();
const server = http.createServer(app);
const db = require('./db'); // Path to your db.js file

const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT'],
        allowedHeaders: ['Content-Type'],
        credentials: true,
    },
});
const roomsRouter = require('./routes/rooms');

// Body parser middleware
app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: true }));


db.raw('show tables')
    .then(() => {
        console.log('Database connected!');
    })
    .catch((err) => {
        console.error('Error connecting to database:', err);
    });

const users = {};

io.on('connection', (socket) => {
    console.log('New user connected:', socket.id);

    // Handle user disconnect
    socket.on('disconnect', async (from, to) => {
        try {
            const fromU = await db('profile').where('user_id', from).first();
            const toU = await db('profile').where('user_id', to).first();

            if (!fromU || !toU) {
                // Handle user not found error
                io.to(socket.id).emit('answer-error', { message: 'Users not found' });
                return;
            }

            // Emit the ICE candidate to the intended recipient ('to')
            io.to(to).emit('offer-forward', { socket: socket.id, from: fromU, to: toU });
        } catch (error) {
            console.error('Error handling ice-candidate:', error);
            // Emit an error event back to the sender
            io.to(socket.id).emit('offer', { message: 'Error handling ICE candidate' });
        }
    });

    // Signaling events
    socket.on('offer', async (from, to) => {
        try {
            const fromU = await db('profile').where('user_id', from).first();
            const toU = await db('profile').where('user_id', to).first();

            if (!fromU || !toU) {
                // Handle user not found error
                io.to(socket.id).emit('answer-error', { message: 'Users not found' });
                return;
            }

            // Emit the ICE candidate to the intended recipient ('to')
            io.to(to).emit('offer-forward', { socket: socket.id, from: fromU, to: toU });
        } catch (error) {
            console.error('Error handling ice-candidate:', error);
            // Emit an error event back to the sender
            io.to(socket.id).emit('offer', { message: 'Error handling ICE candidate' });
        }
    });

    socket.on('answer', async (from, to) => {
        try {
            const fromU = await db('profile').where('user_id', from).first();
            const toU = await db('profile').where('user_id', to).first();

            if (!fromU || !toU) {
                // Handle user not found error
                io.to(socket.id).emit('answer-error', { message: 'Users not found' });
                return;
            }

            // Emit the ICE candidate to the intended recipient ('to')
            io.to(to).emit('ice-candidate-forward', { socket: socket.id, from: fromU, to: toU });
        } catch (error) {
            console.error('Error handling ice-candidate:', error);
            // Emit an error event back to the sender
            io.to(socket.id).emit('answer', { message: 'Error handling ICE candidate' });
        }
    });

    socket.on('ice-candidate', async (from, to) => {
        try {
            const fromU = await db('profile').where('user_id', from).first();
            const toU = await db('profile').where('user_id', to).first();

            if (!fromU || !toU) {
                // Handle user not found error
                io.to(socket.id).emit('ice-candidate-error', { message: 'Users not found' });
                return;
            }

            // Emit the ICE candidate to the intended recipient ('to')
            io.to(to).emit('ice-candidate-forward', { socket: socket.id, from: fromU, to: toU });
        } catch (error) {
            console.error('Error handling ice-candidate:', error);
            // Emit an error event back to the sender
            io.to(socket.id).emit('ice-candidate-error', { message: 'Error handling ICE candidate' });
        }
    });

    socket.on('create-room', async ({ from, to }) => {
        try {
            const fromU = await db('profile').where('user_id', from).first();
            const toU = await db('profile').where('user_id', to).first();

            if (!fromU || !toU) {
                console.log("404");
                // Emit an error event directly to the sender
                io.to(socket.id).emit('room-creation-error', { status: 400, message: 'User profiles not found' });
                return;
            }

            const data = {
                from: fromU,
                to: toU,
            };

            // Emit event to the intended recipient ('to') and send the room data
            io.to(to).emit('room-created', { socket: socket.id, data });
            io.to(socket.id).emit('room-creation-success', { status: 200, message: 'Room created successfully', data });
        } catch (error) {
            console.error('Error creating room:', error);
            // Emit an error event directly to the sender
            console.log("500");
            io.to(socket.id).emit('room-creation-error', { status: 500, message: 'Internal server error' });
        }
    });


    // const existingRoom = await db('rooms').where('appoint_id', appoint_id).where('staff_id', doctor_id).first();


    // Store user in users object
    users[socket.id] = socket;
});

app.use('/api/', roomsRouter);

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

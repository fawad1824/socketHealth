const express = require('express');
require('dotenv').config();
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const app = express();
const server = http.createServer(app);
const db = require('./db'); // Path to your db.js file
const axios = require('axios');

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

const connectedSockets = {};

io.on('connection', (socket) => {

    socket.on('offer', (data) => {
        const { targetUserId, offerData, from } = data;
        try {
            io.emit(`offer-${targetUserId}`, { "offer": offerData, "from": from, "targetUserId": targetUserId });
        } catch (e) {
            db('logs_sockets').insert({
                socket_name: `offer-${targetUserId}`,
                error: e,

            });
        }
    });

    socket.on('make-offer', (data) => {
        const { targetUserId, from } = data;
        try {
            io.emit(`make-offer-${targetUserId}`, { "from": from, "targetUserId": targetUserId });
        } catch (e) {
            db('logs_sockets').insert({
                socket_name: `make-offer-${targetUserId}`,
                error: e,
            });
        }

    });;

    socket.on('offer-acknowledgment', (data) => {
        const { from, targetUserId, offerData } = data;
        try {
            io.emit(`offer-acknowledgment-${targetUserId}`, { "offer": offerData, "from": from, "targetUserId": targetUserId });
        } catch (e) {
            db('logs_sockets').insert({
                socket_name: `offer-acknowledgment-${targetUserId}`,
                error: e,
            });
        }

    });

    socket.on('answer', (data) => {
        const { targetUserId, answerData, from } = data;
        try {
            io.emit(`answer-${targetUserId}`, { "answerData": answerData, "from": from, "targetUserId": targetUserId });
        } catch (e) {
            db('logs_sockets').insert({
                socket_name: `answer-${targetUserId}`,
                error: e,
            });
        }
    });


    socket.on('ice-candidate', (data) => {
        const { from, targetUserId, iceCandidateData } = data;
        try {
            io.emit(`ice-candidate-${targetUserId}`, { iceCandidateData, from, targetUserId });
        } catch (e) {
            db('logs_sockets').insert({
                socket_name: `ice-candidate-${targetUserId}`,
                error: e,
            });
        }
    });

    socket.on('message', async (data) => {
        try {
            const { from, to, message, tokens } = data;
            io.emit(`receive-message${to}`, { from, to, message });
            const fromU = await db('profile').where('user_id', from).first();
            const toU = await db('profile').where('user_id', to).first();

            if (!fromU || !toU) {
                if (!fromU) {
                    io.emit('notification-error', { status: false, message: 'From User not found' });
                } else if (!toU) {
                    io.emit('notification-error', { status: false, message: 'To User not found' });
                }
            }

            const doc = {
                from: fromU,
                to: toU,
            };

            const data1 = {
                data: {
                    data: doc,
                    ACTION_MESSAGE: "ACTION_MESSAGE",
                    ACTION_CALL: 'CALL_ACTION',
                    ACTION_ACCEPT_CALL: 'ACCEPT_CALL_ACTION',
                    ACTION_REJECT_CALL: 'REJECT_CALL_ACTION',
                },
                registration_ids: tokens,
            };

            axios.post('https://fcm.googleapis.com/fcm/send', data1, {
                headers: {
                    Authorization: process.env.FCM_SERVER_KEY,
                    'Content-Type': 'application/json',
                },
            }).then((response) => {
                console.log(response.data,);
                console.log("Push notification added");
                io.emit('notification-success', { status: true, data: response.data, message: 'success' });
            }).catch((error) => {
                console.error('FCM Error:', error.response.data);
                io.emit('notification-error', { status: false, message: 'Error processing request' });
            });
        } catch (error) {
            console.error('Error:', error);
            io.emit('notification-error', { status: false, message: 'Error processing request' });
        }
    });

    socket.on('userID', (userID) => {
        try {
            io.emit(`userID-${userID}`, { userID });
        } catch (e) {
            db('logs_sockets').insert({
                socket_name: `userID-${userID}`,
                error: e,
            });
        }
    });

    socket.on('call-status', (data) => {
        const { from, targetUserId, call_status } = data;
        try {
            io.emit(`call-status-${targetUserId}`, { call_status, from, targetUserId });
        } catch (e) {
            db('logs_sockets').insert({
                socket_name: `call-status-${targetUserId}`,
                error: e,
            });
        }
    });

    socket.on('disconnect', () => {
        const disconnectedUser = Object.keys(connectedSockets).find(
            (key) => connectedSockets[key] === socket.id
        );

        if (disconnectedUser) {
            delete connectedSockets[disconnectedUser];
            console.log(`User ${disconnectedUser} disconnected`);
            logAllConnectedUsers();
        }
    });

    // Function to log all connected users
    const logAllConnectedUsers = () => {
        console.log('All connected users:');
        console.log(connectedSockets);
    };

});

app.use('/api/', roomsRouter);

const port = process.env.PORT || 3000;
server.listen(port, () => {

    console.log(`Server running on port ${port}`);
});

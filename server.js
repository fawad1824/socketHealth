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
    .then(() =>
    {
        console.log('Database connected!');
    })
    .catch((err) =>
    {
        console.error('Error connecting to database:', err);
    });

const activeUsers = {};

io.on('connection', (socket) =>
{

    socket.on('offer', (data) =>
    {
        const { targetUserId, offerData, from, iceCandidates } = data;
        try
        {
            io.emit(`offer-${targetUserId}`, { "offerData": offerData, "from": from, "targetUserId": targetUserId, "iceCandidates": iceCandidates });
        } catch (e)
        {
            db('logs_sockets').insert({
                socket_name: `offer-${targetUserId}`,
                error: e.message, // Access the error message here
            });
        }
    });


    socket.on('make-offer', (data) =>
    {
        const { targetUserId, from } = data;
        try
        {
            io.emit(`make-offer-${targetUserId}`, { "from": from, "targetUserId": targetUserId });
        } catch (e)
        {
            db('logs_sockets').insert({
                socket_name: `make-offer-${targetUserId}`,
                error: e,
            });
        }
    });;

    socket.on('offer-acknowledgment', (data) =>
    {
        const { from, targetUserId, offerData } = data;
        try
        {
            io.emit(`offer-acknowledgment-${targetUserId}`, { "offer": offerData, "from": from, "targetUserId": targetUserId });
        } catch (e)
        {
            db('logs_sockets').insert({
                socket_name: `offer-acknowledgment-${targetUserId}`,
                error: e,
            });
        }

    });

    socket.on('answer', (data) =>
    {
        const { targetUserId, answerData, from } = data;
        try
        {
            io.emit(`answer-${targetUserId}`, { "answerData": answerData, "from": from, "targetUserId": targetUserId });
        } catch (e)
        {
            db('logs_sockets').insert({
                socket_name: `answer-${targetUserId}`,
                error: e,
            });
        }
    });


    socket.on('ice-candidate', (data) =>
    {
        const { from, targetUserId, iceCandidateData } = data;
        try
        {
            io.emit(`ice-candidate-${targetUserId}`, { iceCandidateData, from, targetUserId });
        } catch (e)
        {
            db('logs_sockets').insert({
                socket_name: `ice-candidate-${targetUserId}`,
                error: e,
            });
        }
    });

    socket.on('message', async (data) =>
    {
        try
        {
            const { from, to, message } = data;

            const [fromU, toU] = await Promise.all([
                db('profile').where('user_id', from).first(),
                db('profile').where('user_id', to).first()
            ]);

            if (!fromU || !toU)
            {
                const errorMsg = !fromU ? 'From User not found' : 'To User not found';
                io.emit('notification-error', { status: false, message: errorMsg });
                return;
            }

            const chatNew = {
                from_id: from,
                to_id: to,
                message,
                is_read: "1",
                is_chat: "1",
            };

            const existingMessage = await db('chat')
                .where('from_id', from)
                .where('to_id', to)
                .where('message', message)
                .first();

            let insertedMessage;
            if (!existingMessage)
            {
                [insertedMessage] = await db('chat').insert(chatNew);
            } else
            {
                insertedMessage = existingMessage;
            }

            const data1 = {
                data: {
                    fromUser: fromU,
                    toUser: toU,
                    ACTION: "MESSAGE",
                    insertedMessage: parseInt(insertedMessage.id),
                    message,
                },
                registration_ids: [toU.token],
            };
            console.log('====================================');
            console.log(data1);
            console.log('====================================');

            const response = await axios.post('https://fcm.googleapis.com/fcm/send', data1, {
                headers: {
                    Authorization: process.env.FCM_SERVER_KEY,
                    'Content-Type': 'application/json',
                },
            });

            console.log(response.data);
            console.log("Push notification added");

            io.emit('notification-success', {
                message, from: fromU, to: toU, "ACTION": "MESSAGE", insertedMessage: parseInt(insertedMessage.id) // Convert to a number

            });
        } catch (error)
        {
            console.error('Error:', error);
            io.emit('notification-error', { status: false, message: 'Error processing request' });
        }
    });




    socket.on('call-status', (data) =>
    {
        const { from, targetUserId, call_status } = data;
        try
        {
            io.emit(`call-status-${targetUserId}`, { call_status, from, targetUserId });
        } catch (e)
        {
            db('logs_sockets').insert({
                socket_name: `call-status-${targetUserId}`,
                error: e,
            });
        }
    });


    socket.on('userStatus', async (data) =>
    {
        const { userId } = data;

        if (!userId || !Array.isArray(userId))
        {
            return;
        }

        try
        {
            for (const id of userId)
            {
                activeUsers[id] = socket.id;

                io.to(socket.id).emit(`userStatus-${id}`, { isActive: true, userId: id });
                console.log(`User ${id} connected with socket ID: ${socket.id}`);

                await db('profile').where({ user_id: id }).update({ status: 'isActive' });

                socket.on(`disconnect-${id}`, async () =>
                {
                    io.emit(`userStatus-${id}`, { isDeactive: true, userId: id });
                    delete activeUsers[id];
                    console.log(`User ${id} disconnected`);

                    await db('profile').where({ user_id: id }).update({ status: 'isDeactive' });
                });
            }
        } catch (error)
        {
            db('logs_sockets').insert({
                socket_name: `userStatus-${to}`,
                error: error,
            });
            console.error(`Error updating statuses in the database: ${error.message}`);
        }
    });






});

app.use('/api/', roomsRouter);

const port = process.env.PORT || 3000;
server.listen(port, '192.168.100.57', () =>
{
    console.log(`Server running on port ${port}`);
});

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

const onlineUsers = new Set();




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

    socket.on('message', async (data, ackCallback) =>
    {
        try
        {
            const { from, to, message, created_time, messageType } = data;

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
                messageType: messageType,
                created_time: created_time
            };


            insertedMessage = await db('chat').insert(chatNew);
            ackCallback("{'msgId':" + insertedMessage + "}");
            console.log('====================================');
            console.log(chatNew);
            console.log(insertedMessage);
            console.log('====================================');


            const data1 = {
                data: {
                    fromUser: fromU,
                    toUser: toU,
                    ACTION: "MESSAGE",
                    insertedMessage: parseInt(insertedMessage),
                    message,
                },
                registration_ids: [toU.token],
            };

            const response = await axios.post('https://fcm.googleapis.com/fcm/send', data1, {
                headers: {
                    Authorization: process.env.FCM_SERVER_KEY,
                    'Content-Type': 'application/json',
                },
            });

            io.emit('notification-success', {
                message, from: fromU, to: toU, "ACTION": "MESSAGE", insertedMessage: parseInt(insertedMessage) // Convert to a number
            });

            // io.emit(`offer-acknowledgment-${to}`, { insertedMessage: parseInt(insertedMessage) });

            io.emit('pushnotification', {
                data1: data1 // Convert to a number

            });
            io.emit(`receive-message-${to}`, {
                message, from: fromU, to: toU, "ACTION": "MESSAGE", insertedMessage: parseInt(insertedMessage) // Convert to a number

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

    socket.on('message-status', async (data) =>
    {
        try
        {
            const { message_status, from, to, msgId } = data;


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
                is_read: "0",
            };
            const condition = { id: msgId };

            const data1 = {
                data: {
                    fromUser: fromU,
                    toUser: toU,
                    ACTION: "MESSAGE_STATUS",
                    is_read: message_status,
                    msgId: msgId
                },
                registration_ids: [toU.token],
            };

            const response = await axios.post('https://fcm.googleapis.com/fcm/send', data1, {
                headers: {
                    Authorization: process.env.FCM_SERVER_KEY,
                    'Content-Type': 'application/json',
                },
            });

            console.log('====================================');
            console.log(response);
            console.log('====================================');

            io.emit('notification-success', {
                message, from: fromU, to: toU, msgId: msgId, "ACTION": "MESSAGE_STATUS"
            });

            io.emit('pushnotification', {
                data1: data1 // Convert to a number

            });
            await db('chat').where(condition).update(chatNew);

            io.emit(`message-status-${to}`, { "data": data });
        } catch (e)
        {
            console.error(`Error updating statuses in the database: ${error}`);
        }
    });

    socket.on('userStatus', async (data) =>
    {
        const { userId } = data;
        try
        {
            onlineUsers.add(socket.id);
            await db('profile').where({ user_id: userId }).update({ socket_id: socket.id });
            await db('profile').where({ user_id: userId }).update({ status: 'isActive' });
            io.emit(`userOnline-${userId}`, { isActive: true, userId: userId });

        } catch (error)
        {
            console.error(`Error updating statuses in the database: ${error.message}`);
        }
    });

    socket.on('userStatusCheck', async (data, ackCallback) =>
    {
        const { userId } = data;
        try
        {
            onlineUsers.add(socket.id);
            const statusCheck = await db('profile').where({ user_id: userId });
            ackCallback({ statusCheck: statusCheck })  // ye wala aesay
            io.emit(`statusCheck-${userId}`, { statusCheck: statusCheck });

        } catch (error)
        {
            console.error(`Error updating statuses in the database: ${error.message}`);
        }
    });

    socket.on(`disconnect`, async () =>
    {
        onlineUsers.delete(socket.id);
        const profileData = await db('profile').where({ socket_id: socket.id }).first();

        if (profileData && profileData.user_id)
        {
            const userId = profileData.user_id;

            await db('profile').where({ socket_id: socket.id }).update({ status: 'isDeactive' });
            io.emit(`userOffline-${userId}`, { isActive: false, userId: userId });
        } else
        {
            console.log('No user found with the provided socket_id');
        }
    });


});

app.use('/api/', roomsRouter);

const port = process.env.PORT || 3000;
server.listen(port, '192.168.100.57', () =>
{
    console.log(`Server running on port ${port}`);
});

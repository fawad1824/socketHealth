const express = require('express');
const router = express.Router();
const db = require('../db'); // Path to your db.js file
const Joi = require('joi');
const axios = require('axios');

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises; // Import the 'fs' module with promises


const storage = multer.diskStorage({
    destination: async function (req, file, cb)
    {
        const userId = req.body.from; // Assuming 'from' is the user ID in the request body
        const userFolderPath = path.join('public/uploads', userId.toString());

        try
        {
            // Check if the user folder exists, if not, create it
            await fs.mkdir(userFolderPath, { recursive: true }); // Create directory recursively if it doesn't exist
            cb(null, userFolderPath);
        } catch (err)
        {
            cb(err);
        }
    },
    filename: function (req, file, cb)
    {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'attachment_' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Initialize multer with storage options
const upload = multer({ storage: storage });



// Create Room for Call
router.post('/room-create', async (req, res) =>
{
    const { user_id, user_firstname, user_lastname, user_role_id, user_email, user_image, user_token, doctor_id, doctor_firstname, doctor_lastname, doctor_role_id, doctor_email, doctor_image, doctor_token, appoint_id } = req.body;

    try
    {
        const roomSchema = Joi.object({
            user_id: Joi.number().required(),
            user_firstname: Joi.string().required(),
            user_lastname: Joi.string().required(), // Add user_lastname
            user_role_id: Joi.number().required(),
            user_email: Joi.string().required(),
            user_image: Joi.string().required(),
            user_token: Joi.string().required(),

            doctor_id: Joi.number().required(),
            doctor_firstname: Joi.string().required(),
            doctor_lastname: Joi.string().required(), // Add doctor_lastname
            doctor_role_id: Joi.number().required(),
            doctor_email: Joi.string().required(),
            doctor_image: Joi.string().required(),
            doctor_token: Joi.string().required(),

            appoint_id: Joi.number().required() // Add appoint_id to the schema
        });
        const { error } = roomSchema.validate(req.body);
        if (error)
        {
            return res.status(400).json({ status: false, message: error.details[0].message });
        }

        const userExists = await db('profile').where('user_id', user_id).first();
        const doctorExists = await db('profile').where('user_id', doctor_id).first();

        if (!userExists)
        {
            await db('profile').insert({
                user_id,
                first_name: user_firstname ?? "",
                last_name: user_lastname ?? "",
                role_id: user_role_id ?? "",
                email: user_email ?? "",
                image: user_image ?? "",
                token: user_token ?? ""
            });
        }

        if (!doctorExists)
        {
            await db('profile').insert({
                user_id: doctor_id ?? "",
                first_name: doctor_firstname ?? "",
                last_name: doctor_lastname ?? "",
                role_id: doctor_role_id ?? "",
                email: doctor_email ?? "",
                image: doctor_image ?? "",
                token: doctor_token ?? ""
            });
        }
        let chat = ""; // Declare as 'let' instead of 'const'

        const existingRoom = await db('rooms').where('appoint_id', appoint_id).where('staff_id', doctor_id).first();

        if (!existingRoom)
        {
            const roomName = `Room-${user_id}-${doctor_id}-${appoint_id}`;
            const [roomID] = await db('rooms').insert({ name: roomName, staff_id: doctor_id, appoint_id });

            const userRoomDetail = { user_id, room_id: roomID };
            const doctorRoomDetail = { user_id: doctor_id, room_id: roomID };

            await db('room_detail').insert(userRoomDetail);
            await db('room_detail').insert(doctorRoomDetail);

            chat = await db('chat').where('from_id', doctor_id).where('to_id', user_id).where('room_id', roomID).select('*');
        } else
        {
            const userRoomDetail = { user_id, room_id: existingRoom.id };
            const doctorRoomDetail = { user_id: doctor_id, room_id: existingRoom.id };

            chat = await db('chat').where('from_id', doctor_id).where('to_id', user_id).where('room_id', roomID).select('*');

            checkRoomJ = await db('room_detail').where('room_id', existingRoom.id).where('user_id', user_id).select('*');
            checkRoomD = await db('room_detail').where('room_id', existingRoom.id).where('user_id', doctor_id).select('*');
            if (!checkRoomJ)
            {
                await db('room_detail').insert(userRoomDetail);
            } else if (!checkRoomD)
            {
                await db('room_detail').insert(doctorRoomDetail);

            }
        }

        return res.status(200).json({ status: 200, message: "Room Created Successfully", data: chat });
    } catch (error)
    {
        console.error(error);
        return res.status(500).json({ error: 'Failed to create profile or room detail' });
    }
});

router.get('/rooms', async (req, res) =>
{
    const { doctor_id, user_id } = req.body;
    try
    {
        if (doctor_id)
        {
            const rooms = await db('rooms').where('staff_id', doctor_id).select('*');
            if (rooms.length > 0)
            {
                const roomIDs = rooms.map(room => room.id); // Extract room IDs

                // Fetch room details and user profiles based on room detail IDs
                const roomDetails = await db('room_detail').whereIn('room_id', roomIDs).select('*');
                const roomDetailIDs = roomDetails.map(roomDe => roomDe.user_id);

                const userProfiles = await db('profile').whereIn('user_id', roomDetailIDs).select('*');

                // Fetch chats based on room IDs
                const chats = await db('chat').whereIn('room_id', roomIDs).where('is_read', 0).orderBy('id', 'desc').first();
                const [unreadMessagesCount] = await db('chat').whereIn('room_id', roomIDs).where('is_read', 0).count('id as unread_count');

                // Map user profiles and chats to their corresponding rooms
                const roomsWithProfilesAndChats = rooms.map(room =>
                {
                    const roomUsers = roomDetails
                        .filter(detail => detail.room_id === room.id)
                        .map(detail => userProfiles.find(profile => profile.user_id === detail.user_id));



                    return { ...room, users: roomUsers, chats: chats, unreadMessagesCount };
                });

                return res.status(200).json({
                    status: true,
                    data: roomsWithProfilesAndChats,
                    message: 'Room List with User Profiles and Chats',
                });
            }
        } else
        {
            return res.status(200).json({
                status: true,
                data: "user_id",
                message: 'user_id chat',
            });
        }

    } catch (error)
    {
        console.log(error);
        return res.status(500).json({ status: false, message: 'Internal server error' });
    }
});


router.get('/get-rooms', async (req, res) =>
{
    const { doc_id, patient_id } = req.params;

    const rooms = await db('room').select('*');
    if (rooms)
    {
        return res.status(200).json({ status: true, data: rooms, message: 'Room List' });
    }
    return res.status(404).json({ status: false, message: 'Not Found' });
});
router.post('/add-error-logs', async (req, res) =>
{
    const { error, socket_name, app_name } = req.body;
    const roomSchema = Joi.object({
        error: Joi.string().required(),
        socket_name: Joi.string().required(),
        app_name: Joi.string().required(),
    });
    try
    {
        const { errors } = roomSchema.validate(req.body);
        if (errors)
        {
            return res.status(400).json({ status: false, message: errors.details[0].message });
        }
        const logData = {
            error: error,
            socket_name: socket_name,
            app_name: app_name
        };
        const addLogs = await db('logs_sockets').insert(logData);

        if (addLogs)
        {
            return res.status(200).json({ status: true, data: addLogs, message: 'Error added to the database' });
        } else
        {
            return res.status(400).json({ status: false, message: 'Error adding to the database' });
        }
    } catch (e)
    {

        const errorLogData = {
            error: 'Exception ' + e,
            socket_name: socket_name,
            app_name: app_name
        };
        const logError = await db('logs_sockets').insert(errorLogData);

        return res.status(500).json({
            status: false,
            message: 'Error adding to the database',
            error: e.message,
            loggedError: logError // This will be either the ID of the logged error or another indication of success/failure
        });
    }
});

// Join Room
router.post('/:roomId/join', async (req, res) =>
{
    const { roomId } = req.params;
    const { from } = req.body;
    const roomSchema = Joi.object({
        from: Joi.number().required(),
    });
    try
    {
        const { error } = roomSchema.validate(req.body);
        if (error)
        {
            return res.status(400).json({ status: false, message: error.details[0].message });
        }

        const Room = await db('room').where('id', roomId).first();
        const Calling = await db('calling')
            .where('room_name', Room.room_name)
            .where('room_id', roomId)
            .where('to', Room.doctor_id)
            .where('from', from)
            .first();
        if (!Room)
        {
            return res.status(409).json({ status: true, message: 'Not Found' });
        } else if (Calling)
        {
            return res.status(409).json({ status: true, message: 'Already Join' });
        }

        const joinRoom = {
            room_id: roomId,
            room_name: Room.room_name,
            from: from,
            to: Room.doctor_id,
        };

        await db('calling').insert(joinRoom);
        return res.status(200).json({ status: true, data: joinRoom, message: 'User Profile Create' });

    } catch (error)
    {
        console.error('Error checking email:', error);
        return res.status(500).json({ status: true, error: error });
    }
});

// check profile
router.post('/profile', async (req, res) =>
{
    const { user_id, first_name, last_name, role, email, token } = req.body;
    try
    {
        const user = await db('profile').where('email', email).first();
        if (user)
        {
            const updatedUser = {
                token
            };
            await db('profile')
                .where('email', email)
                .update(updatedUser);

            console.log('====================================');
            console.log(updatedUser);
            console.log('====================================');

            return res.status(409).json({ status: true, data: user, message: 'User already exists and token updated' });
        } else
        {
            const newUser = {
                user_id,
                first_name,
                last_name,
                role,
                email,
                token,
                status: "isActive"
            };
            await db('profile').insert(newUser);
            return res.status(200).json({ status: true, data: newUser, message: 'User Profile Create' });
        }
    } catch (error)
    {
        console.error('Error checking email:', error);
        return res.status(500).json({ status: true, error: error });
    }
});

// Chat
router.post('/chat', upload.single('attachment'), async (req, res) =>
{
    try
    {
        const { from, to, message } = req.body;

        const baseUrl = req.protocol + '://' + req.get('host'); // Extracts the base URL dynamically

        // const roomSchema = Joi.object({
        //     from: Joi.number().required(),
        //     to: Joi.number().required(),
        //     // message: Joi.string().required(),
        // });

        // const { error } = roomSchema.validate({ from, to });

        // if (error)
        // {
        //     return res.status(400).json({ status: false, message: error.details[0].message });
        // }


        const chatNew = {
            from_id: from,
            to_id: to,
            message: message,
            is_read: "1",
            is_chat: "1",
        };

        if (req.file)
        {
            const userId = req.body.from; // Assuming 'from' is the user ID in the request body
            const filePath = `/public/uploads/${userId}/${req.file.filename}`;
            chatNew.attachment = baseUrl + filePath; // Prepends base URL to the file path

        }

        const [chatList] = await db('chat').insert(chatNew);
        const insertedChat = await db('chat').where('id', chatList).first();

        return res.status(200).json({ status: true, data: insertedChat, data: req.body, message: 'Chat Created' });
    } catch (error)
    {
        return res.status(500).json({ status: false, error: error.message });
    }
});






router.post('/fcm-token', async (req, res) =>
{
    const { tokens, from, to, ACTION, customData, message } = req.body;
    const fromU = await db('profile').where('user_id', from).first();
    const toU = await db('profile').where('user_id', to).first();

    if (!fromU || !toU)
    {
        if (!fromU)
        {
            return res.status(404).json({ status: false, data: fromU, message: 'From User not found' });
        } else if (!toU)
        {
            return res.status(404).json({ status: false, data: toU, message: 'To User not found' });
        }
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


    const data = {
        data: {
            "patienr": fromU,
            "doc_id": fromU.id,
            "patient_id": toU.id,
            ACTION: ACTION,
            customData: customData,
            insertedMessage: parseInt(insertedMessage.id),
        },
        registration_ids: tokens,
    };

    axios.post('https://fcm.googleapis.com/fcm/send', data, {
        headers: {
            Authorization: process.env.FCM_SERVER_KEY,
            'Content-Type': 'application/json',
        },
    }).then((response) =>
    {
        return res.status(200).json({ status: true, customData: customData, message: message, from: fromU, ACTION: ACTION, to: toU, data: response.data, insertedMessage: parseInt(insertedMessage.id) });
    }).catch((error) =>
    {
        return res.status(500).json({ status: false, data: error, message: 'To User not found' });
    });
});



module.exports = router;

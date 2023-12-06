const express = require('express');
const router = express.Router();
const db = require('../db'); // Path to your db.js file
const Joi = require('joi');

// Create Room for Call
router.post('/room-create', async (req, res) => {
    const { user_id, user_firstname, user_lastname, user_role_id, user_email, user_image, user_token, doctor_id, doctor_firstname, doctor_lastname, doctor_role_id, doctor_email, doctor_image, doctor_token, appoint_id } = req.body;

    try {
        const roomSchema = Joi.object({
            user_id: Joi.number().required(),
            user_firstname: Joi.string().required(),
            user_role_id: Joi.number().required(),
            user_email: Joi.string().required(),
            user_image: Joi.string().required(),
            user_token: Joi.string().required(),

            doctor_id: Joi.number().required(),
            doctor_firstname: Joi.string().required(),
            doctor_role_id: Joi.number().required(),
            doctor_email: Joi.string().required(),
            doctor_image: Joi.string().required(),
            doctor_token: Joi.string().required(),

            appoint_id: Joi.number().required() // Add appoint_id to the schema
        });
        const { error } = roomSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ status: false, message: error.details[0].message });
        }

        const userExists = await db('profile').where('user_id', user_id).first();
        const doctorExists = await db('profile').where('user_id', doctor_id).first();

        if (!userExists) {
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

        if (!doctorExists) {
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

        if (!existingRoom) {
            const roomName = `Room-${user_id}-${doctor_id}-${appoint_id}`;
            const [roomID] = await db('rooms').insert({ name: roomName, staff_id: doctor_id, appoint_id });

            const userRoomDetail = { user_id, room_id: roomID };
            const doctorRoomDetail = { user_id: doctor_id, room_id: roomID };

            await db('room_detail').insert(userRoomDetail);
            await db('room_detail').insert(doctorRoomDetail);

            chat = await db('chat').where('from_id', doctor_id).where('to_id', user_id).where('room_id', roomID).select('*');
        } else {
            const userRoomDetail = { user_id, room_id: existingRoom.id };
            const doctorRoomDetail = { user_id: doctor_id, room_id: existingRoom.id };

            await db('room_detail').insert(userRoomDetail);
            await db('room_detail').insert(doctorRoomDetail);

            chat = await db('chat').where('from_id', doctor_id).where('to_id', user_id).where('room_id', existingRoom.id).select('*');
        }

        return res.status(200).json({ status: 200, message: "Room Created Successfully", data: chat });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to create profile or room detail' });
    }
});

router.get('/rooms', async (req, res) => {
    const { data, staff_id, user_id } = req.body;
    try {
        if (data == '1') {
            const rooms = await db('rooms').where('staff_id', staff_id).select('*');
            if (rooms.length > 0) {
                const roomIDs = rooms.map(room => room.id); // Extract room IDs

                // Fetch room details and user profiles based on room detail IDs
                const roomDetails = await db('room_detail').whereIn('room_id', roomIDs).select('*');
                const roomDetailIDs = roomDetails.map(roomDe => roomDe.user_id);

                const userProfiles = await db('profile').whereIn('user_id', roomDetailIDs).select('*');

                // Fetch chats based on room IDs
                const chats = await db('chat').whereIn('room_id', roomIDs).select('*');

                // Map user profiles and chats to their corresponding rooms
                const roomsWithProfilesAndChats = rooms.map(room => {
                    const roomUsers = roomDetails
                        .filter(detail => detail.room_id === room.id)
                        .map(detail => userProfiles.find(profile => profile.user_id === detail.user_id));

                    const roomChats = chats.filter(chat => chat.room_id === room.id);

                    return { ...room, users: roomUsers, chats: roomChats };
                });

                return res.status(200).json({
                    status: true,
                    data: roomsWithProfilesAndChats,
                    message: 'Room List with User Profiles and Chats',
                });
            }
        } else {
            // Fetch room details and user profiles based on room detail IDs
            const roomDetails = await db('room_detail').whereIn('user_id', user_id).select('*');
            const roomDetailIDs = roomDetails.map(roomDe => roomDe.user_id);
            const roomDetailID = roomDetails.map(roomDe => roomDe.id);

            const userProfiles = await db('profile').whereIn('user_id', roomDetailIDs).select('*');
            const rooms = await db('rooms').where('id', roomDetailID).select('*');


            // Fetch chats based on room IDs
            const chats = await db('chat').whereIn('room_id', roomIDs).select('*');

            // Map user profiles and chats to their corresponding rooms
            const roomsWithProfilesAndChats = rooms.map(room => {
                const roomUsers = roomDetails
                    .filter(detail => detail.room_id === room.id)
                    .map(detail => userProfiles.find(profile => profile.user_id === detail.user_id));

                const roomChats = chats.filter(chat => chat.room_id === room.id);

                return { ...room, users: roomUsers, chats: roomChats };
            });

            return res.status(200).json({
                status: true,
                data: roomsWithProfilesAndChats,
                message: 'Room List with User Profiles and Chats',
            });
        }

        return res.status(404).json({ status: false, message: 'No rooms found for the provided staff ID' });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ status: false, message: 'Internal server error' });
    }
});



router.get('/get-rooms', async (req, res) => {
    const { doc_id, patient_id } = req.params;

    const rooms = await db('room').select('*');
    if (rooms) {
        return res.status(200).json({ status: true, data: rooms, message: 'Room List' });
    }
    return res.status(404).json({ status: false, message: 'Not Found' });
});

// Join Room
router.post('/:roomId/join', async (req, res) => {
    const { roomId } = req.params;
    const { from } = req.body;
    const roomSchema = Joi.object({
        from: Joi.number().required(),
    });
    try {
        const { error } = roomSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ status: false, message: error.details[0].message });
        }

        const Room = await db('room').where('id', roomId).first();
        const Calling = await db('calling')
            .where('room_name', Room.room_name)
            .where('room_id', roomId)
            .where('to', Room.doctor_id)
            .where('from', from)
            .first();
        if (!Room) {
            return res.status(409).json({ status: true, message: 'Not Found' });
        } else if (Calling) {
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

    } catch (error) {
        console.error('Error checking email:', error);
        return res.status(500).json({ status: true, error: error });
    }
});

// check profile
router.post('/profile', async (req, res) => {
    const { user_id, first_name, last_name, role, email } = req.body;
    try {
        const user = await db('profile').where('email', email).first();
        if (user) {
            return res.status(409).json({ status: true, data: user, message: 'User already exists' });
        } else {
            const newUser = {
                user_id,
                first_name,
                last_name,
                role,
                email
            };
            await db('profile').insert(newUser);
            return res.status(200).json({ status: true, data: newUser, message: 'User Profile Create' });
        }
    } catch (error) {
        console.error('Error checking email:', error);
        return res.status(500).json({ status: true, error: error });
    }
});

// Chat
router.post('/chat', async (req, res) => {
    const roomSchema = Joi.object({
        from: Joi.number().required(),
        to: Joi.number().required(),
        message: Joi.string().required(),
    });
    const { error } = roomSchema.validate(req.body);
    if (error) {
        return res.status(400).json({ status: false, message: error.details[0].message });
    }
    try {
        const { from, to, message } = req.body;
        const chatNew = {
            from,
            to,
            message,
        };
        await db('chat').insert(chatNew);
        return res.status(200).json({ status: true, data: chatNew, message: 'Chat Created' });
    } catch (error) {
        return res.status(500).json({ status: true, error: error });
    }
});


module.exports = router;
// AKIAYK2UM2DCSDION76P

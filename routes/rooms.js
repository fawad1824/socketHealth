const express = require('express');
const router = express.Router();
const db = require('../db'); // Path to your db.js file
const Joi = require('joi');

// Create Room for Call
router.post('/room-create', async (req, res) => {
    const { user_id, staff_id, first_name, last_name, role, email, image, token, role_id } = req.body;

    try {
        const roomSchema = Joi.object({
            user_id: Joi.number().required(),
            staff_id: Joi.number().required(),
            first_name: Joi.string().required(),
            last_name: Joi.string().required(),
            role: Joi.string().required(),
            email: Joi.string().required(),
            image: Joi.string().required(),
            token: Joi.string().required(),
            role_id: Joi.number().required(),
        });
        const { error } = roomSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ status: false, message: error.details[0].message });
        }

        const roomName = "Room-" + Math.floor(Math.random() * 1000000); // Generates a random number between 0 to 999999

        const newRoom = { name: roomName, staff_id };
        const [roomID] = await db('rooms').insert(newRoom);

        const newProfile = {
            user_id,
            first_name,
            last_name,
            role,
            email,
            image,
            token,
            role_id: role_id || null // Set role_id to null if it's an empty string
        };

        [profileID] = await db('profile').insert(newProfile);

        // Create a new room_detail record linking room and profile
        const newRoomDetail = { user_id, room_id: roomID, profile_id: profileID };
        const [roomDetailID] = await db('room_detail').insert(newRoomDetail);

        // Respond with the IDs of the inserted records
        res.status(200).json(
            {
                "status": 200,
                "message": "Room Created Successfully"
            }
        );
    } catch (error) {
        // Handle the insertion error
        res.status(500).json({ error: 'Failed to create profile or room detail' });
    }






    // const roomSchema = Joi.object({
    //     user_id: Joi.number().required(),
    //     room_name: Joi.string().required(),
    // });
    // const { doctor_id, room_name, } = req.body;
    // try {
    //     const { error } = roomSchema.validate(req.body);
    //     if (error) {
    //         return res.status(400).json({ status: false, message: error.details[0].message });
    //     }
    //     const user = await db('room').where('room_name', room_name).where('doctor_id', doctor_id).first();
    //     if (user) {
    //         return res.status(409).json({ status: true, data: user, message: 'Room already exists' });
    //     }
    //     const newRoom = {
    //         doctor_id,
    //         room_name,
    //     };
    //     await db('room').insert(newRoom);
    //     return res.status(200).json({ status: true, data: newRoom, message: 'Room Created Successfully' });
    // } catch (error) {
    //     console.log(error);
    //     return res.status(500).json({ error: "server error" });
    // }
});

// Get All Room
router.get('/rooms/:staff_id', async (req, res) => {
    const { staff_id } = req.params;
    try {
        const rooms = await db('rooms').where('staff_id', staff_id).select('*');

        if (rooms.length > 0) {
            const roomIDs = rooms.map(room => room.id); // Extract room IDs

            const roomDetails = await db('room_detail').whereIn('room_id', roomIDs).select('*');
            const profileIDs = roomDetails.map(detail => detail.profile_id); // Extract profile IDs

            const userProfiles = await db('profile').whereIn('id', profileIDs).select('*');

            return res.status(200).json({ status: true, data: { rooms, userProfiles }, message: 'Room List with User Profiles' });
        }

        return res.status(404).json({ status: false, message: 'No rooms found for the provided staff ID' });
    } catch (error) {
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

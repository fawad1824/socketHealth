const express = require('express');
const router = express.Router();
const db = require('../db'); // Path to your db.js file
const Joi = require('joi');

// Create Room for Call
router.post('/room-create', async (req, res) => {
    const roomSchema = Joi.object({
        doctor_id: Joi.number().required(),
        room_name: Joi.string().required(),
    });
    const { doctor_id, room_name, } = req.body;
    try {
        const { error } = roomSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ status: false, message: error.details[0].message });
        }
        const user = await db('room').where('room_name', room_name).where('doctor_id', doctor_id).first();
        if (user) {
            return res.status(409).json({ status: true, data: user, message: 'Room already exists' });
        }
        const newRoom = {
            doctor_id,
            room_name,
        };
        await db('room').insert(newRoom);
        return res.status(200).json({ status: true, data: newRoom, message: 'Room Created Successfully' });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: "server error" });
    }
});

// Get All Room
router.get('/rooms', async (req, res) => {
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

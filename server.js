const express = require('express');
require('dotenv').config();
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const mysql = require('mysql');

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORS middleware
app.use(cors());




// Replace with your MySQL database configuration
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: process.env.DB_PASSWORD,
  database: 'sockets',
});

connection.connect((error) => {
  if (error) {
    console.error('Error connecting to MySQL:', error);
    return;
  }
  console.log('Connected to MySQL');

  // Perform a sample query
  connection.query('SELECT 1 + 1 AS solution', (queryError, results) => {
    if (queryError) {
      console.error('Error executing query:', queryError);
      return;
    }
    console.log('The solution is:', results[0].solution);
  });

  // Close the connection after the query
  connection.end((endError) => {
    if (endError) {
      console.error('Error closing connection:', endError);
      return;
    }
    console.log('Connection closed');
  });
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


const port = process.env.PORT;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});



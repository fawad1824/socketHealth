const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors'); // Import the cors package

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors()); // Enable CORS for all routes

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('offer', (offer) => {
    socket.broadcast.emit('offer', offer);
  });

  socket.on('answer', (answer) => {
    socket.broadcast.emit('answer', answer);
  });

  socket.on('ice-candidate', (candidate) => {
    socket.broadcast.emit('ice-candidate', candidate);
  });

  // Listen for 'message' from a peer and broadcast it to all other peers
  socket.on('message', (message) => {
    console.log(message);
    socket.broadcast.emit('message', message);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

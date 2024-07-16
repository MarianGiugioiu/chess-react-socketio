const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Chess } = require('chess.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const games = {};

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('createGame', () => {
    const gameId = Math.random().toString(36).substring(7);
    games[gameId] = new Chess();
    socket.join(gameId);
    socket.emit('gameCreated', gameId);
  });

  socket.on('joinGame', (gameId) => {
    if (games[gameId]) {
      socket.join(gameId);
      socket.emit('gameJoined', gameId);
      io.to(gameId).emit('gameState', games[gameId].fen());
    } else {
      socket.emit('error', 'Game not found');
    }
  });

  socket.on('move', ({ gameId, move }) => {
    if (games[gameId]) {
      try {
        games[gameId].move(move);
        io.to(gameId).emit('gameState', games[gameId].fen());
      } catch (e) {
        socket.emit('error', 'Invalid move');
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
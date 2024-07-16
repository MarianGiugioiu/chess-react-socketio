import React, { useEffect, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import io from 'socket.io-client';

const socket = io('http://localhost:4000');

export default function MultiplayerChessboard() {
  const [game, setGame] = useState(new Chess());
  const [gameId, setGameId] = useState(null);
  const [playerColor, setPlayerColor] = useState('w');

  useEffect(() => {
    socket.on('gameCreated', (id) => {
      setGameId(id);
      setPlayerColor('w');
    });

    socket.on('gameJoined', (id) => {
      setGameId(id);
      setPlayerColor('b');
    });

    socket.on('gameState', (fen) => {
      setGame(new Chess(fen));
    });

    socket.on('error', (message) => {
      console.error(message);
    });

    return () => {
      socket.off('gameCreated');
      socket.off('gameJoined');
      socket.off('gameState');
      socket.off('error');
    };
  }, []);

  function createGame() {
    socket.emit('createGame');
  }

  function joinGame(id) {
    socket.emit('joinGame', id);
  }

  function onDrop(sourceSquare, targetSquare) {
    if (game.turn() !== playerColor) return false;

    const move = {
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q' // always promote to queen for simplicity
    };

    try {
      const newGame = new Chess(game.fen());
      newGame.move(move);
      setGame(newGame);
      socket.emit('move', { gameId, move });
      return true;
    } catch (error) {
      return false;
    }
  }

  return (
    <div>
      {!gameId && (
        <div>
          <button onClick={createGame}>Create New Game</button>
          <input 
            type="text" 
            placeholder="Enter Game ID"
            onKeyPress={(e) => e.key === 'Enter' && joinGame(e.target.value)}
          />
        </div>
      )}
      {gameId && <p>Game ID: {gameId}</p>}
      {gameId && <Chessboard 
        position={game.fen()} 
        onPieceDrop={onDrop}
        boardOrientation={playerColor === 'b' ? 'black' : 'white'}
        boardWidth={window.innerHeight - 50}
      />}
    </div>
  );
}
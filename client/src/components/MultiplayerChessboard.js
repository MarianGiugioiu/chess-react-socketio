import React, { forwardRef, useEffect, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import io from 'socket.io-client';

const REACT_APP_SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:4000';
const socket = io(REACT_APP_SERVER_URL);

export default function MultiplayerChessboard() {
  const [game, setGame] = useState(new Chess());
  const [gameId, setGameId] = useState(null);
  const [playerColor, setPlayerColor] = useState('w');
  const [currentTurn, setCurrentTurn] = useState('w');
  const [status, setStatus] = useState('');
  const [capturedPieces, setCapturedPieces] = useState({ w: [], b: [] });
  const [customSquareStyles, setCustomSquareStyles] = useState({});

  function getPieceName(pieceCode) {
    const pieceNames = {
      'p': 'Pawn',
      'n': 'Knight',
      'b': 'Bishop',
      'r': 'Rook',
      'q': 'Queen',
      'k': 'King'
    };
    return pieceNames[pieceCode] || pieceCode;
  }

  useEffect(() => {
    socket.on('gameCreated', (id) => {
      setGameId(id);
      setPlayerColor('w');
      setStatus("Waiting for opponent to join...");
    });

    socket.on('gameJoined', (id) => {
      setGameId(id);
      setPlayerColor('b');
      setStatus("Game started. White's turn.");
    });

    socket.on('gameState', (fen) => {
      const newGame = new Chess(fen);
      setGame(newGame);
      setCurrentTurn(newGame.turn());
      updateGameStatus(newGame);
      updateCapturedPieces(newGame);
    });

    socket.on('error', (message) => {
      console.error(message);
      setStatus(`Error: ${message}`);
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

  function onPieceDragBegin(piece, sourceSquare) {
    setCustomSquareStyles({
      [sourceSquare]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' },
    });
  }

  function onPieceDragEnd() {
    setCustomSquareStyles({});
  }

  function onDrop(sourceSquare, targetSquare, piece) {
    if (game.turn() !== playerColor) return false;

    const move = {
      from: sourceSquare,
      to: targetSquare,
      promotion: piece[1].toLowerCase()
    };

    try {
      const newGame = new Chess(game.fen());
      newGame.move(move);
      setGame(newGame);
      setCurrentTurn(newGame.turn());
      updateGameStatus(newGame);
      updateCapturedPieces(newGame);
      socket.emit('move', { gameId, move });
      setCustomSquareStyles({}); // Clear the highlight
      return true;
    } catch (error) {
      return false;
    }
  }

  function updateGameStatus(newGame) {
    let newStatus = '';
    if (newGame.isCheckmate()) {
      newStatus = `Checkmate! ${newGame.turn() === 'w' ? 'Black' : 'White'} wins.`;
    } else if (newGame.isDraw()) {
      newStatus = "Game over. It's a draw.";
    } else if (newGame.isCheck()) {
      newStatus = `Check! ${newGame.turn() === 'w' ? 'White' : 'Black'} to move.`;
    } else {
      newStatus = `${newGame.turn() === 'w' ? 'White' : 'Black'} to move.`;
    }
    setStatus(newStatus);
  }

  function updateCapturedPieces(newGame) {
    const captured = { w: [], b: [] };
    const board = newGame.board();
    const pieceCount = { 
      w: { p: 8, n: 2, b: 2, r: 2, q: 1 },
      b: { p: 8, n: 2, b: 2, r: 2, q: 1 }
    };

    board.forEach(row => {
      row.forEach(piece => {
        if (piece) {
          pieceCount[piece.color][piece.type]--;
        }
      });
    });

    ['w', 'b'].forEach(color => {
      Object.entries(pieceCount[color]).forEach(([type, count]) => {
        for (let i = 0; i < count; i++) {
          captured[color === 'w' ? 'b' : 'w'].push(type);
        }
      });
    });

    setCapturedPieces(captured);
  }

  return (
    <div style={{display: 'flex', justifyContent: 'center', alignItems: 'flex-start', height: '100vh', padding: '20px'}}>
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
      {gameId && (
        <div style={{display: 'flex', alignItems: 'flex-start'}}>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <div style={{display: 'flex', justifyContent:'space-between', width: '100%', marginBottom: '10px'}}>
              <p>Game ID: {gameId}</p>
              <p>{status}</p>
            </div>
            <div style={{display: 'flex'}}>
              <Chessboard 
                position={game.fen()} 
                onPieceDrop={onDrop}
                onPieceDragBegin={onPieceDragBegin}
                onPieceDragEnd={onPieceDragEnd}
                customSquareStyles={customSquareStyles}
                boardOrientation={playerColor === 'b' ? 'black' : 'white'}
                boardWidth={Math.min(800, window.innerWidth - 220)}
              />
              <div style={{marginLeft: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-around'}}>
                <div style={{marginBottom: '20px'}}>
                  <h3>Captured by White:</h3>
                  <div>{capturedPieces.w.map(piece => getPieceName(piece)).join(', ')}</div>
                </div>
                <div>
                  <h3>Captured by Black:</h3>
                  <div>{capturedPieces.b.map(piece => getPieceName(piece)).join(', ')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
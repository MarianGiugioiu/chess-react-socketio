import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import io from 'socket.io-client';
import { cloneDeep } from 'lodash';

const REACT_APP_SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:4000';
const socket = io(REACT_APP_SERVER_URL);

export default function MultiplayerChessboard() {
  const [game, setGame] = useState(new Chess());
  const [gameId, setGameId] = useState(null);
  const [playerColor, setPlayerColor] = useState('w');
  const [status, setStatus] = useState('');
  const [capturedPieces, setCapturedPieces] = useState({ w: [], b: [] });
  const [customSquareStyles, setCustomSquareStyles] = useState({});
  const [selectedVoice, setSelectedVoice] = useState(null);
  const stockfishRef = useRef(null);
  const [currentBotMove, setCurrentBotMove] = useState('');
  const [draggedPieceSquare, setDraggedPieceSquare] = useState(null);

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

  function getRomanianPieceName(pieceCode) {
    const romanianPieceNames = {
      'p': 'pionul',
      'n': 'calul',
      'b': 'nebunul',
      'r': 'tura',
      'q': 'regina',
      'k': 'regele'
    };
    return romanianPieceNames[pieceCode.toLowerCase()] || pieceCode;
  }

  function getPossibleMoves(square) {
    const moves = game.moves({ square: square, verbose: true });
    return moves.map(move => move.to);
  }

  useEffect(() => {
    if (draggedPieceSquare) {
      const possibleMoves = getPossibleMoves(draggedPieceSquare);
      const newStyles = {
        [draggedPieceSquare]: { backgroundColor: 'rgba(255, 165, 0, 0.5)' }
      };
      possibleMoves.forEach(square => {
        newStyles[square] = { backgroundColor: 'rgba(0, 255, 0, 0.4)' };
      });
      setCustomSquareStyles(newStyles);
    } else {
      setCustomSquareStyles({});
    }
  }, [draggedPieceSquare, game]);

  useEffect(() => {
    socket.on('gameState', (fen) => {
      const newGame = new Chess(fen);
      setGame(newGame);
      makeStockfishMove(newGame);
      updateGameStatus(newGame);
      updateCapturedPieces(newGame)
    });
    return () => {
      socket.off('gameState');
    }
  }, [playerColor]);

  useEffect(() => {
    socket.on('receiveBotMessage', (message) => {
      speak(message);
    });
    return () => {
      socket.off('receiveBotMessage');
    }
  }, [selectedVoice]);

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

    socket.on('error', (message) => {
      console.error(message);
      setStatus(`Error: ${message}`);
    });

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setSelectedVoice(availableVoices[3]);
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    const sf = new Worker(`${process.env.PUBLIC_URL}/stockfish.js`);
    stockfishRef.current = sf;

    sf.onmessage = (event) => {
      const message = event.data;
      if (message.startsWith('bestmove')) {
        const move = message.split(' ')[1];
        if (move !== '(none)') {
          setCurrentBotMove(move);
        }
      }
    };

    sf.postMessage('uci');
    sf.postMessage('isready');
    sf.postMessage(`setoption name Skill Level value ${10}`);

    return () => {
      sf.terminate();
      socket.off('gameCreated');
      socket.off('gameJoined');
      socket.off('error');
    };
  }, []);

  function createGame() {
    socket.emit('createGame');
  }

  function joinGame(id) {
    socket.emit('joinGame', id);
  }

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.pitch = 0.7;
        utterance.rate = 0.7;
      }
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Speech synthesis is not supported in your browser.');
    }
  };

  function makeStockfishMove(newGame) {
    if (newGame.turn() === playerColor) {
      const fen = newGame.fen();
      stockfishRef.current.postMessage(`position fen ${fen}`);
      stockfishRef.current.postMessage(`go depth ${15} movetime ${1000}`);
    }
  }

  function onPieceDragBegin(piece, sourceSquare) {
    setDraggedPieceSquare(sourceSquare);
  }

  function onPieceDragEnd() {
    setDraggedPieceSquare(null);
  }

  function onDrop(sourceSquare, targetSquare, piece) {
    if (game.turn() !== playerColor || status === 'Waiting for opponent to join...') return false;

    const move = {
      from: sourceSquare,
      to: targetSquare,
      promotion: piece[1].toLowerCase()
    };

    try {
      const newGame = new Chess(game.fen());
      newGame.move(move);
      generateBotMessage(cloneDeep(game), move);
      setGame(newGame);
      setDraggedPieceSquare(null);
      updateGameStatus(newGame);
      updateCapturedPieces(newGame);
      socket.emit('move', { gameId, move });
      setCustomSquareStyles({});
      return true;
    } catch (error) {
      return false;
    }
  }

  function generateBotMessage(oldGame, playerMove) {
    const sourcePiece = oldGame.get(currentBotMove.slice(0, 2));
    const targetPiece = oldGame.get(currentBotMove.slice(2, 4));
    if (targetPiece && (playerMove.from !== currentBotMove.slice(0, 2) || playerMove.to !== currentBotMove.slice(2, 4))) {
      const message = generateIronicMessage(sourcePiece.type, targetPiece.type);
      socket.emit('createBotMessage', { gameId, message });
    }
  }

  function generateIronicMessage(movingPieceCode, capturedPieceCode) {
    const movingPiece = getRomanianPieceName(movingPieceCode);
    const capturedPiece = getRomanianPieceName(capturedPieceCode);
  
    const messages = [
      `Se pare că ${capturedPiece} adversarului ți-a făcut cu ochiul, dar ${movingPiece} tău e prea timid să-l ia.`,
      `${movingPiece} tău tocmai a refuzat o invitație la dans cu ${capturedPiece} advers. Ce nepoliticos!`,
      `Ai decis să lași ${capturedPiece} în pace? Ce drăguț din partea ta să fii așa de milos!`,
      `${movingPiece} tău tocmai a ratat ocazia de a deveni erou. Poate data viitoare!`,
      `Se pare că ${movingPiece} tău preferă să admire ${capturedPiece} de la distanță. Romantic, dar nu prea eficient.`,
      `Ai ales calea pacifistă, ignorând ${capturedPiece} advers. Premiul Nobel pentru pace se încarcă...`,
      `${movingPiece} tău tocmai a demonstrat că prietenia e mai importantă decât victoria. Bravo!`,
      `Ai lăsat ${capturedPiece} adversarului în viață. Sper că apreciază gestul tău de bunătate!`,
    ];
  
    return messages[Math.floor(Math.random() * messages.length)];
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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', height: '100vh', padding: '20px' }}>
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
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', height: '40px', marginBottom: '10px' }}>
              <p>Game ID: {gameId}</p>
              <p>{status}</p>
            </div>
            <div style={{ display: 'flex' }}>
              <Chessboard
                position={game.fen()}
                onPieceDrop={onDrop}
                onPieceDragBegin={onPieceDragBegin}
                onPieceDragEnd={onPieceDragEnd}
                customSquareStyles={customSquareStyles}
                boardOrientation={playerColor === 'b' ? 'black' : 'white'}
                boardWidth={Math.min(800, window.innerHeight - 80)}
              />
              <div style={{ marginLeft: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
                <div style={{ marginBottom: '20px' }}>
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
import { useEffect, useState, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

export default function ChessboardComponent() {
  const [game, setGame] = useState(new Chess());
  const [stockfish, setStockfish] = useState(null);
  const stockfishRef = useRef(null);

  // Bot settings
  const [moveTimeMs, setMoveTimeMs] = useState(1000); // 1 second think time
  const [skillLevel, setSkillLevel] = useState(10); // Range: 0-20
  const [searchDepth, setSearchDepth] = useState(15); // Adjust as needed

  useEffect(() => {
    const sf = new Worker(`${process.env.PUBLIC_URL}/stockfish.js`);
    setStockfish(sf);
    stockfishRef.current = sf;

    sf.onmessage = (event) => {
      const message = event.data;
      if (message.startsWith('bestmove')) {
        const move = message.split(' ')[1];
        if (move !== '(none)') {
          setGame(prevGame => {
            const newGame = new Chess(prevGame.fen());
            newGame.move({
              from: move.slice(0, 2),
              to: move.slice(2, 4),
              promotion: move.length === 5 ? move[4] : undefined
            });
            return newGame;
          });
        }
      }
    };

    sf.postMessage('uci');
    sf.postMessage('isready');
    sf.postMessage(`setoption name Skill Level value ${skillLevel}`);

    return () => {
      sf.terminate();
    };
  }, [skillLevel]);

  useEffect(() => {
    if (game.turn() === 'b') {  // Assuming the bot plays as black
      makeStockfishMove();
    }
  }, [game]);

  function makeStockfishMove() {
    const fen = game.fen();
    stockfishRef.current.postMessage(`position fen ${fen}`);
    stockfishRef.current.postMessage(`go depth ${searchDepth} movetime ${moveTimeMs}`);
  }

  function onDrop(source, target) {
    setGame(prevGame => {
      const newGame = new Chess(prevGame.fen());
      try {
        newGame.move({
          from: source,
          to: target,
          promotion: 'q'
        });
      } catch(err) {
        return prevGame;  // Invalid move, don't update the state
      }
      return newGame;
    });
  }

  // Function to adjust bot difficulty
  function adjustDifficulty(level) {
    setSkillLevel(level);
    setMoveTimeMs(level * 100); // Adjust think time based on level
    setSearchDepth(Math.min(level, 20)); // Cap depth at 20
  }

  return (
    <div>
      <div>
        <button onClick={() => adjustDifficulty(5)}>Easy</button>
        <button onClick={() => adjustDifficulty(10)}>Medium</button>
        <button onClick={() => adjustDifficulty(15)}>Hard</button>
        <button onClick={() => adjustDifficulty(20)}>Very Hard</button>
      </div>
      <Chessboard position={game.fen()} onPieceDrop={onDrop} boardWidth={900}/>
    </div>
  );
}
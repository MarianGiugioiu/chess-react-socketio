import { Canvas } from '@react-three/fiber';
import './App.css';
import ChessboardComponent from './components/ChessboardComponent';
import MultiplayerChessboard from './components/MultiplayerChessboard';
import PlaneComponent from './components/PlaneComponent';

function App() {
  return (
    <div className="App">
      <div className="canvas-container">
        <Canvas style={{ width: '100%', height: '100vh' }} shadows>
          <ambientLight intensity={0.2} />
          <pointLight position={[10, 10, 10]} castShadow intensity={0.8} />
          <PlaneComponent />
        </Canvas>
      </div>
      <div className="chessboard-container">
        <MultiplayerChessboard />
      </div>
    </div>
  );
}

export default App;

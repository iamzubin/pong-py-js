import { useEffect, useRef, useState } from 'react';
import p5 from 'p5';
import './App.css';
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";

const App = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [inputRoomId, setInputRoomId] = useState<string>('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [playerNumber, setPlayerNumber] = useState<number | null>(null);
  const [gameStarted, setGameStarted] = useState<boolean>(false);

  const connectToRoom = (roomId: string) => {
    const websocket = new WebSocket(`ws://localhost:8765`);
    setWs(websocket);

    websocket.onopen = () => {
      console.log('Connected to WebSocket server');
      websocket.send(JSON.stringify({ roomId }));
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received data:', data);
      updateGameState(data);

      if (data.assignPlayer) {
        setPlayerNumber(data.assignPlayer);
      } else if (data.game_started !== undefined) {
        setGameStarted(data.game_started);
      } else {
        updateGameState(data);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('Disconnected from WebSocket server');
    };
  };

  const handleJoinRoom = () => {
    if (inputRoomId.trim() !== '') {
      setRoomId(inputRoomId);
      connectToRoom(inputRoomId);
    }
  };

  const updateGameState = (data: any) => {
    if (window['updateGameState']) {
      window['updateGameState'](data);
    }
  };

  useEffect(() => {
    if (!canvasRef.current || !ws || playerNumber === null || !gameStarted) return;

    const sketch = (p: p5) => {
      let playerPaddle = { x: playerNumber === 1 ? 30 : 760, y: 200, width: 10, height: 60 };
      let opponentPaddle = { x: playerNumber === 1 ? 760 : 30, y: 200, width: 10, height: 60 };
      let ball = { x: 400, y: 300, size: 10 };
      let playerScore = 0;
      let opponentScore = 0;

      p.setup = () => {
        p.createCanvas(800, 600);
        p.frameRate(60);
      };

      p.draw = () => {
        p.background(0);

        // Draw paddles
        p.fill(255);
        p.rect(playerPaddle.x, playerPaddle.y, playerPaddle.width, playerPaddle.height);
        p.rect(opponentPaddle.x, opponentPaddle.y, opponentPaddle.width, opponentPaddle.height);

        // Draw ball
        p.circle(ball.x, ball.y, ball.size);

        // Draw scores
        p.textSize(32);
        p.fill(255);
        p.text(playerScore, 200, 50);
        p.text(opponentScore, 600, 50);

        // Move player paddle with mouse
        playerPaddle.y = p.constrain(p.mouseY, 0, p.height - playerPaddle.height);

        // Send player position to server
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              playerY: playerPaddle.y,
              sender: playerNumber === 1 ? 'player1' : 'player2',
            })
          );
        }
      };

      // Update game state from server
      window['updateGameState'] = (data: any) => {
        console.log('Updating game state:', data);
        if (data.ball_x !== undefined && data.ball_y !== undefined) {
          ball.x = data.ball_x;
          ball.y = data.ball_y;
        }

        if (data.player1_y !== undefined && data.player2_y !== undefined) {
          opponentPaddle.y = playerNumber === 1 ? data.player2_y : data.player1_y;
        }

        if (data.player1_score !== undefined && data.player2_score !== undefined) {
          playerScore = playerNumber === 1 ? data.player1_score : data.player2_score;
          opponentScore = playerNumber === 1 ? data.player2_score : data.player1_score;
        }

      };
    };

    const p5Instance = new p5(sketch, canvasRef.current);

    return () => {
      p5Instance.remove();
      delete window['updateGameState'];
    };
  }, [ws, playerNumber, gameStarted]);

  return (
    <div className="App flex items-center justify-center min-h-screen bg-black w-full flex">
      <div className="text-center w-full">
        <Card className="border-none bg-black/70 backdrop-blur p-6 rounded-lg w-full">
          <CardHeader>
            <CardTitle className="text-4xl font-bold text-center text-white">
              Multiplayer Pong Game
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              <Input
                type="text"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value)}
                className="max-w-[200px] bg-gray-800 border-gray-600 text-white px-4 py-2 rounded"
                placeholder="Enter room ID"
              />
              <Button 
                variant="outline"
                className="bg-gray-800 hover:bg-gray-700 text-white border-gray-600 px-4 py-2 rounded"
                onClick={handleJoinRoom}
              >
                Join Room
              </Button>
            </div>
            <div className="mt-4 text-center text-gray-400 w-full flex justify-center">
              {roomId ? `Room ID: ${roomId} • Player ${playerNumber}` : 'Waiting for another player to join...'}
            </div>
          </CardContent>
        </Card>
        <div ref={canvasRef} className="mt-8 flex justify-center items-center">
          {/* The canvas will be centered within this div */}
        </div>
      </div>
    </div>
  );
};

export default App;

# Multiplayer Pong Game

## How to run

1. Run `npm install` in the frontend directory
2. Run `npm run dev` in the frontend directory
3. Run `pip install -r requirements.txt` in the backend directory
4. Run `python3 server.py` in the backend directory
5. Open the frontend (default : http://localhost:5173/ ) in your browser


## How to play

1. Enter a room ID
2. Wait for another player to join
3. Use mouse to move the paddle


## Brief explanation of key technical decisions

- I used websockets to communicate between the frontend and backend
- I used p5.js to render the game on the canvas
- The backend act as the game logic instead of the frontend to act kind of as an anti-cheat for simple games.

## Edge cases/Limitations
- Room only exist when there are 2 players, 1 player leaving the room does not pause the game.
- The game is not responsive, it only works on desktop.
- The game is not optimized for ping issues, the ball gets through the paddle when the ping is high.
- Communication between the frontend and backend is tied to the FPS, might cause issues ( Ideally standard tick should've been used, not tied to FPS )
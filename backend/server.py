import asyncio
import json
import websockets
from dataclasses import dataclass, asdict
from typing import Dict, Set
import logging
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class GameState:
    room_id: str
    ball_x: float = 400
    ball_y: float = 300
    ball_speed_x: float = 3
    ball_speed_y: float = 3
    player1_y: float = 200
    player2_y: float = 200
    player1_score: int = 0
    player2_score: int = 0
    game_started: bool = False

class GameServer:
    def __init__(self):
        self.rooms: Dict[str, Set] = {}
        self.game_states: Dict[str, GameState] = {}

    async def register(self, websocket, room_id: str):
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
            self.game_states[room_id] = GameState(room_id=room_id)
            logger.info(f"Created new room: {room_id}")

        self.rooms[room_id].add(websocket)
        logger.info(f"Client connected to room {room_id}. Total clients in room: {len(self.rooms[room_id])}")

    async def unregister(self, websocket, room_id: str):
        self.rooms[room_id].remove(websocket)
        logger.info(f"Client disconnected from room {room_id}. Total clients in room: {len(self.rooms[room_id])}")

        if len(self.rooms[room_id]) == 0:
            del self.rooms[room_id]
            del self.game_states[room_id]
            logger.info(f"Deleted empty room: {room_id}")

    async def broadcast_state(self, room_id: str, state: dict):
        if room_id in self.rooms:
            websockets_to_remove = set()
            for client in self.rooms[room_id]:
                try:
                    await client.send(json.dumps(state))
                except websockets.exceptions.ConnectionClosed:
                    websockets_to_remove.add(client)
            
            for client in websockets_to_remove:
                await self.unregister(client, room_id)

    async def handle_client(self, websocket):
        try:
            message = await websocket.recv()
            data = json.loads(message)
            room_id = data.get('roomId')
            if not room_id:
                raise ValueError("Room ID not provided")
        except (ValueError, json.JSONDecodeError):
            room_id = str(uuid.uuid4())
            logger.info(f"No valid room ID provided. Assigned new room ID: {room_id}")

        await self.register(websocket, room_id)

        if len(self.rooms[room_id]) == 1:
            player_number = 1
        elif len(self.rooms[room_id]) == 2:
            player_number = 2
            self.game_states[room_id].game_started = True
            await self.broadcast_state(room_id, asdict(self.game_states[room_id]))
        else:
            await websocket.send(json.dumps({"error": "Room is full"}))
            await websocket.close()
            return

        await websocket.send(json.dumps({"assignPlayer": player_number}))
        logger.info(f"Assigned Player {player_number} to room {room_id}")

        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    game_state = self.game_states[room_id]

                    if 'playerY' in data:
                        if data.get('sender') == 'player1':
                            game_state.player1_y = data['playerY']
                        elif data.get('sender') == 'player2':
                            game_state.player2_y = data['playerY']

                    # Update ball position and check for collisions
                    if game_state.game_started:
                        game_state.ball_x += game_state.ball_speed_x
                        game_state.ball_y += game_state.ball_speed_y

                        # Ball collision with top and bottom
                        if game_state.ball_y <= 0 or game_state.ball_y >= 600:
                            game_state.ball_speed_y *= -1

                        # Ball collision with paddles
                        if (
                            game_state.ball_x <= 40 and
                            game_state.player1_y <= game_state.ball_y <= game_state.player1_y + 60
                        ):
                            game_state.ball_speed_x *= -1

                        if (
                            game_state.ball_x >= 760 and
                            game_state.player2_y <= game_state.ball_y <= game_state.player2_y + 60
                        ):
                            game_state.ball_speed_x *= -1

                        # Score points
                        if game_state.ball_x <= 0:
                            game_state.player2_score += 1
                            game_state.ball_x, game_state.ball_y = 400, 300
                        if game_state.ball_x >= 800:
                            game_state.player1_score += 1
                            game_state.ball_x, game_state.ball_y = 400, 300

                    await self.broadcast_state(room_id, asdict(game_state))

                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON received: {message}")

        except websockets.exceptions.ConnectionClosed:
            logger.info(f"ConnectionClosed: Client disconnected from room {room_id}")
        
        finally:
            await self.unregister(websocket, room_id)

async def main():
    game_server = GameServer()
    async with websockets.serve(
        game_server.handle_client,
        "localhost",
        8765,
        ping_interval=None
    ):
        logger.info("WebSocket server started on ws://localhost:8765")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())

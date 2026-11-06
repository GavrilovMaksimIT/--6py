from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="Realtime Chat API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, username: str) -> None:
        await websocket.accept()
        self.active_connections[websocket] = username

    def disconnect(self, websocket: WebSocket) -> str:
        return self.active_connections.pop(websocket, "Пользователь")

    async def broadcast(self, message: dict[str, Any]) -> None:
        disconnected: list[WebSocket] = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for connection in disconnected:
            self.disconnect(connection)

    @property
    def users(self) -> list[str]:
        return list(self.active_connections.values())


manager = ConnectionManager()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    username = (websocket.query_params.get("username") or "Гость").strip()[:40]
    await manager.connect(websocket, username)

    await manager.broadcast(
        {
            "type": "system",
            "username": "Система",
            "text": f"{username} вошёл в чат",
            "timestamp": timestamp(),
        }
    )
    await manager.broadcast(
        {
            "type": "users",
            "username": "Система",
            "text": "",
            "users": manager.users,
            "timestamp": timestamp(),
        }
    )

    try:
        while True:
            payload = await websocket.receive_json()
            text = str(payload.get("text", "")).strip()
            if not text:
                continue

            await manager.broadcast(
                {
                    "type": "message",
                    "username": username,
                    "text": text[:2000],
                    "timestamp": timestamp(),
                }
            )
    except WebSocketDisconnect:
        disconnected_username = manager.disconnect(websocket)
        await manager.broadcast(
            {
                "type": "system",
                "username": "Система",
                "text": f"{disconnected_username} вышел из чата",
                "timestamp": timestamp(),
            }
        )
        await manager.broadcast(
            {
                "type": "users",
                "username": "Система",
                "text": "",
                "users": manager.users,
                "timestamp": timestamp(),
            }
        )

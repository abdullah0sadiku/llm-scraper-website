from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
import json
import asyncio
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.job_subscribers: Dict[uuid.UUID, List[str]] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"WebSocket client {client_id} connected")
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        
        # Remove from job subscribers
        for job_id in list(self.job_subscribers.keys()):
            if client_id in self.job_subscribers[job_id]:
                self.job_subscribers[job_id].remove(client_id)
                if not self.job_subscribers[job_id]:
                    del self.job_subscribers[job_id]
        
        logger.info(f"WebSocket client {client_id} disconnected")
    
    async def send_personal_message(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error sending message to {client_id}: {str(e)}")
                self.disconnect(client_id)
    
    async def broadcast_job_update(self, job_id: uuid.UUID, message: dict):
        """Send update to all clients subscribed to a specific job"""
        if job_id in self.job_subscribers:
            disconnected_clients = []
            
            for client_id in self.job_subscribers[job_id]:
                try:
                    if client_id in self.active_connections:
                        await self.active_connections[client_id].send_text(json.dumps(message))
                    else:
                        disconnected_clients.append(client_id)
                except Exception as e:
                    logger.error(f"Error broadcasting to {client_id}: {str(e)}")
                    disconnected_clients.append(client_id)
            
            # Clean up disconnected clients
            for client_id in disconnected_clients:
                if client_id in self.job_subscribers[job_id]:
                    self.job_subscribers[job_id].remove(client_id)
    
    def subscribe_to_job(self, job_id: uuid.UUID, client_id: str):
        """Subscribe a client to job updates"""
        if job_id not in self.job_subscribers:
            self.job_subscribers[job_id] = []
        
        if client_id not in self.job_subscribers[job_id]:
            self.job_subscribers[job_id].append(client_id)
            logger.info(f"Client {client_id} subscribed to job {job_id}")
    
    def unsubscribe_from_job(self, job_id: uuid.UUID, client_id: str):
        """Unsubscribe a client from job updates"""
        if job_id in self.job_subscribers and client_id in self.job_subscribers[job_id]:
            self.job_subscribers[job_id].remove(client_id)
            if not self.job_subscribers[job_id]:
                del self.job_subscribers[job_id]
            logger.info(f"Client {client_id} unsubscribed from job {job_id}")
    
    async def broadcast_to_all(self, message: dict):
        """Send update to all active connections"""
        disconnected_clients = []
        for client_id, websocket in self.active_connections.items():
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error broadcasting to {client_id}: {str(e)}")
                disconnected_clients.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)

# Global connection manager
manager = ConnectionManager()

@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                await handle_websocket_message(message, client_id)
            except json.JSONDecodeError:
                await manager.send_personal_message({
                    "type": "error",
                    "message": "Invalid JSON format"
                }, client_id)
            
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {str(e)}")
        manager.disconnect(client_id)

async def handle_websocket_message(message: dict, client_id: str):
    """Handle incoming WebSocket messages"""
    message_type = message.get("type")
    
    if message_type == "subscribe_job":
        job_id_str = message.get("job_id")
        if job_id_str:
            try:
                job_id = uuid.UUID(job_id_str)
                manager.subscribe_to_job(job_id, client_id)
                
                await manager.send_personal_message({
                    "type": "subscribed",
                    "job_id": job_id_str,
                    "message": f"Subscribed to job updates"
                }, client_id)
                
            except ValueError:
                await manager.send_personal_message({
                    "type": "error",
                    "message": "Invalid job ID format"
                }, client_id)
    
    elif message_type == "unsubscribe_job":
        job_id_str = message.get("job_id")
        if job_id_str:
            try:
                job_id = uuid.UUID(job_id_str)
                manager.unsubscribe_from_job(job_id, client_id)
                
                await manager.send_personal_message({
                    "type": "unsubscribed",
                    "job_id": job_id_str,
                    "message": f"Unsubscribed from job updates"
                }, client_id)
                
            except ValueError:
                await manager.send_personal_message({
                    "type": "error",
                    "message": "Invalid job ID format"
                }, client_id)
    
    elif message_type == "ping":
        await manager.send_personal_message({
            "type": "pong",
            "timestamp": message.get("timestamp")
        }, client_id)
    
    else:
        await manager.send_personal_message({
            "type": "error",
            "message": f"Unknown message type: {message_type}"
        }, client_id)

# Helper functions for sending updates from other parts of the application

async def notify_job_started(job_id: uuid.UUID, job_data: dict):
    """Notify clients that a job has started"""
    message = {
        "type": "job_started",
        "job_id": str(job_id),
        "timestamp": job_data.get("created_at"),
        "url": job_data.get("url"),
        "status": "running"
    }
    await manager.broadcast_job_update(job_id, message)

async def notify_job_progress(job_id: uuid.UUID, stage: str, progress: int, details: str = ""):
    """Notify clients about job progress"""
    message = {
        "type": "job_progress",
        "job_id": str(job_id),
        "stage": stage,
        "progress": progress,
        "details": details,
        "timestamp": asyncio.get_event_loop().time()
    }
    await manager.broadcast_job_update(job_id, message)

async def notify_job_completed(job_id: uuid.UUID, results: dict):
    """Notify clients that a job has completed"""
    message = {
        "type": "job_completed",
        "job_id": str(job_id),
        "status": "completed",
        "data_count": results.get("data_count", 0),
        "timestamp": results.get("extracted_at"),
        "results_available": True
    }
    await manager.broadcast_job_update(job_id, message)

async def notify_job_failed(job_id: uuid.UUID, error: str):
    """Notify clients that a job has failed"""
    message = {
        "type": "job_failed",
        "job_id": str(job_id),
        "status": "failed",
        "error": error,
        "timestamp": asyncio.get_event_loop().time()
    }
    await manager.broadcast_job_update(job_id, message)

async def notify_job_cancelled(job_id: uuid.UUID):
    """Notify clients that a job has been cancelled"""
    message = {
        "type": "job_cancelled",
        "job_id": str(job_id),
        "status": "cancelled",
        "timestamp": asyncio.get_event_loop().time()
    }
    await manager.broadcast_job_update(job_id, message)

# Export the manager for use in other modules
__all__ = ["manager", "router", "notify_job_started", "notify_job_progress", 
           "notify_job_completed", "notify_job_failed", "notify_job_cancelled"]

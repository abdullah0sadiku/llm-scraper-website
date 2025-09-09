import { WebSocketMessage } from '../types';

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private clientId: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectInterval: number = 1000; // Start with 1 second
  private isConnecting: boolean = false;
  private messageHandlers: Map<string, Set<(message: WebSocketMessage) => void>> = new Map();
  private connectionHandlers: Set<(connected: boolean) => void> = new Set();

  constructor(clientId?: string) {
    this.clientId = clientId || this.generateClientId();
    this.url = this.getWebSocketUrl();
  }

  private getWebSocketUrl(): string {
    // In production (Docker), use relative path which will be proxied by nginx
    if (import.meta.env.PROD) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/ws/${this.clientId}`;
    }
    // In development, use the backend port directly
    return `ws://localhost:3020/ws/${this.clientId}`;
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        // If already connecting, wait for the connection to complete
        const checkConnection = () => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            resolve();
          } else if (this.ws?.readyState === WebSocket.CLOSED) {
            reject(new Error('Connection failed'));
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
        return;
      }

      this.isConnecting = true;

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.reconnectInterval = 1000;
          this.notifyConnectionHandlers(true);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.notifyConnectionHandlers(false);
          
          // Attempt to reconnect if it wasn't a manual close
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private scheduleReconnect(): void {
    setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      this.connect().catch((error) => {
        console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
        
        // Exponential backoff
        this.reconnectInterval = Math.min(this.reconnectInterval * 2, 30000);
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('Max reconnection attempts reached');
        }
      });
    }, this.reconnectInterval);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    this.messageHandlers.clear();
    this.connectionHandlers.clear();
  }

  private handleMessage(message: WebSocketMessage): void {
    console.log('WebSocket message received:', message);

    // Notify specific message type handlers
    const typeHandlers = this.messageHandlers.get(message.type);
    if (typeHandlers) {
      typeHandlers.forEach(handler => handler(message));
    }

    // Notify general message handlers
    const generalHandlers = this.messageHandlers.get('*');
    if (generalHandlers) {
      generalHandlers.forEach(handler => handler(message));
    }
  }

  // Subscribe to specific message types
  subscribe(messageType: string, handler: (message: WebSocketMessage) => void): () => void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, new Set());
    }
    
    this.messageHandlers.get(messageType)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(messageType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(messageType);
        }
      }
    };
  }

  // Convenience method for job status updates
  onJobStatusUpdate(handler: (jobId: string, status: string, errorMessage?: string) => void): () => void {
    return this.subscribe('job_status_update', (message) => {
      if (message.job_id && message.status) {
        handler(message.job_id, message.status, message.error_message);
      }
    });
  }

  // Subscribe to connection status changes
  onConnectionChange(handler: (connected: boolean) => void): () => void {
    this.connectionHandlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach(handler => handler(connected));
  }

  // Send message to server
  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Message not sent:', message);
    }
  }

  // Subscribe to job updates
  subscribeToJob(jobId: string): void {
    this.send({
      type: 'subscribe_job',
      job_id: jobId
    });
  }

  // Unsubscribe from job updates
  unsubscribeFromJob(jobId: string): void {
    this.send({
      type: 'unsubscribe_job',
      job_id: jobId
    });
  }

  // Send ping to keep connection alive
  ping(): void {
    this.send({
      type: 'ping',
      timestamp: Date.now()
    });
  }

  // Get connection status
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get connectionState(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }
}

// Create a singleton instance for the application
let websocketInstance: WebSocketService | null = null;

export const getWebSocketService = (): WebSocketService => {
  if (!websocketInstance) {
    websocketInstance = new WebSocketService();
  }
  return websocketInstance;
};

// React hook for using WebSocket in components
export const useWebSocket = () => {
  const ws = getWebSocketService();
  
  return {
    ws,
    isConnected: ws.isConnected,
    connectionState: ws.connectionState,
    connect: () => ws.connect(),
    disconnect: () => ws.disconnect(),
    subscribe: (messageType: string, handler: (message: WebSocketMessage) => void) => 
      ws.subscribe(messageType, handler),
    subscribeToJob: (jobId: string) => ws.subscribeToJob(jobId),
    unsubscribeFromJob: (jobId: string) => ws.unsubscribeFromJob(jobId),
    onConnectionChange: (handler: (connected: boolean) => void) => 
      ws.onConnectionChange(handler),
    onJobStatusUpdate: (handler: (jobId: string, status: string, errorMessage?: string) => void) => 
      ws.onJobStatusUpdate(handler)
  };
};

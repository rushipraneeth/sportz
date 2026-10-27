const isProd = import.meta.env.PROD;
const WS_URL = import.meta.env.VITE_WS_URL || 
               (isProd ? "wss://sportz-xh8v.onrender.com/ws" : "ws://localhost:8000/ws");

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.connectionListeners = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 6;
    this.reconnectTimeout = null;
    this.currentMatchId = null;
    this.pingInterval = null;
  }

  connect() {
    if (
        this.socket &&
        (this.socket.readyState === WebSocket.OPEN ||
            this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      this.socket = new WebSocket(WS_URL);
    } catch (err) {
      console.error("Failed to initialize WebSocket:", err);
      this.attemptReconnect();
      return;
    }

    this.socket.onopen = () => {
      console.log("WebSocket Connected to", WS_URL);
      this.reconnectAttempts = 0;
      this.notifyConnectionState("Connected");

      // Start ping heartbeat
      clearInterval(this.pingInterval);
      this.pingInterval = setInterval(() => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 25000);

      if (this.currentMatchId) {
        this.subscribe(this.currentMatchId);
      }
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (!message || !message.type) return;

        // Dispatch to registered event listeners
        if (this.listeners.has(message.type)) {
          this.listeners
              .get(message.type)
              .forEach((callback) => callback(message.data || message));
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    this.socket.onclose = (event) => {
      console.log(`WebSocket Disconnected (code: ${event.code})`);
      clearInterval(this.pingInterval);
      this.notifyConnectionState("Disconnected");
      this.attemptReconnect();
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;

      const timeout = Math.min(
          1000 * Math.pow(2, this.reconnectAttempts),
          15000
      );

      console.log(`Reconnecting WebSocket in ${timeout}ms (attempt ${this.reconnectAttempts})...`);
      clearTimeout(this.reconnectTimeout);

      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, timeout);
    }
  }

  subscribe(matchId) {
    this.currentMatchId = matchId;

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
          JSON.stringify({
            type: "subscribe",
            matchId: Number(matchId),
          })
      );
    } else {
      this.connect();
    }
  }

  unsubscribe(matchId) {
    if (this.currentMatchId === matchId) {
      this.currentMatchId = null;
    }
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
          JSON.stringify({
            type: "unsubscribe",
            matchId: Number(matchId),
          })
      );
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event).add(callback);

    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  onConnectionChange(callback) {
    this.connectionListeners.add(callback);

    if (this.socket) {
      const state =
          this.socket.readyState === WebSocket.OPEN
              ? "Connected"
              : "Disconnected";

      callback(state);
    } else {
      callback("Disconnected");
    }

    return () => {
      this.connectionListeners.delete(callback);
    };
  }

  notifyConnectionState(state) {
    this.connectionListeners.forEach((callback) => callback(state));
  }

  disconnect() {
    clearTimeout(this.reconnectTimeout);
    clearInterval(this.pingInterval);

    if (this.socket) {
      this.currentMatchId = null;
      this.socket.close();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
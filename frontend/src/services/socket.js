const isProd = import.meta.env.PROD;
const WS_URL = import.meta.env.VITE_WS_URL || 
               (isProd ? "wss://sportz-xh8v.onrender.com/ws" : "ws://localhost:8000/ws");
class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.connectionListeners = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
    this.currentMatchId = null;
  }

  connect() {
    if (
        this.socket &&
        (this.socket.readyState === WebSocket.OPEN ||
            this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.socket = new WebSocket(WS_URL);

    this.socket.onopen = () => {
      console.log("WebSocket Connected");
      this.reconnectAttempts = 0;
      this.notifyConnectionState("Connected");

      if (this.currentMatchId) {
        this.subscribe(this.currentMatchId);
      }
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (
            message.type === "commentary" &&
            this.listeners.has("commentary")
        ) {
          this.listeners
              .get("commentary")
              .forEach((callback) => callback(message.data));
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    this.socket.onclose = () => {
      console.log("WebSocket Disconnected");
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
          10000
      );

      console.log(`Reconnecting in ${timeout}ms...`);

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
            matchId,
          })
      );
    } else {
      this.connect();
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

    if (this.socket) {
      this.currentMatchId = null;
      this.socket.close();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
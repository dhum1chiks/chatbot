/**
 * WebSocket connection manager for voice interactions
 */

export interface WebSocketMessage {
  type: 'start_session' | 'audio_chunk' | 'end_session' | 'partial_transcript' | 
        'final_transcript' | 'text_response' | 'partial_text_response' | 'session_started' | 'session_ended' | 'error';

  data?: string;
  text?: string;
  chunkIndex?: number;
  is_final?: boolean;
  isFinal?: boolean; // Keep for backward compatibility
  isPartial?: boolean;

  message?: string;
  recoverable?: boolean;
  sessionId?: string;
  quality?: string;
}

/// <reference types="vite/client" />
export interface VoiceWebSocketOptions {

  reconnectAttempts?: number;
  reconnectDelay?: number;
  timeout?: number;
}

export class VoiceWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private url: string;
  private options: Required<VoiceWebSocketOptions>;
  private reconnectCount = 0;
  private isConnecting = false;
  private messageHandlers: Map<string, (message: WebSocketMessage) => void> = new Map();

  constructor(sessionId: string, options: VoiceWebSocketOptions = {}) {
    this.sessionId = sessionId;
    this.options = {
      reconnectAttempts: options.reconnectAttempts || 3,
      reconnectDelay: options.reconnectDelay || 2000,
      timeout: options.timeout || 30000,
    };

    // Build WebSocket URL
    this.url = this.buildWebSocketUrl();
  }

  /**
   * Build WebSocket URL based on environment
   */
  private buildWebSocketUrl(): string {
    const envBackend = import.meta.env.VITE_BACKEND_URL as string | undefined;
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

    const backendHost = isLocal
      ? 'localhost:8000'
      : (envBackend ? envBackend.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '') : window.location.host);

    const protocol = isLocal ? 'ws:' : (window.location.protocol === 'https:' ? 'wss:' : 'ws:');
    return `${protocol}//${backendHost}/ws/voice/${this.sessionId}`;
  }

  /**
   * Connect to WebSocket
   */
  async connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        // Connection timeout
        const timeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            this.ws.close();
            reject(new Error('Connection timeout'));
          }
        }, this.options.timeout);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.isConnecting = false;
          this.reconnectCount = 0;
          console.log('✓ Voice WebSocket connected');
          
          // Send session start message
          this.send({
            type: 'start_session',
            sessionId: this.sessionId,
          });
          
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
          this.isConnecting = false;
          console.log('Voice WebSocket closed:', event.code, event.reason);
          
          // Attempt reconnection if not intentional
          if (event.code !== 1000 && this.reconnectCount < this.options.reconnectAttempts) {
            this.attemptReconnect();
          }
        };

        this.ws.onerror = (error) => {
          this.isConnecting = false;
          console.error('Voice WebSocket error:', error);
          clearTimeout(timeout);
          reject(new Error('WebSocket connection failed'));
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect
   */
  private async attemptReconnect(): Promise<void> {
    this.reconnectCount++;
    console.log(`Attempting to reconnect (${this.reconnectCount}/${this.options.reconnectAttempts})...`);

    // Exponential backoff
    const delay = this.options.reconnectDelay * Math.pow(2, this.reconnectCount - 1);
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
        
        if (this.reconnectCount >= this.options.reconnectAttempts) {
          this.handleMessage({
            type: 'error',
            message: 'Connection lost. Please refresh the page.',
            recoverable: false,
          });
        }
      }
    }, delay);
  }

  /**
   * Send message to WebSocket
   */
  send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send audio chunk
   */
  sendAudioChunk(audioData: ArrayBuffer, chunkIndex: number, isFinal: boolean = false): void {
    // Convert ArrayBuffer to base64
    const base64Data = this.arrayBufferToBase64(audioData);
    
    this.send({
      type: 'audio_chunk',
      data: base64Data,
      chunkIndex,
      is_final: isFinal,
      isFinal: isFinal, // Support both formats during transition
    });

  }

  /**
   * End session
   */
  endSession(): void {
    this.send({
      type: 'end_session',
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: WebSocketMessage): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    } else {
      console.log('Unhandled message type:', message.type, message);
    }
  }

  /**
   * Register message handler
   */
  onMessage(type: string, handler: (message: WebSocketMessage) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Remove message handler
   */
  offMessage(type: string): void {
    this.messageHandlers.delete(type);
  }

  /**
   * Close connection
   */
  close(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client closing');
      this.ws = null;
    }
    this.messageHandlers.clear();
    console.log('✓ Voice WebSocket closed');
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state
   */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return window.btoa(binary);
  }

  /**
   * Convert base64 to ArrayBuffer
   */
  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes.buffer;
  }
}
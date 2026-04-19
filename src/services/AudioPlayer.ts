/**
 * Audio player service using Web Audio API
 */

export interface AudioPlayerOptions {
  sampleRate?: number;
  volume?: number;
}

export interface AudioQueueItem {
  data: ArrayBuffer;
  chunkIndex: number;
  isFinal: boolean;
}

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private audioQueue: AudioQueueItem[] = [];
  private isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private options: Required<AudioPlayerOptions>;
  private scheduledEndTime = 0;
  private initialBufferThreshold = 3; // Wait for 3 chunks before starting


  constructor(options: AudioPlayerOptions = {}) {
    this.options = {
      sampleRate: options.sampleRate || 22050,
      volume: options.volume || 1.0,
    };
  }

  /**
   * Initialize audio player
   */
  async initialize(): Promise<void> {
    try {
      // Create audio context - let the browser detect the optimal sample rate
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();


      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.options.volume;
      this.gainNode.connect(this.audioContext.destination);

      console.log('✓ Audio player initialized');
    } catch (error) {
      throw new Error(`Failed to initialize audio player: ${error}`);
    }
  }

  /**
   * Add audio chunk to playback queue
   */
  async addAudioChunk(data: ArrayBuffer, chunkIndex: number, isFinal: boolean = false): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio player not initialized');
    }

    const queueItem: AudioQueueItem = {
      data,
      chunkIndex,
      isFinal,
    };

    this.audioQueue.push(queueItem);
    this.audioQueue.sort((a, b) => a.chunkIndex - b.chunkIndex);

    // Start playing if we've reached the jitter buffer threshold
    if (!this.isPlaying && this.audioQueue.length >= this.initialBufferThreshold) {
      this.startPlayback();
    } else if (!this.isPlaying && isFinal) {
      // If it's the final chunk, play whatever we have even if below threshold
      this.startPlayback();
    }
  }


  /**
   * Play audio buffer at a specific time
   */
  async playAudio(audioBuffer: ArrayBuffer, startTime: number): Promise<number> {
    if (!this.audioContext || !this.gainNode) {
      throw new Error('Audio player not initialized');
    }

    try {
      // Decode audio data
      const decodedBuffer = await this.audioContext.decodeAudioData(audioBuffer.slice(0));

      // Create source
      const source = this.audioContext.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(this.gainNode);

      // Schedule audio on the timeline
      source.start(startTime);
      this.currentSource = source;

      return decodedBuffer.duration;
    } catch (error) {
      throw new Error(`Failed to play audio: ${error}`);
    }
  }


  /**
   * Start streaming playback from queue
   */
  private async startPlayback(): Promise<void> {
    if (!this.audioContext || this.isPlaying || this.audioQueue.length === 0) return;

    this.isPlaying = true;
    
    // Initialize scheduled time to "now" plus a tiny safety margin
    this.scheduledEndTime = this.audioContext.currentTime + 0.1;
    
    console.log('✓ Started precise audio playback');

    while (this.audioQueue.length > 0) {
      const item = this.audioQueue.shift()!;

      try {
        // Schedule next chunk exactly when the previous one ends
        const duration = await this.playAudio(item.data, this.scheduledEndTime);
        this.scheduledEndTime += duration;
        
        // Brief pause to allow next chunks to arrive if queue is low
        if (this.audioQueue.length === 0 && !item.isFinal) {
          // Wait up to 500ms for more data before giving up
          await this.waitForNewChunks();
        }
      } catch (error) {
        console.error('Audio playback error:', error);
      }

      if (item.isFinal) break;
    }

    this.isPlaying = false;
    this.scheduledEndTime = 0;
    console.log('✓ Audio playback completed');
  }

  /**
   * Wait for more chunks to arrive in the queue
   */
  private waitForNewChunks(): Promise<void> {
    return new Promise((resolve) => {
      let attempts = 0;
      const check = () => {
        if (this.audioQueue.length > 0 || attempts > 10) {
          resolve();
        } else {
          attempts++;
          setTimeout(check, 50);
        }
      };
      check();
    });
  }


  /**
   * Wait for current audio to complete
   */
  private waitForPlaybackComplete(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.currentSource) {
        resolve();
        return;
      }

      const checkComplete = () => {
        if (!this.currentSource) {
          resolve();
        } else {
          setTimeout(checkComplete, 50);
        }
      };

      checkComplete();
    });
  }

  /**
   * Stop current playback
   */
  stop(): void {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }

    this.audioQueue = [];
    this.isPlaying = false;
    console.log('✓ Audio playback stopped');
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
      this.options.volume = volume;
    }
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.options.volume;
  }

  /**
   * Clear audio queue
   */
  clearQueue(): void {
    this.audioQueue = [];
  }

  /**
   * Check if audio is currently playing
   */
  get playing(): boolean {
    return this.isPlaying;
  }

  /**
   * Get queue length
   */
  get queueLength(): number {
    return this.audioQueue.length;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stop();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.gainNode = null;
    console.log('✓ Audio player cleaned up');
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

  /**
   * Check if Web Audio API is supported
   */
  static isSupported(): boolean {
    return !!(window.AudioContext || (window as any).webkitAudioContext);
  }
}
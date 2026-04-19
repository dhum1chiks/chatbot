/**
 * Audio capture service using Web Audio API
 */

export interface AudioCaptureOptions {
  sampleRate?: number;
  channelCount?: number;
  bufferSize?: number;
}

export interface AudioChunk {
  data: ArrayBuffer;
  timestamp: number;
  chunkIndex: number;
  volume: number; // RMS level for visualization
}

export class AudioCapture {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isRecording = false;
  private chunkIndex = 0;
  private options: Required<AudioCaptureOptions>;

  constructor(options: AudioCaptureOptions = {}) {
    this.options = {
      sampleRate: options.sampleRate || 16000,
      channelCount: options.channelCount || 1,
      bufferSize: options.bufferSize || 4096,
    };
  }

  /**
   * Initialize audio capture with microphone access
   */
  async initialize(): Promise<void> {
    try {
      // Request microphone access with flexible constraints
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (error: any) {
        if (error.name === 'OverconstrainedError') {
          console.warn('AudioCapture: Overconstrained, trying basic audio');
          this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else {
          throw error;
        }
      }

      // Create audio context at the HARDWARE's native sample rate (do NOT force 16kHz)
      // Forcing 16kHz on hardware running at 48kHz produces empty/garbled buffers on Linux
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Resume if suspended (needed after user gesture on some browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create source from media stream
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create analyser for visualization
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      this.source.connect(this.analyser);

      // Create processor - use hardware's native buffer size
      this.processor = this.audioContext.createScriptProcessor(
        this.options.bufferSize,
        1, // mono input
        1  // mono output
      );

      console.log(`✓ Audio capture initialized at ${this.audioContext.sampleRate}Hz`);
    } catch (error) {
      throw new Error(`Failed to initialize audio capture: ${error}`);
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(onAudioChunk: (chunk: AudioChunk) => void): Promise<void> {
    if (!this.audioContext || !this.processor || !this.source) {
      throw new Error('Audio capture not initialized');
    }

    if (this.isRecording) {
      throw new Error('Already recording');
    }

    // Resume AudioContext if suspended (browser requires user gesture)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Reset chunk index
    this.chunkIndex = 0;

    // Zero signal detection
    let zeroSignalStart = 0;

    // Set up audio processing
    this.processor.onaudioprocess = (event) => {
      if (!this.isRecording) return;

      const inputBuffer = event.inputBuffer;
      const channelData = inputBuffer.getChannelData(0);

      // Calculate RMS volume
      let sum = 0;
      for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
      }
      const volume = Math.sqrt(sum / channelData.length);

      // Log warning if signal is absolute zero for too long
      if (volume === 0) {
        if (zeroSignalStart === 0) zeroSignalStart = Date.now();
        if (Date.now() - zeroSignalStart > 2000) {
          console.warn('AudioCapture: Constant zero signal detected. Check mic hard-switch or permissions.');
        }
      } else {
        zeroSignalStart = 0;
      }

      // Convert directly to Int16 PCM — no noise gate, no normalization

      // The backend handles silence detection via Whisper
      const audioBuffer = this.float32ToInt16(channelData);

      const chunk: AudioChunk = {
        data: audioBuffer,
        timestamp: Date.now(),
        chunkIndex: this.chunkIndex++,
        volume,
      };

      onAudioChunk(chunk);
    };

    // Connect audio nodes
    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.isRecording = true;
    console.log('✓ Started recording');
  }

  /**
   * Stop recording audio
   */
  stopRecording(): void {
    if (!this.isRecording) return;

    this.isRecording = false;

    if (this.source && this.processor) {
      try {
        this.source.disconnect(this.processor);
        this.processor.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    }

    console.log('✓ Stopped recording');
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopRecording();

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.source = null;
    this.processor = null;
    console.log('✓ Audio capture cleaned up');
  }

  /**
   * Check if microphone is available
   */
  static async checkMicrophoneAvailability(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(device => device.kind === 'audioinput');
    } catch {
      return false;
    }
  }

  /**
   * Request microphone permission
   */
  static async requestMicrophonePermission(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('ASR Error: MediaDevices API not supported in this browser.');
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error: any) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        console.error('ASR Error: Microphone permission denied.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        console.error('ASR Error: No microphone hardware found.');
      } else {
        console.error('ASR Error: Failed to access microphone:', error);
      }
      return false;
    }
  }

  /**
   * Convert Float32Array PCM to Int16 ArrayBuffer (raw PCM for Whisper)
   */
  private float32ToInt16(data: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(data.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < data.length; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(i * 2, sample * 0x7FFF, true);
    }
    return buffer;
  }

  /**
   * Get the analyser node for visualization
   */
  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * Get current recording state
   */
  get recording(): boolean {
    return this.isRecording;
  }

  /**
   * Get audio context state
   */
  get state(): string {
    return this.audioContext?.state || 'closed';
  }
}
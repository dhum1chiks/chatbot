import { useState, useRef, useCallback, useEffect } from 'react'
import { AudioCapture } from '../services/AudioCapture'
import { AudioPlayer } from '../services/AudioPlayer'
import { VoiceWebSocket } from '../services/VoiceWebSocket'
import { VoiceErrors, type VoiceError } from '../components/voice/VoiceErrorDisplay'

export interface VoiceState {
  isRecording: boolean
  isListening: boolean
  isThinking: boolean
  isSpeaking: boolean
  isVoiceMode: boolean
  error: VoiceError | null
  partialTranscript: string
  finalTranscript: string
}

export interface VoiceHookOptions {
  sessionId: string
  onTranscript?: (text: string, isFinal: boolean) => void
  onAudioResponse?: (text: string) => void
  onPartialTextResponse?: (text: string) => void
  onError?: (error: VoiceError) => void
}


export function useVoice({
  sessionId,
  onTranscript,
  onAudioResponse,
  onPartialTextResponse,
  onError
}: VoiceHookOptions) {

  // Voice state
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isRecording: false,
    isListening: false,
    isThinking: false,
    isSpeaking: false,
    isVoiceMode: false,
    error: null,
    partialTranscript: '',
    finalTranscript: ''
  })

  // Persistent state for closures
  const turnStateRef = useRef({
    isThinking: false,
    isSpeaking: false,
    hasTriggeredAudioResponse: false
  });

  // Service references
  const audioCapture = useRef<AudioCapture | null>(null)
  const audioPlayer = useRef<AudioPlayer | null>(null)
  const voiceWebSocket = useRef<VoiceWebSocket | null>(null)
  const isInitialized = useRef(false)

  // Update voice state
  const updateVoiceState = useCallback((updates: Partial<VoiceState>) => {
    setVoiceState(prev => {
      const newState = { ...prev, ...updates };
      // Sync ref for closures
      if (updates.isThinking !== undefined) turnStateRef.current.isThinking = updates.isThinking;
      if (updates.isSpeaking !== undefined) turnStateRef.current.isSpeaking = updates.isSpeaking;
      return newState;
    });
  }, []);

  // Set error
  const setError = useCallback((error: VoiceError | null) => {
    updateVoiceState({ error })
    if (error && onError) {
      onError(error)
    }
  }, [updateVoiceState, onError])

  // Initialize services
  const initializeServices = useCallback(async () => {
    if (isInitialized.current) return

    try {
      // Initialize audio capture
      audioCapture.current = new AudioCapture({
        sampleRate: 16000,
        channelCount: 1,
        bufferSize: 4096
      })

      // Initialize audio player
      audioPlayer.current = new AudioPlayer({
        sampleRate: 22050,
        volume: 1.0
      })
      await audioPlayer.current.initialize()

      // Initialize WebSocket
      voiceWebSocket.current = new VoiceWebSocket(sessionId)
      setupWebSocketHandlers()

      isInitialized.current = true
      console.log('✓ Voice services initialized')
    } catch (error) {
      console.error('Failed to initialize voice services:', error)
      setError(VoiceErrors.unknown(`Failed to initialize voice services: ${error}`))
    }
  }, [sessionId, setError])

  // Setup WebSocket message handlers
  const setupWebSocketHandlers = useCallback(() => {
    if (!voiceWebSocket.current) return

    // Handle partial transcripts
    voiceWebSocket.current.onMessage('partial_transcript', (message) => {
      if (message.text) {
        updateVoiceState({ partialTranscript: message.text })
        onTranscript?.(message.text, false)
      }
    })

    // Handle final transcripts
    voiceWebSocket.current.onMessage('final_transcript', (message) => {
      if (message.text) {
        updateVoiceState({
          finalTranscript: message.text,
          partialTranscript: '',
          isListening: false,
          isThinking: true
        })
        turnStateRef.current.hasTriggeredAudioResponse = false;
        onTranscript?.(message.text, true)
      }
    })

    // Handle partial text responses (streaming)
    voiceWebSocket.current.onMessage('partial_text_response', (message) => {
      if (message.text) {
        onPartialTextResponse?.(message.text)
      }
    })

    // Handle text responses

    voiceWebSocket.current.onMessage('text_response', (message) => {
      if (message.text) {
        updateVoiceState({ isThinking: false, isSpeaking: true })
        onAudioResponse?.(message.text)
      }
    })

    // Handle audio chunks
    voiceWebSocket.current.onMessage('audio_chunk', async (message) => {
      // Robust terminal signal detection (check both snake_case and camelCase)
      const isFinalChunk = message.is_final || message.isFinal || false;

      if (message.data && audioPlayer.current) {
        try {
          const audioBuffer = VoiceWebSocket.base64ToArrayBuffer(message.data)
          
          // CRITICAL UI TRANSITION (Closure-Safe):
          // If we are currently thinking, or if this is simply the FIRST audio chunk of the turn,
          // ensure we transition to the Speaking state immediately.
          if (!turnStateRef.current.hasTriggeredAudioResponse) {
            turnStateRef.current.hasTriggeredAudioResponse = true;
            
            updateVoiceState({ 
              isThinking: false, 
              isSpeaking: true 
            });
            
            // Signal ChatPage to start "printing" the buffered text
            console.log('✓ Starting text pacer via first audio chunk');
            onAudioResponse?.(''); 
          }

          await audioPlayer.current.addAudioChunk(
            audioBuffer,
            message.chunkIndex || 0,
            isFinalChunk
          )
        } catch (error) {
          console.error('Audio playback error:', error)
          setError(VoiceErrors.ttsFailed())
        }
      }

      // ALWAYS update state if it's the final chunk, even if there's no data
      if (isFinalChunk) {
        console.log('✓ Final audio chunk received');
        updateVoiceState({ isSpeaking: false })
      }
    })


    // Handle errors
    voiceWebSocket.current.onMessage('error', (message) => {
      const errorMessage = message.message || 'Unknown error'
      
      // Determine error type based on message content
      let error: VoiceError
      if (errorMessage.includes('microphone') || errorMessage.includes('audio')) {
        error = VoiceErrors.microphoneNotFound(errorMessage)
      } else if (errorMessage.includes('connection') || errorMessage.includes('network')) {
        error = VoiceErrors.connectionLost(errorMessage)
      } else if (errorMessage.includes('transcription')) {
        error = VoiceErrors.transcriptionFailed(errorMessage)
      } else {
        error = VoiceErrors.unknown(errorMessage)
      }

      setError(error)
      updateVoiceState({
        isRecording: false,
        isListening: false,
        isThinking: false,
        isSpeaking: false
      })
    })

    // Handle session events
    voiceWebSocket.current.onMessage('session_started', () => {
      console.log('✓ Voice session started')
    })

    voiceWebSocket.current.onMessage('session_ended', () => {
      console.log('✓ Voice session ended')
      updateVoiceState({
        isRecording: false,
        isListening: false,
        isThinking: false,
        isSpeaking: false
      })
    })
  }, [updateVoiceState, onTranscript, onAudioResponse, setError])

  // Start recording
  const startRecording = useCallback(async () => {
    if (!audioCapture.current || !voiceWebSocket.current) {
      await initializeServices()
    }

    if (!audioCapture.current || !voiceWebSocket.current) {
      setError(VoiceErrors.unknown('Voice services not available'))
      return
    }

    try {
      // Clear any previous errors
      setError(null)

      // Check microphone availability
      const hasPermission = await AudioCapture.requestMicrophonePermission()
      if (!hasPermission) {
        setError(VoiceErrors.microphoneDenied())
        return
      }

      // Initialize audio capture if needed
      if (audioCapture.current.state === 'closed') {
        await audioCapture.current.initialize()
      }

      // Connect WebSocket if needed
      if (!voiceWebSocket.current.connected) {
        await voiceWebSocket.current.connect()
      }

      // Start recording
      await audioCapture.current.startRecording((chunk) => {
        if (voiceWebSocket.current?.connected) {
          voiceWebSocket.current.sendAudioChunk(
            chunk.data,
            chunk.chunkIndex,
            false
          )
        }
      })

      updateVoiceState({
        isRecording: true,
        isListening: true,
        isThinking: false,
        isSpeaking: false,
        partialTranscript: '',
        finalTranscript: ''
      })

      console.log('✓ Started voice recording')
    } catch (error) {
      console.error('Failed to start recording:', error)
      
      if (error instanceof Error) {
        if (error.message.includes('denied')) {
          setError(VoiceErrors.microphoneDenied())
        } else if (error.message.includes('not found')) {
          setError(VoiceErrors.microphoneNotFound())
        } else {
          setError(VoiceErrors.unknown(`Failed to start recording: ${error.message}`))
        }
      } else {
        setError(VoiceErrors.unknown('Failed to start recording'))
      }

      updateVoiceState({ isRecording: false })
    }
  }, [initializeServices, setError, updateVoiceState])

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!audioCapture.current || !voiceWebSocket.current) return

    try {
      // Stop recording
      audioCapture.current.stopRecording()

      // Send final audio chunk
      if (voiceWebSocket.current.connected) {
        voiceWebSocket.current.sendAudioChunk(new ArrayBuffer(0), 0, true)
      }

      updateVoiceState({
        isRecording: false,
        isListening: false,
        isThinking: true
      })

      console.log('✓ Stopped voice recording')
    } catch (error) {
      console.error('Failed to stop recording:', error)
      setError(VoiceErrors.unknown(`Failed to stop recording: ${error}`))
      updateVoiceState({ isRecording: false })
    }
  }, [updateVoiceState, setError])

  // Toggle voice mode
  const toggleVoiceMode = useCallback(() => {
    if (voiceState.isVoiceMode) {
      // Disable voice mode
      if (voiceState.isRecording) {
        stopRecording()
      }
      updateVoiceState({ isVoiceMode: false })
    } else {
      // Enable voice mode
      updateVoiceState({ isVoiceMode: true })
      // Initialize services when entering voice mode
      initializeServices()
    }
  }, [voiceState.isVoiceMode, voiceState.isRecording, stopRecording, updateVoiceState, initializeServices])

  // Retry after error
  const retry = useCallback(() => {
    setError(null)
    if (voiceState.isVoiceMode && !voiceState.isRecording) {
      startRecording()
    }
  }, [setError, voiceState.isVoiceMode, voiceState.isRecording, startRecording])

  // Fallback to text mode
  const fallbackToText = useCallback(() => {
    if (voiceState.isRecording) {
      stopRecording()
    }
    updateVoiceState({ isVoiceMode: false })
    setError(null)
  }, [voiceState.isRecording, stopRecording, updateVoiceState, setError])

  // Cleanup services
  const cleanup = useCallback(() => {
    if (audioCapture.current) {
      audioCapture.current.cleanup()
      audioCapture.current = null
    }

    if (audioPlayer.current) {
      audioPlayer.current.cleanup()
      audioPlayer.current = null
    }

    if (voiceWebSocket.current) {
      voiceWebSocket.current.close()
      voiceWebSocket.current = null
    }

    isInitialized.current = false
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return {
    voiceState,
    startRecording,
    stopRecording,
    toggleVoiceMode,
    retry,
    fallbackToText,
    setError,
    updateVoiceState
  }
}
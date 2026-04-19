import React, { useEffect, useRef } from 'react'
import { Mic, MicOff, Volume2 } from 'lucide-react'
import { AudioCapture } from '../../services/AudioCapture'
import { AudioPlayer } from '../../services/AudioPlayer'
import { VoiceWebSocket } from '../../services/VoiceWebSocket'
import AudioVisualizer from './AudioVisualizer'
import GPTWaveVisualizer from './GPTWaveVisualizer'

export interface VoiceState {
  isRecording: boolean
  isListening: boolean
  isThinking: boolean
  isSpeaking: boolean
  isVoiceMode: boolean
  error: string | null
}

interface VoiceInterfaceProps {
  sessionId: string
  voiceState: VoiceState
  onVoiceStateChange: (state: Partial<VoiceState>) => void
  onTranscript: (text: string, isFinal: boolean) => void
  onAudioResponse: (text: string) => void
  disabled?: boolean
}

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({
  sessionId,
  voiceState,
  onVoiceStateChange,
  onTranscript,
  onAudioResponse,
  disabled = false
}) => {
  const audioCapture = useRef<AudioCapture | null>(null)
  const audioPlayer = useRef<AudioPlayer | null>(null)
  const voiceWebSocket = useRef<VoiceWebSocket | null>(null)
  const [audioLevel, setAudioLevel] = React.useState(0)
  const [analyser, setAnalyser] = React.useState<AnalyserNode | null>(null)

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
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
        
        // Set up message handlers
        setupWebSocketHandlers()

        console.log('✓ Voice services initialized')
      } catch (error) {
        console.error('Failed to initialize voice services:', error)
        onVoiceStateChange({
          error: `Failed to initialize voice services: ${error}`
        })
      }
    }

    initializeServices()

    // Cleanup on unmount
    return () => {
      cleanup()
    }
  }, [sessionId])

  // Setup WebSocket message handlers
  const setupWebSocketHandlers = () => {
    if (!voiceWebSocket.current) return

    // Handle partial transcripts
    voiceWebSocket.current.onMessage('partial_transcript', (message) => {
      if (message.text) {
        onTranscript(message.text, false)
      }
    })

    // Handle final transcripts
    voiceWebSocket.current.onMessage('final_transcript', (message) => {
      if (message.text) {
        onTranscript(message.text, true)
        onVoiceStateChange({ isListening: false, isThinking: true })
      }
    })

    // Handle text responses
    voiceWebSocket.current.onMessage('text_response', (message) => {
      if (message.text) {
        onAudioResponse(message.text)
        onVoiceStateChange({ isThinking: false, isSpeaking: true })
      }
    })

    // Handle audio chunks
    voiceWebSocket.current.onMessage('audio_chunk', async (message) => {
      if (message.data && audioPlayer.current) {
        try {
          const audioBuffer = VoiceWebSocket.base64ToArrayBuffer(message.data)
          await audioPlayer.current.addAudioChunk(
            audioBuffer,
            message.chunkIndex || 0,
            message.isFinal || false
          )

          if (message.isFinal) {
            onVoiceStateChange({ isSpeaking: false })
          }
        } catch (error) {
          console.error('Audio playback error:', error)
        }
      }
    })

    // Handle errors
    voiceWebSocket.current.onMessage('error', (message) => {
      onVoiceStateChange({
        error: message.message || 'Unknown error',
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
      onVoiceStateChange({
        isRecording: false,
        isListening: false,
        isThinking: false,
        isSpeaking: false
      })
    })
  }

  // Start voice recording
  const startRecording = async () => {
    if (!audioCapture.current || !voiceWebSocket.current || disabled) return

    try {
      // Clear any previous errors
      onVoiceStateChange({ error: null })

      // Check microphone availability
      const hasPermission = await AudioCapture.requestMicrophonePermission()
      if (!hasPermission) {
        throw new Error('Microphone access denied')
      }

          // Initialize audio capture if needed
      if (audioCapture.current.state === 'closed') {
        await audioCapture.current.initialize()
      }
      
      // Set analyser for visualizer
      if (audioCapture.current) {
        setAnalyser(audioCapture.current.getAnalyser())
      }

      // Connect WebSocket if needed
      if (!voiceWebSocket.current.connected) {
        await voiceWebSocket.current.connect()
      }

      // Start recording
      await audioCapture.current.startRecording((chunk) => {
        // Update visualizer level
        setAudioLevel(chunk.volume)

        if (voiceWebSocket.current?.connected && chunk.data && chunk.data.byteLength > 0) {
          voiceWebSocket.current.sendAudioChunk(
            chunk.data,
            chunk.chunkIndex,
            false
          )
        }
      })

      onVoiceStateChange({
        isRecording: true,
        isListening: true,
        isThinking: false,
        isSpeaking: false
      })

      console.log('✓ Started voice recording')
    } catch (error) {
      console.error('Failed to start recording:', error)
      onVoiceStateChange({
        error: `Failed to start recording: ${error}`,
        isRecording: false
      })
    }
  }

  // Stop voice recording
  const stopRecording = () => {
    if (!audioCapture.current || !voiceWebSocket.current) return

    try {
      // Stop recording
      audioCapture.current.stopRecording()
      setAudioLevel(0)

      // Send final audio chunk
      if (voiceWebSocket.current.connected) {
        voiceWebSocket.current.sendAudioChunk(new ArrayBuffer(0), 0, true)
      }

      onVoiceStateChange({
        isRecording: false,
        isListening: false,
        isThinking: true
      })

      console.log('✓ Stopped voice recording')
    } catch (error) {
      console.error('Failed to stop recording:', error)
      onVoiceStateChange({
        error: `Failed to stop recording: ${error}`,
        isRecording: false
      })
    }
  }

  // Toggle voice mode
  const toggleVoiceMode = () => {
    if (voiceState.isVoiceMode) {
      // Disable voice mode
      if (voiceState.isRecording) {
        stopRecording()
      }
      onVoiceStateChange({ isVoiceMode: false })
    } else {
      // Enable voice mode
      onVoiceStateChange({ isVoiceMode: true })
    }
  }

  // Cleanup resources
  const cleanup = () => {
    if (audioCapture.current) {
      audioCapture.current.cleanup()
      audioCapture.current = null
      setAnalyser(null)
    }

    if (audioPlayer.current) {
      audioPlayer.current.cleanup()
      audioPlayer.current = null
    }

    if (voiceWebSocket.current) {
      voiceWebSocket.current.close()
      voiceWebSocket.current = null
    }
  }

  // Get current status text
  const getStatusText = () => {
    if (voiceState.error) return 'Error'
    if (voiceState.isSpeaking) return 'Speaking...'
    if (voiceState.isThinking) return 'Thinking...'
    if (voiceState.isListening) return 'Listening...'
    if (voiceState.isRecording) return 'Recording...'
    return voiceState.isVoiceMode ? 'Voice Mode' : 'Text Mode'
  }

  // Get button icon
  const getButtonIcon = () => {
    if (voiceState.isSpeaking) return <Volume2 size={20} />
    if (voiceState.isRecording) return <MicOff size={20} />
    return <Mic size={20} />
  }

  // Handle button click
  const handleButtonClick = () => {
    if (disabled) return

    if (!voiceState.isVoiceMode) {
      toggleVoiceMode()
    } else if (voiceState.isRecording) {
      stopRecording()
    } else if (!voiceState.isThinking && !voiceState.isSpeaking) {
      startRecording()
    }
  }

  return (
    <div className="voice-interface">
      {/* Voice Mode Toggle */}
      <button
        onClick={toggleVoiceMode}
        className={`voice-mode-toggle ${voiceState.isVoiceMode ? 'active' : ''}`}
        disabled={disabled}
        title={voiceState.isVoiceMode ? 'Switch to text mode' : 'Switch to voice mode'}
      >
        <Mic size={16} />
        {voiceState.isVoiceMode ? 'Voice' : 'Text'}
      </button>

      {/* Voice Controls (only show in voice mode) */}
      {voiceState.isVoiceMode && (
        <div className="voice-controls">
          {/* Main Voice Button */}
          <button
            onClick={handleButtonClick}
            className={`voice-button ${voiceState.isRecording ? 'recording' : ''} ${
              voiceState.isThinking ? 'thinking' : ''
            } ${voiceState.isSpeaking ? 'speaking' : ''}`}
            disabled={disabled || voiceState.isThinking}
            title={voiceState.isRecording ? 'Stop recording' : 'Start recording'}
          >
            {getButtonIcon()}
          </button>

          {/* Status Text */}
          <span className={`voice-status ${voiceState.error ? 'error' : ''}`}>
            {getStatusText()}
          </span>

          {/* Audio Visualizer - GPT Style */}
          {voiceState.isRecording && (
            <GPTWaveVisualizer 
              isActive={true} 
              analyser={analyser} 
              width={160}
              height={40}
              waveCount={4}
              color="#6c5ce7"
              className="ml-2"
            />
          )}
        </div>
      )}

      {/* Error Display */}
      {voiceState.error && (
        <div className="voice-error">
          <span>{voiceState.error}</span>
          <button
            onClick={() => onVoiceStateChange({ error: null })}
            className="error-dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

export default VoiceInterface
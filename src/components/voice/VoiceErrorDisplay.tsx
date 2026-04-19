import React from 'react'
import { AlertCircle, Mic, RefreshCw, X } from 'lucide-react'

export type VoiceErrorType = 
  | 'microphone_denied'
  | 'microphone_not_found'
  | 'connection_lost'
  | 'transcription_failed'
  | 'tts_failed'
  | 'unknown'

export interface VoiceError {
  type: VoiceErrorType
  message: string
  recoverable: boolean
}


interface VoiceErrorDisplayProps {
  error: VoiceError | null
  onRetry?: () => void
  onFallbackToText?: () => void
  onDismiss?: () => void
  className?: string
}

const VoiceErrorDisplay: React.FC<VoiceErrorDisplayProps> = ({
  error,
  onRetry,
  onFallbackToText,
  onDismiss,
  className = ''
}) => {
  if (!error) return null

  const getErrorIcon = () => {
    switch (error.type) {
      case 'microphone_denied':
      case 'microphone_not_found':
        return <Mic size={20} />
      case 'connection_lost':
        return <RefreshCw size={20} />
      default:
        return <AlertCircle size={20} />
    }
  }

  const getErrorTitle = () => {
    switch (error.type) {
      case 'microphone_denied':
        return 'Microphone Access Denied'
      case 'microphone_not_found':
        return 'Microphone Not Found'
      case 'connection_lost':
        return 'Connection Lost'
      case 'transcription_failed':
        return 'Transcription Failed'
      case 'tts_failed':
        return 'Audio Playback Failed'
      default:
        return 'Voice Error'
    }
  }

  const getErrorSuggestions = () => {
    switch (error.type) {
      case 'microphone_denied':
        return [
          'Click the microphone icon in your browser\'s address bar',
          'Allow microphone access for this site',
          'Refresh the page and try again'
        ]
      case 'microphone_not_found':
        return [
          'Check that your microphone is connected',
          'Try a different microphone',
          'Check your system audio settings'
        ]
      case 'connection_lost':
        return [
          'Check your internet connection',
          'Try refreshing the page',
          'The server may be temporarily unavailable'
        ]
      case 'transcription_failed':
        return [
          'Speak more clearly',
          'Reduce background noise',
          'Try speaking closer to the microphone'
        ]
      case 'tts_failed':
        return [
          'Check your speaker/headphone connection',
          'Try adjusting your system volume',
          'The audio response is still available as text'
        ]
      default:
        return ['Please try again or use text input']
    }
  }

  const showRetryButton = error.recoverable && onRetry
  const showFallbackButton = onFallbackToText

  return (
    <div className={`voice-error-display ${className}`}>
      <div className="error-content">
        <div className="error-header">
          <div className="error-icon">
            {getErrorIcon()}
          </div>
          <div className="error-info">
            <h4 className="error-title">{getErrorTitle()}</h4>
            <p className="error-message">{error.message}</p>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="error-dismiss"
              title="Dismiss error"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="error-suggestions">
          <p className="suggestions-title">Try this:</p>
          <ul className="suggestions-list">
            {getErrorSuggestions().map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </div>

        <div className="error-actions">
          {showRetryButton && (
            <button
              onClick={onRetry}
              className="error-action retry"
            >
              <RefreshCw size={16} />
              Try Again
            </button>
          )}
          
          {showFallbackButton && (
            <button
              onClick={onFallbackToText}
              className="error-action fallback"
            >
              <Mic size={16} />
              Use Text Input
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper function to create error objects
export const createVoiceError = (
  type: VoiceErrorType,
  message: string,
  recoverable: boolean = true
): VoiceError => ({
  type,
  message,
  recoverable
})

// Predefined error creators
export const VoiceErrors = {
  microphoneDenied: (message?: string) => createVoiceError(
    'microphone_denied',
    message || 'Microphone access was denied. Please allow microphone access to use voice features.',
    false
  ),
  
  microphoneNotFound: (message?: string) => createVoiceError(
    'microphone_not_found',
    message || 'No microphone found. Please connect a microphone and try again.',
    true
  ),
  
  connectionLost: (message?: string) => createVoiceError(
    'connection_lost',
    message || 'Connection to voice service was lost. Please check your internet connection.',
    true
  ),
  
  transcriptionFailed: (message?: string) => createVoiceError(
    'transcription_failed',
    message || 'Could not transcribe your speech. Please try speaking more clearly.',
    true
  ),
  
  ttsFailed: (message?: string) => createVoiceError(
    'tts_failed',
    message || 'Could not play audio response. The text response is still available.',
    true
  ),
  
  unknown: (message?: string) => createVoiceError(
    'unknown',
    message || 'An unexpected error occurred. Please try again.',
    true
  )
}

export default VoiceErrorDisplay
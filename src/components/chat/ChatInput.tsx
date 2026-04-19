import React, { useState, useRef, useEffect } from 'react'
import { Send, Mic } from 'lucide-react'
import VoiceModeToggle from '../voice/VoiceModeToggle'
import RecordingIndicator from '../voice/RecordingIndicator'
import type { RecordingState } from '../voice/RecordingIndicator'

interface ChatInputProps {
    onSendMessage: (text: string) => void
    disabled?: boolean
    prefill?: string
    // Voice props
    isVoiceMode?: boolean
    onToggleVoiceMode?: () => void
    voiceState?: {
        isRecording: boolean
        isListening: boolean
        isThinking: boolean
        isSpeaking: boolean
    }
    onStartRecording?: () => void
    onStopRecording?: () => void
    partialTranscript?: string
}

const ChatInput: React.FC<ChatInputProps> = ({ 
    onSendMessage, 
    disabled, 
    prefill,
    isVoiceMode = false,
    onToggleVoiceMode,
    voiceState,
    onStartRecording,
    onStopRecording,
    partialTranscript = ''
}) => {
    const [input, setInput] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (prefill) {
            setInput(prefill)
            inputRef.current?.focus()
        }
    }, [prefill])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (input.trim() && !disabled) {
            onSendMessage(input.trim())
            setInput('')
        }
    }

    const handleVoiceButtonClick = () => {
        if (!voiceState) return

        if (voiceState.isRecording) {
            onStopRecording?.()
        } else if (!voiceState.isThinking && !voiceState.isSpeaking) {
            onStartRecording?.()
        }
    }

    const getRecordingState = (): RecordingState => {
        if (!voiceState) return 'idle'
        if (voiceState.isSpeaking) return 'speaking'
        if (voiceState.isThinking) return 'thinking'
        if (voiceState.isListening) return 'listening'
        return 'idle'
    }

    const getVoiceButtonIcon = () => {
        if (!voiceState) return <Mic size={18} />
        if (voiceState.isRecording) return <Mic size={18} />
        return <Mic size={18} />
    }

    const isVoiceButtonDisabled = () => {
        return disabled || (voiceState?.isThinking || voiceState?.isSpeaking)
    }

    return (
        <div className="input-area">
            {/* Voice Mode Toggle */}
            {onToggleVoiceMode && (
                <div className="input-mode-controls">
                    <VoiceModeToggle
                        isVoiceMode={isVoiceMode}
                        onToggle={onToggleVoiceMode}
                        disabled={disabled}
                    />
                    {isVoiceMode && voiceState && (
                        <RecordingIndicator
                            state={getRecordingState()}
                            className="recording-status"
                        />
                    )}
                </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="input-wrapper">
                {/* Text Input (hidden in voice mode when recording) */}
                {(!isVoiceMode || !voiceState?.isRecording) && (
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={
                            disabled 
                                ? "Connecting..." 
                                : isVoiceMode 
                                    ? "Speak or type your message..."
                                    : "Ask about dental care, appointments..."
                        }
                        disabled={disabled}
                        autoComplete="off"
                        className={isVoiceMode ? 'voice-mode-input' : ''}
                    />
                )}

                {/* Voice Recording Placeholder / Partial Transcript */}
                {isVoiceMode && voiceState?.isRecording && (
                    <div className="voice-recording-placeholder">
                        <Mic size={16} className="recording-icon" />
                        {partialTranscript ? (
                            <span className="live-transcript">{partialTranscript}</span>
                        ) : (
                            <span className="listening-text">Listening...</span>
                        )}
                        <span className="transcript-cursor">|</span>
                    </div>
                )}

                {/* Send/Voice Button */}
                {isVoiceMode ? (
                    <button
                        type="button"
                        onClick={handleVoiceButtonClick}
                        className={`voice-btn ${voiceState?.isRecording ? 'recording' : ''}`}
                        disabled={isVoiceButtonDisabled()}
                        title={voiceState?.isRecording ? 'Stop recording' : 'Start recording'}
                    >
                        {getVoiceButtonIcon()}
                    </button>
                ) : (
                    <button
                        type="submit"
                        className="send-btn"
                        disabled={disabled || !input.trim()}
                    >
                        <Send size={18} />
                    </button>
                )}
            </form>


            <p className="input-hint">
                SmileCare AI may produce inaccurate information. Always consult a professional.
            </p>
        </div>
    )
}

export default ChatInput

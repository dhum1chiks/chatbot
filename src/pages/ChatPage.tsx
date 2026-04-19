import React, { useMemo, useState } from 'react'
import Header from '../components/global/Header'
import MessageList from '../components/chat/MessageList'
import ChatInput from '../components/chat/ChatInput'
import VoiceErrorDisplay from '../components/voice/VoiceErrorDisplay'
import { useChat } from '../hooks/useChat'
import { useVoice } from '../hooks/useVoice'

const ChatPage: React.FC = () => {
    // Use a stable session ID for this demo
    const sessionId = useMemo(() => Math.random().toString(36).substring(7), [])
    const [prefill, setPrefill] = useState('')
    const voiceTextBufferRef = React.useRef('')
    const pacingRef = React.useRef<any>(null)



    // Cleanup pacer on unmount
    React.useEffect(() => {
        return () => {
            if (pacingRef.current) clearInterval(pacingRef.current);
        }
    }, []);



    const {
        messages,
        connected,
        isTyping,
        sendMessage,
        addMessage,
        appendLastMessage,
        resetSession
    } = useChat(sessionId)

    const {
        voiceState,
        startRecording,
        stopRecording,
        toggleVoiceMode,
        retry,
        fallbackToText,
        setError
    } = useVoice({
        sessionId,
        onTranscript: (text, isFinal) => {
            if (isFinal) {
                // Add to UI manually to avoid triggering a second sendMessage/LLM call
                addMessage({ 
                    role: 'user', 
                    content: text, 
                    isVoice: true, 
                    timestamp: Date.now() 
                })
            }
        },
        onAudioResponse: (_text) => {
            // Only start if we have something to say and aren't already pacing
            if (pacingRef.current) return;
            
            console.log('✓ AI started speaking, starting synchronized text pacer');
            
            pacingRef.current = setInterval(() => {
                const buffer = voiceTextBufferRef.current;
                
                if (buffer.length === 0) {
                    // Check if we should keep the timer alive waiting for more tokens
                    // (LLM might still be generating)
                    // But for now, we just wait
                    return;
                }
                
                // Adaptive speed: Print faster if the buffer is large to keep up with voice
                const chunkLength = buffer.length > 80 ? 8 : (buffer.length > 20 ? 4 : 2);
                const chunk = buffer.substring(0, chunkLength);
                
                // Append to UI
                appendLastMessage(chunk);
                
                // Drain the ref
                voiceTextBufferRef.current = buffer.substring(chunkLength);
                
                // If we hit punctuation, slow down slightly for a natural feel
                if (chunk.match(/[.,!?]/)) {
                    // This is handled by the next interval tick naturally, 
                    // or we could skip a tick here.
                }

            }, 40); // Fast 40ms interval for smooth flow
        },
        onPartialTextResponse: (token) => {
            // Fill the hidden memory buffer instead of the UI state
            voiceTextBufferRef.current += token;
        },
        onError: (error) => {
            console.error('Voice error:', error)
            if (pacingRef.current) clearInterval(pacingRef.current);
            voiceTextBufferRef.current = '';
        }

    })


    const handleSuggestionClick = (text: string) => {
        setPrefill(text + ' ')  // trigger prefill with a space to force uniqueness
        setTimeout(() => setPrefill(''), 50)
        sendMessage(text)
    }

    const handleSendMessage = (text: string) => {
        sendMessage(text)
    }

    const handleToggleVoiceMode = () => {
        toggleVoiceMode()
    }

    const handleStartRecording = () => {
        startRecording()
    }

    const handleStopRecording = () => {
        stopRecording()
    }

    const handleErrorRetry = () => {
        retry()
    }

    const handleErrorFallback = () => {
        fallbackToText()
    }

    const handleErrorDismiss = () => {
        setError(null)
        if (pacingRef.current) clearInterval(pacingRef.current);
        voiceTextBufferRef.current = '';
    }



    return (
        <div className="flex flex-col h-full">
            <Header
                connected={connected}
                onReset={resetSession}
            />
            
            {/* Voice Error Display */}
            {voiceState.error && (
                <VoiceErrorDisplay
                    error={voiceState.error}
                    onRetry={handleErrorRetry}
                    onFallbackToText={handleErrorFallback}
                    onDismiss={handleErrorDismiss}
                />
            )}
            
            <MessageList
                messages={messages}
                isTyping={isTyping}
                partialTranscript={voiceState.partialTranscript}
                onSuggestionClick={handleSuggestionClick}
            />
            
            <ChatInput
                onSendMessage={handleSendMessage}
                disabled={!connected}
                prefill={prefill}
                isVoiceMode={voiceState.isVoiceMode}
                onToggleVoiceMode={handleToggleVoiceMode}
                voiceState={{
                    isRecording: voiceState.isRecording,
                    isListening: voiceState.isListening,
                    isThinking: voiceState.isThinking,
                    isSpeaking: voiceState.isSpeaking
                }}
                partialTranscript={voiceState.partialTranscript}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
            />

        </div>
    )
}

export default ChatPage

import React, { useEffect, useRef } from 'react'
import MessageItem from './MessageItem'
import { Message } from '../../hooks/useChat'

interface MessageListProps {
    messages: Message[]
    isTyping: boolean
    onSuggestionClick?: (text: string) => void
}

const SUGGESTIONS = [
    "Book an appointment",
    "What services do you offer?",
    "Teeth whitening options",
    "Emergency dental care",
]

const MessageList: React.FC<MessageListProps> = ({ messages, isTyping, onSuggestionClick }) => {
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isTyping])

    const showWelcome = messages.length <= 1

    return (
        <main ref={scrollRef} className="chat-container">
            {showWelcome ? (
                <div className="welcome-screen">
                    <div className="welcome-icon">🦷</div>
                    <h2 className="welcome-title">SmileCare Assistant</h2>
                    <p className="welcome-subtitle">
                        Your friendly dental AI assistant. Ask me anything about dental care, appointments, or our services.
                    </p>
                    <div className="welcome-chips">
                        {SUGGESTIONS.map((suggestion) => (
                            <button
                                key={suggestion}
                                className="welcome-chip"
                                onClick={() => onSuggestionClick?.(suggestion)}
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="chat-inner">
                    <div className="date-separator">
                        <span>Today</span>
                    </div>
                    {messages.map((msg, index) => (
                        <MessageItem key={index} message={msg} />
                    ))}
                    {isTyping && (
                        <div className="message-row ai">
                            <div className="message-avatar ai">🦷</div>
                            <div className="message-bubble ai">
                                <div className="typing-indicator">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </main>
    )
}

export default MessageList

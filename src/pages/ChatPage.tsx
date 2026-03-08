import React, { useMemo, useState } from 'react'
import Header from '../components/global/Header'
import MessageList from '../components/chat/MessageList'
import ChatInput from '../components/chat/ChatInput'
import { useChat } from '../hooks/useChat'

const ChatPage: React.FC = () => {
    // Use a stable session ID for this demo
    const sessionId = useMemo(() => Math.random().toString(36).substring(7), [])
    const [prefill, setPrefill] = useState('')

    const {
        messages,
        connected,
        isTyping,
        sendMessage,
        resetSession
    } = useChat(sessionId)

    const handleSuggestionClick = (text: string) => {
        setPrefill(text + ' ')  // trigger prefill with a space to force uniqueness
        setTimeout(() => setPrefill(''), 50)
        sendMessage(text)
    }

    return (
        <div className="flex flex-col h-full">
            <Header
                connected={connected}
                onReset={resetSession}
            />
            <MessageList
                messages={messages}
                isTyping={isTyping}
                onSuggestionClick={handleSuggestionClick}
            />
            <ChatInput
                onSendMessage={sendMessage}
                disabled={!connected}
                prefill={prefill}
            />
        </div>
    )
}

export default ChatPage

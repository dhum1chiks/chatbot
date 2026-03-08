import React from 'react'
import { Message } from '../../hooks/useChat'

interface MessageItemProps {
    message: Message
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
    const isAi = message.role === 'ai'

    return (
        <div className={`message-row ${isAi ? 'ai' : 'user'}`}>
            <div className={`message-avatar ${isAi ? 'ai' : 'user'}`}>
                {isAi ? '🦷' : '👤'}
            </div>
            <div className={`message-bubble ${isAi ? 'ai' : 'user'}`}>
                {message.content}
            </div>
        </div>
    )
}

export default MessageItem

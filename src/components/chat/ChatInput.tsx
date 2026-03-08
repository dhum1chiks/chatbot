import React, { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'

interface ChatInputProps {
    onSendMessage: (text: string) => void
    disabled?: boolean
    prefill?: string
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled, prefill }) => {
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

    return (
        <div className="input-area">
            <form onSubmit={handleSubmit} className="input-wrapper">
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={disabled ? "Connecting..." : "Ask about dental care, appointments..."}
                    disabled={disabled}
                    autoComplete="off"
                />
                <button
                    type="submit"
                    className="send-btn"
                    disabled={disabled || !input.trim()}
                >
                    <Send size={18} />
                </button>
            </form>
            <p className="input-hint">SmileCare AI may produce inaccurate information. Always consult a professional.</p>
        </div>
    )
}

export default ChatInput

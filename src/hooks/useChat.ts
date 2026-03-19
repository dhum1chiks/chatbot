import { useState, useEffect, useRef, useCallback } from 'react'

export interface Message {
    role: 'user' | 'ai'
    content: string
}

export function useChat(sessionId: string) {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', content: "Hello! I'm your SmileCare Clinic assistant. How can I help you today?" }
    ])
    const [connected, setConnected] = useState(false)
    const [isTyping, setIsTyping] = useState(false)
    const socketRef = useRef<WebSocket | null>(null)

    const connect = useCallback(() => {
        const BACKEND_URL = 'chatbotbackend-production-4d4b.up.railway.app';
        const hostname = window.location.hostname;
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
        const protocol = isLocal ? 'ws:' : 'wss:';
        const host = isLocal ? 'localhost:8000' : BACKEND_URL;
        const wsUrl = `${protocol}//${host}/ws/chat/${sessionId}`;

        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => setConnected(true);
        socket.onclose = () => {
            setConnected(false);
            setTimeout(connect, 3000);
        };

        socket.onmessage = (event) => {
            const token = event.data;
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'ai') {
                    return [
                        ...prev.slice(0, -1),
                        { ...lastMsg, content: lastMsg.content + token }
                    ];
                } else {
                    return [...prev, { role: 'ai', content: token }];
                }
            });
            setIsTyping(false);
        };

        return () => socket.close();
    }, [sessionId]);

    useEffect(() => {
        connect();
        return () => socketRef.current?.close();
    }, [connect]);

    const sendMessage = (text: string) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            setMessages(prev => [...prev, { role: 'user', content: text }]);
            socketRef.current.send(text);
            setIsTyping(true);
        }
    };

    const resetSession = async () => {
        try {
            const BACKEND_URL = 'https://chatbotbackend-production-4d4b.up.railway.app';
            const hostname = window.location.hostname;
            const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
            const baseUrl = isLocal ? 'http://localhost:8000' : BACKEND_URL;
            await fetch(`${baseUrl}/reset/${sessionId}`, { method: 'POST' });
            setMessages([{ role: 'ai', content: "Session reset. How can I help you?" }]);
        } catch (err) {
            console.error('Reset failed:', err);
        }
    };

    return { messages, connected, isTyping, sendMessage, resetSession };
}

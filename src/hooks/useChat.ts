/// <reference types="vite/client" />
import { useState, useEffect, useRef, useCallback } from 'react'

export interface Message {
    role: 'user' | 'ai'
    content: string
    isVoice?: boolean
    timestamp?: number
}

export function useChat(sessionId: string) {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', content: "Hello! I'm your SmileCare Clinic assistant. How can I help you today?" }
    ])
    const [connected, setConnected] = useState(false)
    const [isTyping, setIsTyping] = useState(false)
    const socketRef = useRef<WebSocket | null>(null)

    const connect = useCallback(() => {
        // 1. Direct Connect: Always prioritize localhost:8000 if reachable
        // To use this on Vercel (HTTPS), you must allow "Insecure Content" in site settings.
        const envBackend = import.meta.env.VITE_BACKEND_URL as string | undefined;
        const hostname = window.location.hostname;
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

        // We use a separate logic here: if we're on localhost, obviously use localhost.
        // If we're remote, we'll try localhost first (this is handled by the status hook).
        // For the actual connection, we'll check if we should override.
        
        let backendHost = '';
        if (isLocal) {
            backendHost = 'localhost:8000';
        } else if (envBackend) {
            backendHost = envBackend.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').replace(/\/+$/, '');
        } else {
            // Default to current host
            backendHost = window.location.host;
        }

        // Add a check: if the user is visiting a remote site but has a local backend,
        // we want to allow them to "Direct Connect" via the UI or by default.
        // For now, we'll default to localhost:8000 if isLocal, or the env var.


        const protocol = isLocal ? 'ws:' : (window.location.protocol === 'https:' ? 'wss:' : 'ws:');
        const wsUrl = `${protocol}//${backendHost}/ws/chat/${sessionId}`;

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

    const sendMessage = (text: string, isVoice: boolean = false) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            setMessages(prev => [...prev, { 
                role: 'user', 
                content: text, 
                isVoice,
                timestamp: Date.now()
            }]);
            socketRef.current.send(text);
            setIsTyping(true);
        }
    };

    const addMessage = (message: Message) => {
        setMessages(prev => [...prev, message]);
    };

    const appendLastMessage = (token: string) => {
        setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === 'ai') {
                return [
                    ...prev.slice(0, -1),
                    { ...lastMsg, content: lastMsg.content + token }
                ];
            }
            return [...prev, { role: 'ai', content: token }];
        });
    };


    const resetSession = async () => {
        try {
            const envBackend = import.meta.env.VITE_BACKEND_URL as string | undefined;
            const hostname = window.location.hostname;
            const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
            const baseUrl = isLocal
                ? 'http://localhost:8000'
                : (envBackend ? (envBackend.startsWith('http') ? envBackend : `https://${envBackend}`) : `${window.location.protocol}//${window.location.host}`);

            await fetch(`${baseUrl}/reset/${sessionId}`, { method: 'POST' });
            setMessages([{ role: 'ai', content: "Session reset. How can I help you?" }]);
        } catch (err) {
            console.error('Reset failed:', err);
        }
    };

    return { 
        messages, 
        connected, 
        isTyping, 
        sendMessage, 
        addMessage,
        appendLastMessage,
        resetSession 
    };
}


/// <reference types="vite/client" />
import { useState, useEffect } from 'react';

export const useBackendStatus = () => {
    const [isOnline, setIsOnline] = useState<boolean>(false);
    const [isChecking, setIsChecking] = useState<boolean>(true);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                // 1. Always check for a local backend first to support "Direct Connect" mode
                // Note: This requires the user to allow "Insecure Content" in their browser settings
                // if they are accessing the site via HTTPS (Vercel).
                try {
                    const localResponse = await fetch('http://localhost:8000/health', {
                        mode: 'cors',
                        cache: 'no-cache',
                        signal: AbortSignal.timeout(1000) // Fast timeout for local probe
                    });
                    if (localResponse.ok) {
                        const data = await localResponse.json();
                        if (data.status === 'online') {
                            setIsOnline(true);
                            setIsChecking(false);
                            return;
                        }
                    }
                } catch (e) {
                    // Local check failed, proceed to configured backend
                }

                // 2. Fall back to configured VITE_BACKEND_URL or current host
                const envBackend = import.meta.env.VITE_BACKEND_URL as string | undefined;
                const hostname = window.location.hostname;
                const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

                let backendBase = '';
                if (isLocal) {
                    backendBase = 'http://localhost:8000';
                } else if (envBackend) {
                    let cleanUrl = envBackend.trim().replace(/\/+$/, '');
                    if (!/^https?:\/\//i.test(cleanUrl)) {
                        cleanUrl = `https://${cleanUrl}`;
                    }
                    backendBase = cleanUrl;
                } else {
                    backendBase = window.location.origin;
                }

                const response = await fetch(`${backendBase}/health`, {


                    mode: 'cors',
                    cache: 'no-cache'
                });

                if (response.ok) {
                    const data = await response.json();
                    setIsOnline(data.status === 'online');
                } else {
                    setIsOnline(false);
                }
            } catch (error) {
                setIsOnline(false);
            } finally {
                setIsChecking(false);
            }
        };

        // Initial check
        checkStatus();

        // Set up polling every 5 seconds
        const interval = setInterval(checkStatus, 5000);

        return () => clearInterval(interval);
    }, []);

    return { isOnline, isChecking };
};

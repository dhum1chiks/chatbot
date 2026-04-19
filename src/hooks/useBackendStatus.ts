/// <reference types="vite/client" />
import { useState, useEffect } from 'react';

export const useBackendStatus = () => {
    const [isOnline, setIsOnline] = useState<boolean>(false);
    const [isChecking, setIsChecking] = useState<boolean>(true);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const envBackend = import.meta.env.VITE_BACKEND_URL as string | undefined;
                const hostname = window.location.hostname;
                const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

                const backendBase = isLocal
                    ? 'http://localhost:8000'
                    : (envBackend ? (envBackend.startsWith('http') ? envBackend : `https://${envBackend}`) : `https://${window.location.host}`);

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

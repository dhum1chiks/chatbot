import React from 'react'

interface StatusIndicatorProps {
    connected: boolean
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ connected }) => {
    return (
        <div className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
            <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
            <span className="status-text">
                {connected ? 'Connected' : 'Offline'}
            </span>
        </div>
    )
}

export default StatusIndicator

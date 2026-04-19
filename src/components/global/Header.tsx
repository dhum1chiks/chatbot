import React from 'react'
import { RotateCcw } from 'lucide-react'
import StatusIndicator from './StatusIndicator'

interface HeaderProps {
    connected: boolean
    onReset: () => void
}

const Header: React.FC<HeaderProps> = ({ connected, onReset }) => {
    return (
        <header>
            <div className="header-content">
                <div className="header-brand">
                    <div className="header-logo">🦷</div>
                    <h1 className="header-title">
                        SmileCare <span>AI</span>
                    </h1>
                </div>
                <div className="header-actions">
                    <StatusIndicator connected={connected} />
                    <button onClick={onReset} className="reset-btn">
                        <RotateCcw size={14} />
                        New Chat
                    </button>
                </div>
            </div>
        </header>
    )
}

export default Header

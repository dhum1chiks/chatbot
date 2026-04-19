import React from 'react'
import { Mic, Brain, Volume2 } from 'lucide-react'

export type RecordingState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface RecordingIndicatorProps {
  state: RecordingState
  className?: string
}

const RecordingIndicator: React.FC<RecordingIndicatorProps> = ({ 
  state, 
  className = '' 
}) => {
  const getIndicatorContent = () => {
    switch (state) {
      case 'listening':
        return {
          icon: <Mic size={16} />,
          text: 'Listening...',
          className: 'listening',
          showPulse: true
        }
      case 'thinking':
        return {
          icon: <Brain size={16} />,
          text: 'Thinking...',
          className: 'thinking',
          showPulse: true
        }
      case 'speaking':
        return {
          icon: <Volume2 size={16} />,
          text: 'Speaking...',
          className: 'speaking',
          showPulse: true
        }
      default:
        return {
          icon: <Mic size={16} />,
          text: 'Ready',
          className: 'idle',
          showPulse: false
        }
    }
  }

  const { icon, text, className: stateClass, showPulse } = getIndicatorContent()

  return (
    <div className={`recording-indicator ${stateClass} ${className}`}>
      <div className={`indicator-icon ${showPulse ? 'pulse' : ''}`}>
        {icon}
      </div>
      <span className="indicator-text">{text}</span>
      {showPulse && (
        <div className="pulse-rings">
          <div className="pulse-ring ring-1" />
          <div className="pulse-ring ring-2" />
          <div className="pulse-ring ring-3" />
        </div>
      )}
    </div>
  )
}

export default RecordingIndicator
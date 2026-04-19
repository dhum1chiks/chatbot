import React from 'react'
import { Mic, Keyboard } from 'lucide-react'

interface VoiceModeToggleProps {
  isVoiceMode: boolean
  onToggle: () => void
  disabled?: boolean
  className?: string
}

const VoiceModeToggle: React.FC<VoiceModeToggleProps> = ({
  isVoiceMode,
  onToggle,
  disabled = false,
  className = ''
}) => {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`voice-mode-toggle ${isVoiceMode ? 'voice-active' : 'text-active'} ${className}`}
      title={isVoiceMode ? 'Switch to text input' : 'Switch to voice input'}
      aria-label={isVoiceMode ? 'Switch to text input' : 'Switch to voice input'}
    >
      <div className="toggle-slider">
        <div className="toggle-icons">
          <div className={`icon-container ${!isVoiceMode ? 'active' : ''}`}>
            <Keyboard size={14} />
          </div>
          <div className={`icon-container ${isVoiceMode ? 'active' : ''}`}>
            <Mic size={14} />
          </div>
        </div>
        <div className={`toggle-thumb ${isVoiceMode ? 'voice' : 'text'}`} />
      </div>
      <span className="toggle-label">
        {isVoiceMode ? 'Voice' : 'Text'}
      </span>
    </button>
  )
}

export default VoiceModeToggle
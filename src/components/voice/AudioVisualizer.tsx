import React, { useEffect, useRef } from 'react'

interface AudioVisualizerProps {
  isActive: boolean
  audioLevel?: number
  className?: string
  width?: number
  height?: number
  barCount?: number
  color?: string
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({

  isActive,
  audioLevel = 0,
  className = '',
  width = 120,
  height = 40,
  barCount = 8,
  color = '#6c5ce7'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)

  const barsRef = useRef<number[]>(new Array(barCount).fill(0))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = width
    canvas.height = height

    const animate = () => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height)

      if (isActive) {
        // Update bars with audio level and some randomness
        barsRef.current = barsRef.current.map((bar, index) => {
          const targetHeight = audioLevel > 0 
            ? (audioLevel * height * 0.8) + (Math.random() * height * 0.2)
            : Math.random() * height * 0.3

          // Smooth animation
          return bar + (targetHeight - bar) * 0.1
        })
      } else {
        // Fade out bars
        barsRef.current = barsRef.current.map(bar => bar * 0.9)
      }

      // Draw bars
      const barWidth = width / barCount
      const barSpacing = barWidth * 0.2

      barsRef.current.forEach((barHeight, index) => {
        const x = index * barWidth + barSpacing / 2
        const y = height - barHeight
        const w = barWidth - barSpacing

        // Create gradient
        const gradient = ctx.createLinearGradient(0, height, 0, 0)
        gradient.addColorStop(0, color + '80') // Semi-transparent
        gradient.addColorStop(1, color)

        ctx.fillStyle = gradient
        ctx.fillRect(x, y, w, barHeight)
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isActive, audioLevel, width, height, barCount, color])

  return (
    <div className={`audio-visualizer ${className}`}>
      <canvas
        ref={canvasRef}
        className="visualizer-canvas"
        style={{ width, height }}
      />
      {!isActive && (
        <div className="visualizer-overlay">
          <div className="visualizer-dots">
            <div className="dot" />
            <div className="dot" />
            <div className="dot" />
          </div>
        </div>
      )}
    </div>
  )
}

export default AudioVisualizer
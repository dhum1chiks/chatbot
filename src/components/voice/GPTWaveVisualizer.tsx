import React, { useEffect, useRef } from 'react'

interface GPTWaveVisualizerProps {
  isActive: boolean
  analyser: AnalyserNode | null
  color?: string
  className?: string
  width?: number
  height?: number
  waveCount?: number
}

const GPTWaveVisualizer: React.FC<GPTWaveVisualizerProps> = ({
  isActive,
  analyser,
  color = '#6c5ce7',
  className = '',
  width = 200,
  height = 60,
  waveCount = 3
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  
  // Phase for each wave to create movement
  const phases = useRef<number[]>(new Array(waveCount).fill(0).map((_, i) => i * (Math.PI / waveCount)))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = width
    canvas.height = height

    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null

    const drawWave = (
      ctx: CanvasRenderingContext2D, 
      phase: number, 
      amplitude: number, 
      frequency: number, 
      opacity: number,
      waveIndex: number
    ) => {
      ctx.beginPath()
      ctx.lineWidth = 2
      ctx.strokeStyle = `${color}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`
      
      const midY = height / 2
      
      for (let x = 0; x <= width; x++) {
        // Create a sine wave that is pinched at both ends (Siri style)
        const normalizedX = x / width
        const envelope = Math.sin(normalizedX * Math.PI) // Peak in middle
        
        // Multi-frequency oscillation for organic feel
        const y = midY + Math.sin(x * frequency + phase) * amplitude * envelope
        
        if (x === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      
      ctx.stroke()
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      let intensity = 0
      if (isActive && analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray)
        // Calculate average volume from frequency data
        const sum = dataArray.reduce((a, b) => a + b, 0)
        intensity = sum / dataArray.length / 255
      }

      // Ensure waves never completely stop for "breathing" effect
      const baselineIntensity = 0.05
      const activeIntensity = Math.max(baselineIntensity, intensity)

      // Draw multiple layers of waves
      phases.current = phases.current.map((phase, i) => {
        const speed = 0.05 + (i * 0.02)
        const amplitude = (height / 2.5) * activeIntensity * (1 - i / 5)
        const frequency = 0.02 + (i * 0.01)
        const opacity = isActive ? (0.8 - i * 0.2) : (0.2 - i * 0.05)
        
        drawWave(ctx, phase, amplitude, frequency, opacity, i)
        
        return phase + speed * (isActive ? 1.5 : 0.5)
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isActive, analyser, width, height, waveCount, color])

  return (
    <div className={`gpt-wave-visualizer ${className}`}>
      <canvas
        ref={canvasRef}
        className="wave-canvas"
        style={{ width, height, filter: 'blur(0.5px)' }}
      />
    </div>
  )
}

export default GPTWaveVisualizer

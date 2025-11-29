import { useState, useCallback, useMemo, useRef } from 'react'
import './App.css'

const SAMPLE_RATE = 44100; // CD quality
const CHANNELS = 1; // Mono
const MIN_DURATION_MINUTES = 1
const MAX_DURATION_MINUTES = 120 // 2 hours (practical browser memory limit)
const DEFAULT_DURATION_MINUTES = 5

// Utility function to format duration
const formatDuration = (minutes) => {
  if (minutes < 60) {
    return `${minutes.toFixed(minutes < 10 ? 1 : 0)} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (mins === 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }
  return `${hours}h ${mins}m`
}

// Utility function to format filename
const formatFilename = (noiseType, minutes) => {
  const duration = formatDuration(minutes).replace(/\s+/g, '-').toLowerCase()
  return `${noiseType}-noise-${duration}.wav`
}

function App() {
  const [noiseType, setNoiseType] = useState('brown')
  const [duration, setDuration] = useState(DEFAULT_DURATION_MINUTES)
  const [isGenerating, setIsGenerating] = useState(false)
  const [status, setStatus] = useState({ message: '', type: '' })
  const sliderSoundTimeoutRef = useRef(null)
  const lastPlayedValueRef = useRef(null)
  const audioContextRef = useRef(null)

  // Get or create a shared AudioContext
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    // Resume if suspended (browsers suspend AudioContext until user interaction)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume()
    }
    return audioContextRef.current
  }, [])

  const showStatus = useCallback((message, type) => {
    setStatus({ message, type })
    if (type === 'success') {
      setTimeout(() => {
        setStatus({ message: '', type: '' })
      }, 5000)
    }
  }, [])

  // Sound effects using Web Audio API
  const playHoverSound = useCallback(() => {
    try {
      const audioContext = getAudioContext()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 400
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.1)
    } catch (error) {
      // Silently fail if audio context is not available
    }
  }, [getAudioContext])

  const playSelectSound = useCallback(() => {
    try {
      const audioContext = getAudioContext()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      // Two-tone sound for selection
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.05)
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.15)
    } catch (error) {
      // Silently fail if audio context is not available
    }
  }, [getAudioContext])

  // Slider sound effect - pitch changes based on position
  const playSliderSound = useCallback((value) => {
    // Don't play if we've already played for this exact value
    if (lastPlayedValueRef.current === value) {
      return
    }
    
    // Clear any pending timeout
    if (sliderSoundTimeoutRef.current) {
      clearTimeout(sliderSoundTimeoutRef.current)
    }
    
    // Mark this value as played immediately to prevent duplicate plays
    lastPlayedValueRef.current = value
    
    // Use a very short delay to ensure the sound plays even with rapid movements
    sliderSoundTimeoutRef.current = setTimeout(() => {
      try {
        const audioContext = getAudioContext()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        // Calculate frequency based on slider position (300Hz to 800Hz)
        const minFreq = 300
        const maxFreq = 800
        const normalizedValue = (value - MIN_DURATION_MINUTES) / (MAX_DURATION_MINUTES - MIN_DURATION_MINUTES)
        const frequency = minFreq + (maxFreq - minFreq) * normalizedValue
        
        oscillator.frequency.value = frequency
        oscillator.type = 'sine'
        
        // Short, satisfying sound with quick fade
        gainNode.gain.setValueAtTime(0.12, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08)
        
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.08)
      } catch (error) {
        // Silently fail if audio context is not available
      }
    }, 10) // Reduced delay to ensure sounds play
  }, [getAudioContext])

  const handleDurationChange = useCallback((e) => {
    const newValue = parseFloat(e.target.value)
    setDuration(newValue)
    // Only play sound for values that are multiples of 5 minutes
    if (newValue % 5 === 0) {
      playSliderSound(newValue)
    }
  }, [playSliderSound])

  // White Noise: Equal energy per frequency (flat spectrum)
  const generateWhiteNoise = useCallback((length) => {
    const samples = new Float32Array(length)
    for (let i = 0; i < length; i++) {
      samples[i] = (Math.random() * 2 - 1) * 0.5
    }
    return samples
  }, [])

  // Pink Noise: Equal energy per octave (1/f spectrum)
  const generatePinkNoise = useCallback((length, state = null) => {
    const samples = new Float32Array(length)
    let b0 = state?.b0 ?? 0
    let b1 = state?.b1 ?? 0
    let b2 = state?.b2 ?? 0
    let b3 = state?.b3 ?? 0
    let b4 = state?.b4 ?? 0
    let b5 = state?.b5 ?? 0
    let b6 = state?.b6 ?? 0
    
    for (let i = 0; i < length; i++) {
      const white = (Math.random() * 2 - 1) * 0.5
      
      // Paul Kellet's method for pink noise generation
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.96900 * b2 + white * 0.1538520
      b3 = 0.86650 * b3 + white * 0.3104856
      b4 = 0.55000 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.0168980
      
      samples[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
      samples[i] *= 0.11 // Scale to prevent clipping
      
      b6 = white * 0.115926
    }
    
    return { samples, state: { b0, b1, b2, b3, b4, b5, b6 } }
  }, [])

  // Brown Noise: More low-frequency emphasis (1/f² spectrum)
  const generateBrownNoise = useCallback((length, state = null) => {
    const samples = new Float32Array(length)
    let lastSample = state?.lastSample ?? 0
    
    for (let i = 0; i < length; i++) {
      const white = (Math.random() * 2 - 1) * 0.5
      // Integrate white noise to create brown noise
      lastSample = (lastSample + white * 0.02) * 0.99
      samples[i] = lastSample * 3.5 // Scale appropriately
    }
    
    return { samples, state: { lastSample } }
  }, [])

  // Blue Noise: High-frequency emphasis (f spectrum)
  const generateBlueNoise = useCallback((length, state = null) => {
    const samples = new Float32Array(length)
    let lastSample = state?.lastSample ?? 0
    
    for (let i = 0; i < length; i++) {
      const white = (Math.random() * 2 - 1) * 0.5
      // Differentiate white noise to create blue noise
      samples[i] = (white - lastSample) * 0.5
      lastSample = white
    }
    
    return { samples, state: { lastSample } }
  }, [])

  // Violet Noise: High-frequency emphasis (f² spectrum)
  const generateVioletNoise = useCallback((length, state = null) => {
    const samples = new Float32Array(length)
    let lastSample = state?.lastSample ?? 0
    let lastLastSample = state?.lastLastSample ?? 0
    
    for (let i = 0; i < length; i++) {
      const white = (Math.random() * 2 - 1) * 0.5
      // Double differentiation of white noise creates violet noise
      samples[i] = (white - 2 * lastSample + lastLastSample) * 0.3
      lastLastSample = lastSample
      lastSample = white
    }
    
    return { samples, state: { lastSample, lastLastSample } }
  }, [])

  // Grey Noise: Psychoacoustically equal loudness across frequencies
  const generateGreyNoise = useCallback((length) => {
    const samples = new Float32Array(length)
    
    // Grey noise uses frequency-dependent filtering to achieve equal perceived loudness
    // This is a simplified approximation using multiple filtered noise bands
    for (let i = 0; i < length; i++) {
      const white = (Math.random() * 2 - 1) * 0.5
      
      // Apply psychoacoustic weighting (simplified A-weighting approximation)
      // Mix with pink noise characteristics for better psychoacoustic balance
      const pinkComponent = white * 0.7
      samples[i] = pinkComponent * 0.6
    }
    
    // Apply additional filtering to approximate grey noise characteristics
    // This is a simplified version - true grey noise requires complex filtering
    const filtered = new Float32Array(length)
    let state1 = 0, state2 = 0
    
    for (let i = 0; i < length; i++) {
      // Multi-band filtering approximation
      state1 = state1 * 0.99 + samples[i] * 0.01
      state2 = state2 * 0.95 + samples[i] * 0.05
      filtered[i] = (state1 * 0.4 + state2 * 0.3 + samples[i] * 0.3) * 1.2
    }
    
    return filtered
  }, [])

  // Orange Noise: Between pink and brown (1/f^1.5 spectrum)
  const generateOrangeNoise = useCallback((length, state = null) => {
    const samples = new Float32Array(length)
    let lastSample = state?.lastSample ?? 0
    let filterState = state?.filterState ?? 0
    
    for (let i = 0; i < length; i++) {
      const white = (Math.random() * 2 - 1) * 0.5
      
      // Partial integration (between pink and brown)
      // This creates a 1/f^1.5 spectrum
      filterState = filterState * 0.992 + white * 0.008
      lastSample = (lastSample + filterState * 0.015) * 0.995
      
      samples[i] = lastSample * 2.8
    }
    
    return { samples, state: { lastSample, filterState } }
  }, [])

  // Normalize samples to prevent clipping
  const normalizeSamples = useCallback((samples) => {
    let max = 0
    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i])
      if (abs > max) max = abs
    }
    
    if (max > 0.99) {
      const scale = 0.99 / max
      for (let i = 0; i < samples.length; i++) {
        samples[i] *= scale
      }
    }
    
    return samples
  }, [])

  // Create WAV file from samples
  const createWavFile = useCallback((samples, sampleRate) => {
    const length = samples.length
    const buffer = new ArrayBuffer(44 + length * 2)
    const view = new DataView(buffer)
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }
    
    // RIFF header
    writeString(0, 'RIFF')
    view.setUint32(4, 36 + length * 2, true)
    writeString(8, 'WAVE')
    
    // fmt chunk
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true) // chunk size
    view.setUint16(20, 1, true) // audio format (PCM)
    view.setUint16(22, CHANNELS, true) // number of channels
    view.setUint32(24, sampleRate, true) // sample rate
    view.setUint32(28, sampleRate * CHANNELS * 2, true) // byte rate
    view.setUint16(32, CHANNELS * 2, true) // block align
    view.setUint16(34, 16, true) // bits per sample
    
    // data chunk
    writeString(36, 'data')
    view.setUint32(40, length * 2, true)
    
    // Convert float samples to 16-bit PCM
    let offset = 44
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]))
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
      view.setInt16(offset, intSample, true)
      offset += 2
    }
    
    return new Blob([buffer], { type: 'audio/wav' })
  }, [])

  // Download file
  const downloadFile = useCallback((blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  const generateNoise = useCallback(async () => {
    const durationSeconds = duration * 60
    const totalSamples = Math.floor(SAMPLE_RATE * durationSeconds)

    // Show loading state
    setIsGenerating(true)
    showStatus(`Generating high-quality ${noiseType} noise (${formatDuration(duration)})...`, 'info')

    try {
      // Generate noise samples in chunks for better performance on long durations
      const CHUNK_SIZE = 441000 // 10 seconds worth of samples
      const chunks = Math.ceil(totalSamples / CHUNK_SIZE)
      const samples = new Float32Array(totalSamples)
      
      let state = null
      
      // Generate in chunks to allow UI updates for long durations
      for (let chunk = 0; chunk < chunks; chunk++) {
        const start = chunk * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, totalSamples)
        const chunkLength = end - start
        let chunkSamples
        
        // Generate noise based on type
        switch (noiseType) {
          case 'white':
            chunkSamples = generateWhiteNoise(chunkLength)
            break
          case 'pink': {
            const result = generatePinkNoise(chunkLength, state)
            chunkSamples = result.samples
            state = result.state
            break
          }
          case 'brown': {
            const result = generateBrownNoise(chunkLength, state)
            chunkSamples = result.samples
            state = result.state
            break
          }
          case 'blue': {
            const result = generateBlueNoise(chunkLength, state)
            chunkSamples = result.samples
            state = result.state
            break
          }
          case 'violet': {
            const result = generateVioletNoise(chunkLength, state)
            chunkSamples = result.samples
            state = result.state
            break
          }
          case 'grey':
            chunkSamples = generateGreyNoise(chunkLength)
            break
          case 'orange': {
            const result = generateOrangeNoise(chunkLength, state)
            chunkSamples = result.samples
            state = result.state
            break
          }
          default:
            throw new Error('Unknown noise type')
        }
        
        samples.set(chunkSamples, start)
        
        // Update status for very long generations
        if (chunks > 10 && chunk % Math.floor(chunks / 10) === 0) {
          const progress = Math.round((chunk / chunks) * 100)
          showStatus(`Generating... ${progress}%`, 'info')
        }
      }

      // Normalize samples to prevent clipping
      const normalizedSamples = normalizeSamples(samples)

      // Convert to WAV and download
      const wavBlob = createWavFile(normalizedSamples, SAMPLE_RATE)
      downloadFile(wavBlob, formatFilename(noiseType, duration))

      showStatus(`✅ Successfully generated and downloaded ${noiseType} noise (${formatDuration(duration)})!`, 'success')
    } catch (error) {
      console.error('Error generating noise:', error)
      showStatus(`❌ Error: ${error.message}`, 'error')
    } finally {
      setIsGenerating(false)
    }
   }, [duration, noiseType, generateWhiteNoise, generatePinkNoise, generateBrownNoise, generateBlueNoise, generateVioletNoise, generateGreyNoise, generateOrangeNoise, normalizeSamples, createWavFile, downloadFile, showStatus])

  // Calculate slider percentage for visual feedback
  const sliderPercentage = useMemo(() => {
    return ((duration - MIN_DURATION_MINUTES) / (MAX_DURATION_MINUTES - MIN_DURATION_MINUTES)) * 100
  }, [duration])

  // Format duration for display
  const formattedDuration = useMemo(() => formatDuration(duration), [duration])

  return (
    <div className="container">
      <div className="card">
        <h1>🎵 Noise Generator</h1>
        <p className="subtitle">Generate high-quality noise audio files</p>
        
        <div className="noise-selection">
          <h2>Select Noise Type</h2>
          <div className="checkbox-group">
            <label 
              className={`checkbox-label ${noiseType === 'brown' ? 'checked' : ''}`}
              onMouseEnter={playHoverSound}
            >
              <input 
                type="radio" 
                name="noiseType" 
                value="brown"
                checked={noiseType === 'brown'}
                onChange={(e) => {
                  setNoiseType(e.target.value)
                  playSelectSound()
                }}
              />
              <span className="checkbox-custom"></span>
              <span className="checkbox-text">Brown Noise</span>
            </label>
            <label 
              className={`checkbox-label ${noiseType === 'white' ? 'checked' : ''}`}
              onMouseEnter={playHoverSound}
            >
              <input 
                type="radio" 
                name="noiseType" 
                value="white"
                checked={noiseType === 'white'}
                onChange={(e) => {
                  setNoiseType(e.target.value)
                  playSelectSound()
                }}
              />
              <span className="checkbox-custom"></span>
              <span className="checkbox-text">White Noise</span>
            </label>
            <label 
              className={`checkbox-label ${noiseType === 'pink' ? 'checked' : ''}`}
              onMouseEnter={playHoverSound}
            >
              <input 
                type="radio" 
                name="noiseType" 
                value="pink"
                checked={noiseType === 'pink'}
                onChange={(e) => {
                  setNoiseType(e.target.value)
                  playSelectSound()
                }}
              />
              <span className="checkbox-custom"></span>
              <span className="checkbox-text">Pink Noise</span>
            </label>
            <label 
              className={`checkbox-label ${noiseType === 'blue' ? 'checked' : ''}`}
              onMouseEnter={playHoverSound}
            >
              <input 
                type="radio" 
                name="noiseType" 
                value="blue"
                checked={noiseType === 'blue'}
                onChange={(e) => {
                  setNoiseType(e.target.value)
                  playSelectSound()
                }}
              />
              <span className="checkbox-custom"></span>
              <span className="checkbox-text">Blue Noise</span>
            </label>
            <label 
              className={`checkbox-label ${noiseType === 'violet' ? 'checked' : ''}`}
              onMouseEnter={playHoverSound}
            >
              <input 
                type="radio" 
                name="noiseType" 
                value="violet"
                checked={noiseType === 'violet'}
                onChange={(e) => {
                  setNoiseType(e.target.value)
                  playSelectSound()
                }}
              />
              <span className="checkbox-custom"></span>
              <span className="checkbox-text">💜 Violet Noise</span>
            </label>
            <label 
              className={`checkbox-label ${noiseType === 'grey' ? 'checked' : ''}`}
              onMouseEnter={playHoverSound}
            >
              <input 
                type="radio" 
                name="noiseType" 
                value="grey"
                checked={noiseType === 'grey'}
                onChange={(e) => {
                  setNoiseType(e.target.value)
                  playSelectSound()
                }}
              />
              <span className="checkbox-custom"></span>
              <span className="checkbox-text">⚪ Grey Noise</span>
            </label>
            <label 
              className={`checkbox-label ${noiseType === 'orange' ? 'checked' : ''}`}
              onMouseEnter={playHoverSound}
            >
              <input 
                type="radio" 
                name="noiseType" 
                value="orange"
                checked={noiseType === 'orange'}
                onChange={(e) => {
                  setNoiseType(e.target.value)
                  playSelectSound()
                }}
              />
              <span className="checkbox-custom"></span>
              <span className="checkbox-text">🧡 Orange Noise</span>
            </label>
          </div>
        </div>

        <div className="duration-selection">
          <h2>Duration</h2>
          <div className="slider-container">
            <div className="slider-wrapper">
              <input 
                type="range" 
                id="durationSlider" 
                className="duration-slider"
                min={MIN_DURATION_MINUTES} 
                max={MAX_DURATION_MINUTES} 
                value={duration} 
                step="1"
                onChange={handleDurationChange}
                style={{
                  background: `linear-gradient(to right, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.6) ${sliderPercentage}%, rgba(255, 255, 255, 0.1) ${sliderPercentage}%, rgba(255, 255, 255, 0.1) 100%)`
                }}
              />
            </div>
            <div className="slider-labels">
              <span>{formatDuration(MIN_DURATION_MINUTES)}</span>
              <span className="duration-value">{formattedDuration}</span>
              <span>{formatDuration(MAX_DURATION_MINUTES)}</span>
            </div>
            <div className="slider-presets">
              <button 
                type="button"
                className="preset-btn"
                onClick={() => setDuration(5)}
                onMouseEnter={playHoverSound}
                disabled={isGenerating}
              >
                5 min
              </button>
              <button 
                type="button"
                className="preset-btn"
                onClick={() => setDuration(30)}
                onMouseEnter={playHoverSound}
                disabled={isGenerating}
              >
                30 min
              </button>
              <button 
                type="button"
                className="preset-btn"
                onClick={() => setDuration(60)}
                onMouseEnter={playHoverSound}
                disabled={isGenerating}
              >
                1 hour
              </button>
              <button 
                type="button"
                className="preset-btn"
                onClick={() => setDuration(120)}
                onMouseEnter={playHoverSound}
                disabled={isGenerating}
              >
                2 hours
              </button>
            </div>
          </div>
        </div>

        <button 
          id="generateBtn" 
          className="generate-btn"
          onClick={generateNoise}
          disabled={isGenerating}
        >
          <span className="btn-text">{isGenerating ? 'Generating...' : 'Generate'}</span>
          {isGenerating && <span className="btn-loader"></span>}
        </button>

        <a
          href="https://buymeacoffee.com/nickzaleski"
          target="_blank"
          rel="noopener noreferrer"
          className="donate-btn"
          onMouseEnter={playHoverSound}
        >
          ☕ Buy Me a Coffee
        </a>

        {status.message && (
          <div className={`status-message show ${status.type}`}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  )
}

export default App


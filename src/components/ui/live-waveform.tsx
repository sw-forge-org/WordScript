/* Vendored from ElevenLabs UI — https://github.com/elevenlabs/ui (MIT).
 * Source: apps/www/registry/elevenlabs-ui/ui/live-waveform.tsx @ 6e5b681c01ee
 * Fetched 2026-08-03. ui.elevenlabs.io serves a Vercel bot check (HTTP 429),
 * so the registry CLI cannot reach it; the repository is the source of record.
 * Local changes are marked WORDSCRIPT.
 *
 * ONE DEVIATION, and a re-sync has to carry it forward:
 *
 * 1. `externalLevel` — a 0..1 level the component did not measure itself, in
 *    place of the microphone upstream opens. Every upstream path is untouched
 *    when it is null, which is its default. */
"use client"

import { useEffect, useRef, type HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

export type LiveWaveformProps = HTMLAttributes<HTMLDivElement> & {
  active?: boolean
  processing?: boolean
  deviceId?: string
  /* WORDSCRIPT — DEVIATION 1: A LEVEL THIS COMPONENT DID NOT MEASURE ITSELF.
   *
   * Upstream has exactly one source of audio: `active` opens the microphone
   * through `getUserMedia` and an `AnalyserNode`. In this product the runtime
   * already owns the microphone — a capture emits `audio_level`, and
   * `core::input_monitor` emits `input_monitor_level` when no capture is
   * running — so a second opener in the webview would be a second application
   * holding the same device, which is what ADR 0063's call detection watches
   * for.
   *
   * Pass a 0..1 level here and the drawing runs off it instead: no
   * `getUserMedia`, no `AudioContext`, upstream's geometry and upstream's
   * scrolling mode unchanged. `null` or omitted leaves every upstream path
   * exactly as it was.
   *
   * THE SCALE IS THE CALLER'S. What counts as a full-height bar is a product
   * decision about a microphone, not a fact about drawing, so this takes a
   * number that is already normalised.
   *
   * A REF AND NOT A VALUE, and this is the part that decides the frame rate.
   * The runtime reports twenty-four times a second; passing that as a prop
   * re-renders the tree that owns this canvas twenty-four times a second, and
   * on a settings screen that is enough layout work to lose animation frames —
   * measured as a visibly stuttering trace. A ref is read inside the animation
   * loop and renders nothing. */
  externalLevel?: { current: number } | null
  barWidth?: number
  barHeight?: number
  barGap?: number
  barRadius?: number
  barColor?: string
  fadeEdges?: boolean
  fadeWidth?: number
  height?: string | number
  sensitivity?: number
  smoothingTimeConstant?: number
  fftSize?: number
  historySize?: number
  updateRate?: number
  mode?: "scrolling" | "static"
  onError?: (error: Error) => void
  onStreamReady?: (stream: MediaStream) => void
  onStreamEnd?: () => void
}

export const LiveWaveform = ({
  active = false,
  processing = false,
  deviceId,
  externalLevel = null,
  barWidth = 3,
  barGap = 1,
  barRadius = 1.5,
  barColor,
  fadeEdges = true,
  fadeWidth = 24,
  barHeight: baseBarHeight = 4,
  height = 64,
  sensitivity = 1,
  smoothingTimeConstant = 0.8,
  fftSize = 256,
  historySize = 60,
  updateRate = 30,
  mode = "static",
  onError,
  onStreamReady,
  onStreamEnd,
  className,
  ...props
}: LiveWaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<number[]>([])
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number>(0)
  const lastUpdateRef = useRef<number>(0)
  const processingAnimationRef = useRef<number | null>(null)
  const lastActiveDataRef = useRef<number[]>([])
  const transitionProgressRef = useRef(0)
  const staticBarsRef = useRef<number[]>([])
  const needsRedrawRef = useRef(true)
  const gradientCacheRef = useRef<CanvasGradient | null>(null)
  const lastWidthRef = useRef(0)
  /* WORDSCRIPT — deviation 1. The level arrives at the runtime's cadence
   * (42 ms) and the drawing runs at the display's, so the animation loop reads
   * the latest value from the caller's ref rather than from a prop that would
   * re-render this tree twenty-four times a second. */
  const envelopeRef = useRef(0)
  const lastFrameRef = useRef(0)

  const driven = externalLevel !== null && externalLevel !== undefined

  const heightStyle = typeof height === "number" ? `${height}px` : height

  // Handle canvas resizing
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1

      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`

      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.scale(dpr, dpr)
      }

      gradientCacheRef.current = null
      lastWidthRef.current = rect.width
      needsRedrawRef.current = true
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (processing && !active) {
      let time = 0
      transitionProgressRef.current = 0

      const animateProcessing = () => {
        time += 0.03
        transitionProgressRef.current = Math.min(
          1,
          transitionProgressRef.current + 0.02
        )

        const processingData = []
        const barCount = Math.floor(
          (containerRef.current?.getBoundingClientRect().width || 200) /
            (barWidth + barGap)
        )

        if (mode === "static") {
          const halfCount = Math.floor(barCount / 2)

          for (let i = 0; i < barCount; i++) {
            const normalizedPosition = (i - halfCount) / halfCount
            const centerWeight = 1 - Math.abs(normalizedPosition) * 0.4

            const wave1 = Math.sin(time * 1.5 + normalizedPosition * 3) * 0.25
            const wave2 = Math.sin(time * 0.8 - normalizedPosition * 2) * 0.2
            const wave3 = Math.cos(time * 2 + normalizedPosition) * 0.15
            const combinedWave = wave1 + wave2 + wave3
            const processingValue = (0.2 + combinedWave) * centerWeight

            let finalValue = processingValue
            if (
              lastActiveDataRef.current.length > 0 &&
              transitionProgressRef.current < 1
            ) {
              const lastDataIndex = Math.min(
                i,
                lastActiveDataRef.current.length - 1
              )
              const lastValue = lastActiveDataRef.current[lastDataIndex] || 0
              finalValue =
                lastValue * (1 - transitionProgressRef.current) +
                processingValue * transitionProgressRef.current
            }

            processingData.push(Math.max(0.05, Math.min(1, finalValue)))
          }
        } else {
          for (let i = 0; i < barCount; i++) {
            const normalizedPosition = (i - barCount / 2) / (barCount / 2)
            const centerWeight = 1 - Math.abs(normalizedPosition) * 0.4

            const wave1 = Math.sin(time * 1.5 + i * 0.15) * 0.25
            const wave2 = Math.sin(time * 0.8 - i * 0.1) * 0.2
            const wave3 = Math.cos(time * 2 + i * 0.05) * 0.15
            const combinedWave = wave1 + wave2 + wave3
            const processingValue = (0.2 + combinedWave) * centerWeight

            let finalValue = processingValue
            if (
              lastActiveDataRef.current.length > 0 &&
              transitionProgressRef.current < 1
            ) {
              const lastDataIndex = Math.floor(
                (i / barCount) * lastActiveDataRef.current.length
              )
              const lastValue = lastActiveDataRef.current[lastDataIndex] || 0
              finalValue =
                lastValue * (1 - transitionProgressRef.current) +
                processingValue * transitionProgressRef.current
            }

            processingData.push(Math.max(0.05, Math.min(1, finalValue)))
          }
        }

        if (mode === "static") {
          staticBarsRef.current = processingData
        } else {
          historyRef.current = processingData
        }

        needsRedrawRef.current = true
        processingAnimationRef.current =
          requestAnimationFrame(animateProcessing)
      }

      animateProcessing()

      return () => {
        if (processingAnimationRef.current) {
          cancelAnimationFrame(processingAnimationRef.current)
        }
      }
    } else if (!active && !processing) {
      const hasData =
        mode === "static"
          ? staticBarsRef.current.length > 0
          : historyRef.current.length > 0

      if (hasData) {
        let fadeProgress = 0
        const fadeToIdle = () => {
          fadeProgress += 0.03
          if (fadeProgress < 1) {
            if (mode === "static") {
              staticBarsRef.current = staticBarsRef.current.map(
                (value) => value * (1 - fadeProgress)
              )
            } else {
              historyRef.current = historyRef.current.map(
                (value) => value * (1 - fadeProgress)
              )
            }
            needsRedrawRef.current = true
            requestAnimationFrame(fadeToIdle)
          } else {
            if (mode === "static") {
              staticBarsRef.current = []
            } else {
              historyRef.current = []
            }
          }
        }
        fadeToIdle()
      }
    }
  }, [processing, active, barWidth, barGap, mode])

  // Handle microphone setup and teardown
  useEffect(() => {
    // WORDSCRIPT — deviation 1: a driven waveform never opens a device, even if
    // a caller sets `active` as well. There is one microphone owner and it is
    // the runtime.
    if (!active || driven) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        onStreamEnd?.()
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = 0
      }
      return
    }

    const setupMicrophone = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId
            ? {
                deviceId: { exact: deviceId },
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              }
            : {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
        })
        streamRef.current = stream
        onStreamReady?.(stream)

        const AudioContextConstructor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        const audioContext = new AudioContextConstructor()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = fftSize
        analyser.smoothingTimeConstant = smoothingTimeConstant

        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)

        audioContextRef.current = audioContext
        analyserRef.current = analyser

        // Clear history when starting
        historyRef.current = []
      } catch (error) {
        onError?.(error as Error)
      }
    }

    setupMicrophone()

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        onStreamEnd?.()
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = 0
      }
    }
  }, [
    active,
    driven,
    deviceId,
    fftSize,
    smoothingTimeConstant,
    onError,
    onStreamReady,
    onStreamEnd,
  ])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let rafId: number

    const animate = (currentTime: number) => {
      // Render waveform
      const rect = canvas.getBoundingClientRect()

      /* WORDSCRIPT — deviation 1: the driven path, in place of the analyser.
       *
       * ONE BAR PER FRAME, not one per event. The runtime reports every 42 ms
       * and the display refreshes about every 16, so pushing the raw reading
       * would repeat each value two or three times and the trace would climb in
       * visible steps. What is drawn instead is an envelope that follows the
       * reading: fast to rise so a syllable is not softened away, slower to
       * fall so the shape of a phrase stays readable. It is a meter's
       * ballistics, not invented signal — the envelope can only ever go where
       * the measurement takes it.
       *
       * dt-CORRECT for the same reason the prototype's is: a dropped frame must
       * not produce a jump. */
      if (driven) {
        const previous = lastFrameRef.current || currentTime
        const dt = Math.min(Math.max(currentTime - previous, 0), 100)
        lastFrameRef.current = currentTime

        const target = Math.min(Math.max(externalLevel?.current ?? 0, 0), 1)
        const tau = target > envelopeRef.current ? 45 : 180
        envelopeRef.current +=
          (target - envelopeRef.current) * (1 - Math.exp(-dt / tau))
        if (envelopeRef.current < 0.001) envelopeRef.current = 0

        historyRef.current.push(envelopeRef.current)

        /* Trimmed to what is on screen rather than to `historySize`: at this
         * row's width the canvas holds around 150 bars and upstream's default
         * of 60 would leave the left two thirds permanently empty. */
        const slots = Math.max(1, Math.floor(rect.width / (barWidth + barGap)))
        while (historyRef.current.length > slots) historyRef.current.shift()

        needsRedrawRef.current = true
      }

      // Update audio data if active
      if (active && !driven && currentTime - lastUpdateRef.current > updateRate) {
        lastUpdateRef.current = currentTime

        if (analyserRef.current) {
          const dataArray = new Uint8Array(
            analyserRef.current.frequencyBinCount
          )
          analyserRef.current.getByteFrequencyData(dataArray)

          if (mode === "static") {
            // For static mode, update bars in place
            const startFreq = Math.floor(dataArray.length * 0.05)
            const endFreq = Math.floor(dataArray.length * 0.4)
            const relevantData = dataArray.slice(startFreq, endFreq)

            const barCount = Math.floor(rect.width / (barWidth + barGap))
            const halfCount = Math.floor(barCount / 2)
            const newBars: number[] = []

            // Mirror the data for symmetric display
            for (let i = halfCount - 1; i >= 0; i--) {
              const dataIndex = Math.floor(
                (i / halfCount) * relevantData.length
              )
              const value = Math.min(
                1,
                (relevantData[dataIndex] / 255) * sensitivity
              )
              newBars.push(Math.max(0.05, value))
            }

            for (let i = 0; i < halfCount; i++) {
              const dataIndex = Math.floor(
                (i / halfCount) * relevantData.length
              )
              const value = Math.min(
                1,
                (relevantData[dataIndex] / 255) * sensitivity
              )
              newBars.push(Math.max(0.05, value))
            }

            staticBarsRef.current = newBars
            lastActiveDataRef.current = newBars
          } else {
            // Scrolling mode - original behavior
            let sum = 0
            const startFreq = Math.floor(dataArray.length * 0.05)
            const endFreq = Math.floor(dataArray.length * 0.4)
            const relevantData = dataArray.slice(startFreq, endFreq)

            for (let i = 0; i < relevantData.length; i++) {
              sum += relevantData[i]
            }
            const average = (sum / relevantData.length / 255) * sensitivity

            // Add to history
            historyRef.current.push(Math.min(1, Math.max(0.05, average)))
            lastActiveDataRef.current = [...historyRef.current]

            // Maintain history size
            if (historyRef.current.length > historySize) {
              historyRef.current.shift()
            }
          }
          needsRedrawRef.current = true
        }
      }

      // Only redraw if needed
      if (!needsRedrawRef.current && !active && !driven) {
        rafId = requestAnimationFrame(animate)
        return
      }

      needsRedrawRef.current = active || driven
      ctx.clearRect(0, 0, rect.width, rect.height)

      const computedBarColor =
        barColor ||
        (() => {
          const style = getComputedStyle(canvas)
          // Try to get the computed color value directly
          const color = style.color
          return color || "#000"
        })()

      const step = barWidth + barGap
      const barCount = Math.floor(rect.width / step)
      const centerY = rect.height / 2

      // Draw bars based on mode
      if (mode === "static") {
        // Static mode - bars in fixed positions
        const dataToRender = processing
          ? staticBarsRef.current
          : active
            ? staticBarsRef.current
            : staticBarsRef.current.length > 0
              ? staticBarsRef.current
              : []

        for (let i = 0; i < barCount && i < dataToRender.length; i++) {
          const value = dataToRender[i] || 0.1
          const x = i * step
          const barHeight = Math.max(baseBarHeight, value * rect.height * 0.8)
          const y = centerY - barHeight / 2

          ctx.fillStyle = computedBarColor
          ctx.globalAlpha = 0.4 + value * 0.6

          if (barRadius > 0) {
            ctx.beginPath()
            ctx.roundRect(x, y, barWidth, barHeight, barRadius)
            ctx.fill()
          } else {
            ctx.fillRect(x, y, barWidth, barHeight)
          }
        }
      } else {
        // Scrolling mode - original behavior
        for (let i = 0; i < barCount && i < historyRef.current.length; i++) {
          const dataIndex = historyRef.current.length - 1 - i
          const value = historyRef.current[dataIndex] || 0.1
          const x = rect.width - (i + 1) * step
          const barHeight = Math.max(baseBarHeight, value * rect.height * 0.8)
          const y = centerY - barHeight / 2

          ctx.fillStyle = computedBarColor
          ctx.globalAlpha = 0.4 + value * 0.6

          if (barRadius > 0) {
            ctx.beginPath()
            ctx.roundRect(x, y, barWidth, barHeight, barRadius)
            ctx.fill()
          } else {
            ctx.fillRect(x, y, barWidth, barHeight)
          }
        }
      }

      // Apply edge fading
      if (fadeEdges && fadeWidth > 0 && rect.width > 0) {
        // Cache gradient if width hasn't changed
        if (!gradientCacheRef.current || lastWidthRef.current !== rect.width) {
          const gradient = ctx.createLinearGradient(0, 0, rect.width, 0)
          const fadePercent = Math.min(0.3, fadeWidth / rect.width)

          // destination-out: removes destination where source alpha is high
          // We want: fade edges out, keep center solid
          // Left edge: start opaque (1) = remove, fade to transparent (0) = keep
          gradient.addColorStop(0, "rgba(255,255,255,1)")
          gradient.addColorStop(fadePercent, "rgba(255,255,255,0)")
          // Center stays transparent = keep everything
          gradient.addColorStop(1 - fadePercent, "rgba(255,255,255,0)")
          // Right edge: fade from transparent (0) = keep to opaque (1) = remove
          gradient.addColorStop(1, "rgba(255,255,255,1)")

          gradientCacheRef.current = gradient
          lastWidthRef.current = rect.width
        }

        ctx.globalCompositeOperation = "destination-out"
        ctx.fillStyle = gradientCacheRef.current
        ctx.fillRect(0, 0, rect.width, rect.height)
        ctx.globalCompositeOperation = "source-over"
      }

      ctx.globalAlpha = 1

      rafId = requestAnimationFrame(animate)
    }

    rafId = requestAnimationFrame(animate)

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [
    active,
    driven,
    externalLevel,
    processing,
    sensitivity,
    updateRate,
    historySize,
    barWidth,
    baseBarHeight,
    barGap,
    barRadius,
    barColor,
    fadeEdges,
    fadeWidth,
    mode,
  ])

  return (
    <div
      className={cn("relative h-full w-full", className)}
      ref={containerRef}
      style={{ height: heightStyle }}
      aria-label={
        active || driven
          ? "Live audio waveform"
          : processing
            ? "Processing audio"
            : "Audio waveform idle"
      }
      role="img"
      {...props}
    >
      {/* WORDSCRIPT — deviation 1: a driven waveform is drawing its own floor,
          so the dotted at-rest rule underneath it would be a second line. */}
      {!active && !driven && !processing && (
        <div className="border-muted-foreground/20 absolute top-1/2 right-0 left-0 -translate-y-1/2 border-t-2 border-dotted" />
      )}
      <canvas
        className="block h-full w-full"
        ref={canvasRef}
        aria-hidden="true"
      />
    </div>
  )
}

import { PplaParserService, PplaRendererService } from '@/lib/ppla-engine'
import { cn } from '@/lib/utils'
import { useEffect, useMemo, useRef, useState } from 'react'

interface CanvasProps {
  pplaCode: string
}

const LABEL_WIDTH = 520
const LABEL_HEIGHT = 280
const RENDER_SCALE_FACTOR = 2

export function Canvas({ pplaCode }: CanvasProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const canvasElementRef = useRef<HTMLCanvasElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom] = useState(1)
  const parser = useMemo(() => {
    return new PplaParserService({ normalizeLineEndings: true })
  }, [])
  const renderer = useMemo(() => {
    return new PplaRendererService({ dpi: 203, scaleFactor: RENDER_SCALE_FACTOR })
  }, [])

  useEffect(() => {
    const canvas = canvasElementRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const devicePixelRatio = window.devicePixelRatio || 1
    canvas.width = Math.floor(LABEL_WIDTH * devicePixelRatio)
    canvas.height = Math.floor(LABEL_HEIGHT * devicePixelRatio)
    canvas.style.width = `${LABEL_WIDTH}px`
    canvas.style.height = `${LABEL_HEIGHT}px`

    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    ctx.clearRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT)
    ctx.fillStyle = '#111827'

    const elements = parser.parse(pplaCode)
    renderer.render(elements, ctx)
  }, [parser, pplaCode, renderer])

  return (
    <div
      ref={canvasContainerRef}
      className="flex-1 relative overflow-hidden bg-[#1a1a1a]"
      style={{
        backgroundImage:
          'radial-gradient(circle, #3a3a3a 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
      onClick={() => setSelectedId(null)}
    >
      {/* Rulers - top */}
      <div className="absolute top-0 left-8 right-0 h-6 bg-[#252525] border-b border-[#3a3a3a] z-10 overflow-hidden">
        <svg width="100%" height="24" className="text-[#555]">
          {Array.from({ length: 60 }).map((_, i) => {
            const x = i * 50
            const isMajor = i % 2 === 0
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={isMajor ? 12 : 16}
                  x2={x}
                  y2={24}
                  stroke="#555"
                  strokeWidth="1"
                />
                {isMajor && (
                  <text
                    x={x + 3}
                    y={10}
                    fontSize="9"
                    fill="#666"
                    fontFamily="monospace"
                  >
                    {(i - 14) * 50}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Rulers - left */}
      <div className="absolute top-6 left-0 bottom-0 w-8 bg-[#252525] border-r border-[#3a3a3a] z-10">
        <svg height="100%" width="32">
          {Array.from({ length: 60 }).map((_, i) => {
            const y = i * 50
            const isMajor = i % 2 === 0
            return (
              <g key={i}>
                <line
                  x1={isMajor ? 12 : 16}
                  y1={y}
                  x2={32}
                  y2={y}
                  stroke="#555"
                  strokeWidth="1"
                />
                {isMajor && (
                  <text
                    x={10}
                    y={y + 3}
                    fontSize="9"
                    fill="#666"
                    fontFamily="monospace"
                    transform={`rotate(-90, 10, ${y + 3})`}
                  >
                    {(i - 6) * 50}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Canvas viewport */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ top: '24px', left: '32px' }}
      >
        <div
          className="relative"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
        >
          {/* Label canvas label */}
          <div className="absolute -top-6 left-0 text-xs text-[#666] whitespace-nowrap">
            Frame 1
          </div>

          {/* Label outer frame */}
          <div
            className="relative bg-[#f5f5f5] shadow-2xl"
            style={{ width: LABEL_WIDTH + 16, height: LABEL_HEIGHT + 16 }}
          >
            {/* "Frame 2" - label render surface */}
            <div
              className={cn(
                'absolute border-2 bg-white',
                selectedId === 'frame-2'
                  ? 'border-[#1971c2]'
                  : 'border-[#ff6b6b]',
              )}
              style={{ left: 8, top: 8, width: LABEL_WIDTH, height: LABEL_HEIGHT }}
              onClick={e => {
                e.stopPropagation()
                setSelectedId('frame-2')
              }}
            >
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-[#1971c2] text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap">
                PPLA Preview
              </div>

              <canvas
                ref={canvasElementRef}
                className="block h-full w-full bg-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

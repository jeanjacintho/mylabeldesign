import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface LabelElement {
  id: string
  x: number
  y: number
  width: number
  height: number
  selected?: boolean
}

const INITIAL_ELEMENTS: LabelElement[] = [
  { id: 'rect-1', x: 20, y: 50, width: 100, height: 100 },
  { id: 'rect-2', x: 150, y: 50, width: 100, height: 100 },
  { id: 'rect-3', x: 280, y: 50, width: 100, height: 100 },
]

const LABEL_WIDTH = 500
const LABEL_HEIGHT = 200

export function Canvas() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom] = useState(1)

  return (
    <div
      ref={canvasRef}
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
            style={{ width: LABEL_WIDTH, height: LABEL_HEIGHT + 80 }}
          >
            {/* "Frame 2" - inner frame with auto-layout */}
            <div
              className={cn(
                'absolute border-2 bg-white/50',
                selectedId === 'frame-2'
                  ? 'border-[#1971c2]'
                  : 'border-[#ff6b6b]',
              )}
              style={{ left: 8, top: 8, width: LABEL_WIDTH - 16, height: LABEL_HEIGHT }}
              onClick={e => {
                e.stopPropagation()
                setSelectedId('frame-2')
              }}
            >
              {/* "Hug x Hug" badge */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-[#1971c2] text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap">
                Hug × Hug
              </div>

              {/* Child rectangles */}
              <div className="flex items-center gap-3 p-4 h-full">
                {INITIAL_ELEMENTS.map(el => (
                  <div
                    key={el.id}
                    className={cn(
                      'flex-1 h-full bg-[#d4d4d4] border-2 border-transparent transition-colors rounded-sm cursor-pointer',
                      selectedId === el.id && 'border-[#1971c2]',
                    )}
                    onClick={e => {
                      e.stopPropagation()
                      setSelectedId(el.id)
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'

import type { ParsedLabelDocument } from '@openlabel/core'

interface CanvasProps {
  document: ParsedLabelDocument
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function Canvas({ document, selectedId, onSelect }: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const previewScale = useMemo(() => {
    const maxDimension = Math.max(document.canvas.widthDots, document.canvas.heightDots)
    return maxDimension > 980 ? 0.48 : 0.64
  }, [document.canvas.heightDots, document.canvas.widthDots])

  const labelWidth = document.canvas.widthDots * previewScale
  const labelHeight = document.canvas.heightDots * previewScale

  return (
    <div
      ref={canvasRef}
      className="flex-1 relative overflow-hidden bg-[#1a1a1a]"
      style={{
        backgroundImage:
          'radial-gradient(circle, #3a3a3a 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
      onClick={() => onSelect(null)}
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
        <div className="relative">
          {/* Label canvas label */}
          <div className="absolute -top-6 left-0 text-xs text-[#666] whitespace-nowrap">
            Etiqueta PPLA importada
          </div>

          {/* Label outer frame */}
          <div
            className="relative bg-[#f7f7f7] shadow-2xl ring-1 ring-black/10"
            style={{ width: labelWidth, height: labelHeight }}
          >
            {document.elements.map(element => (
              <div
                key={element.id}
                className={cn(
                  'absolute transition-shadow',
                  selectedId === element.id && 'shadow-[0_0_0_2px_#1971c2]',
                )}
                style={{
                  left: element.xDots * previewScale,
                  top: element.yDots * previewScale,
                  width: element.widthDots * previewScale,
                  minHeight: element.heightDots * previewScale,
                }}
                onClick={event => {
                  event.stopPropagation()
                  onSelect(element.id)
                }}
              >
                {element.kind === 'text' ? (
                  <div
                    className="rounded-sm border border-transparent px-1 py-0.5 font-mono text-[#171717]"
                    style={{
                      fontSize: Math.max(9, element.heightDots * previewScale * 0.55),
                      lineHeight: 1.1,
                      whiteSpace: 'nowrap',
                      writingMode: 'horizontal-tb',
                      transform: element.rotation ? `rotate(${element.rotation}deg)` : 'none',
                      transformOrigin: 'left top',
                    }}
                  >
                    {element.content}
                  </div>
                ) : (
                  <div className="rounded-sm border border-[#222] bg-white p-1">
                    <div
                      className="h-full min-h-8 w-full"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(90deg, #111 0 2px, transparent 2px 4px, #111 4px 5px, transparent 5px 8px)',
                      }}
                    />
                    <div className="mt-1 text-center text-[8px] font-semibold uppercase tracking-[0.15em] text-[#444]">
                      Barcode
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="absolute -bottom-8 left-0 text-[11px] text-[#7a7a7a]">
              {document.canvas.widthMm}mm x {document.canvas.heightMm}mm
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'
import JsBarcode from 'jsbarcode'

import type { ParsedLabelDocument } from '@openlabel/core'

interface CanvasProps {
  document: ParsedLabelDocument
  selectedId: string | null
  onSelect: (id: string | null) => void
  previewMode: 'pixel' | 'physical'
  zoomPercent: number
}

const RESIDENT_FONT_RENDER_METRICS: Record<string, {
  baseSizePx: number
  cssFamily: string
}> = {
  '0': { baseSizePx: 12, cssFamily: '"Courier New", monospace' },
  '1': { baseSizePx: 14, cssFamily: '"Courier New", monospace' },
  '2': { baseSizePx: 16, cssFamily: '"Courier New", monospace' },
  '3': { baseSizePx: 20, cssFamily: '"Courier New", monospace' },
  '4': { baseSizePx: 24, cssFamily: '"Courier New", monospace' },
  '5': { baseSizePx: 28, cssFamily: '"Courier New", monospace' },
  '6': { baseSizePx: 32, cssFamily: '"Courier New", monospace' },
  '7': { baseSizePx: 40, cssFamily: '"Courier New", monospace' },
  '8': { baseSizePx: 48, cssFamily: '"Courier New", monospace' },
}

function drawPseudoBarcode(
  context: CanvasRenderingContext2D,
  content: string,
  x: number,
  y: number,
  height: number,
  narrow: number,
  wide: number,
) {
  let cursor = x
  const safeNarrow = Math.max(1, narrow)
  const safeWide = Math.max(safeNarrow + 1, wide)

  for (const char of content) {
    const code = char.charCodeAt(0)

    for (let bit = 0; bit < 7; bit += 1) {
      const isWide = ((code >> bit) & 1) === 1
      const barWidth = isWide ? safeWide : safeNarrow

      context.fillRect(cursor, y, barWidth, height)
      cursor += barWidth + safeNarrow
    }

    cursor += safeWide
  }
}

function resolveBarcodeFormat(symbology: string) {
  const normalized = symbology.toUpperCase()

  if (normalized === 'A') return 'CODE39'
  if (normalized === 'B') return 'CODE128'
  if (normalized === 'C') return 'UPC'   // UPC-E
  if (normalized === 'E') return 'CODE128'
  if (normalized === 'F') return 'EAN13'
  if (normalized === 'G') return 'EAN8'
  if (normalized === 'I') return 'ITF'
  if (normalized === 'U') return 'CODE128'

  return 'CODE128'
}

function normalizeBarcodeData(format: string, rawValue: string) {
  const trimmed = rawValue.trim()
  const digitsOnly = trimmed.replace(/\D+/g, '')

  if (format === 'EAN13') {
    if (digitsOnly.length >= 12) {
      return digitsOnly.slice(0, 13)
    }

    return digitsOnly.padStart(12, '0')
  }

  if (format === 'UPC') {
    if (digitsOnly.length >= 11) {
      return digitsOnly.slice(0, 12)
    }

    return digitsOnly.padStart(11, '0')
  }

  if (format === 'ITF') {
    const candidate = digitsOnly.length > 0 ? digitsOnly : '00'
    return candidate.length % 2 === 0 ? candidate : `0${candidate}`
  }

  if (format === 'CODE39') {
    const allowed = trimmed.toUpperCase().replace(/[^0-9A-Z\-\.\$\/\+%\s]/g, '')
    return allowed || '0'
  }

  if (format === 'CODABAR') {
    const allowed = trimmed.toUpperCase().replace(/[^0-9\-\$:/.\+ABCD]/g, '')
    const base = allowed || 'A0A'
    const startsOk = /^[ABCD]/.test(base)
    const endsOk = /[ABCD]$/.test(base)
    const start = startsOk ? '' : 'A'
    const end = endsOk ? '' : 'A'
    return `${start}${base}${end}`
  }

  return trimmed || '0'
}

function drawLine(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  widthDots: number,
  heightDots: number,
) {
  context.fillStyle = '#111111'
  context.fillRect(x, y, widthDots, heightDots)
}

function drawBox(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  widthDots: number,
  heightDots: number,
  topBottomThick: number,
  sideThick: number,
) {
  context.fillStyle = '#111111'
  // Top edge
  context.fillRect(x, y, widthDots, topBottomThick)
  // Bottom edge
  context.fillRect(x, y + heightDots - topBottomThick, widthDots, topBottomThick)
  // Left edge
  context.fillRect(x, y, sideThick, heightDots)
  // Right edge
  context.fillRect(x + widthDots - sideThick, y, sideThick, heightDots)
}

function drawThermalText(
  context: CanvasRenderingContext2D,
  text: string,
  xDots: number,
  yDots: number,
  residentId: string,
  typeId: string,
  scaleX: number,
  scaleY: number,
  rotation: number,
) {
  if (!text) {
    return
  }

  const profile = RESIDENT_FONT_RENDER_METRICS[residentId] ?? RESIDENT_FONT_RENDER_METRICS['0']
  const sourceCanvas = globalThis.document.createElement('canvas')
  const sourceContext = sourceCanvas.getContext('2d')

  if (!sourceContext) {
    return
  }

  sourceContext.font = `${profile.baseSizePx}px ${profile.cssFamily}`
  const measuredWidth = Math.max(1, Math.ceil(sourceContext.measureText(text).width))
  const measuredHeight = Math.max(1, Math.ceil(profile.baseSizePx * 1.2))

  sourceCanvas.width = measuredWidth + 2
  sourceCanvas.height = measuredHeight + 2

  sourceContext.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height)
  sourceContext.fillStyle = '#ffffff'
  sourceContext.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height)
  sourceContext.fillStyle = '#111111'
  sourceContext.font = `${profile.baseSizePx}px ${profile.cssFamily}`
  sourceContext.textBaseline = 'top'
  sourceContext.fillText(text, 1, 1)

  const imageData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
  const dotsX = Math.max(1, Math.round(scaleX))
  const dotsY = Math.max(1, Math.round(scaleY))
  const boldPasses = typeId === '2' ? 2 : typeId === '1' ? 1 : 0

  // raster dimensions in dots
  const rasterH = sourceCanvas.height * dotsY

  context.fillStyle = '#111111'

  function drawPixels(offsetX: number, offsetY: number) {
    for (let py = 0; py < sourceCanvas.height; py += 1) {
      for (let px = 0; px < sourceCanvas.width; px += 1) {
        const i = (py * sourceCanvas.width + px) * 4
        const luma = 0.2126 * imageData.data[i] + 0.7152 * imageData.data[i + 1] + 0.0722 * imageData.data[i + 2]

        if (imageData.data[i + 3] > 0 && luma < 170) {
          context.fillRect(offsetX + px * dotsX, offsetY + py * dotsY, dotsX, dotsY)
          for (let pass = 1; pass <= boldPasses; pass += 1) {
            context.fillRect(offsetX + px * dotsX + pass, offsetY + py * dotsY, dotsX, dotsY)
          }
        }
      }
    }
  }

  if (rotation === 0) {
    // 0°: draw from visual top-left (xDots, yDots) going right and down
    drawPixels(xDots, yDots)
  } else if (rotation === 180) {
    // 180°: PPLA anchor (xDots, yDots) is the top of visual bbox.
    // Translate to bottom-right corner of bbox, rotate PI, draw relative.
    context.save()
    context.translate(xDots, yDots + rasterH)
    context.rotate(Math.PI)
    drawPixels(0, 0)
    context.restore()
  } else {
    // 90° / 270°: generic rotate-around-anchor approach
    context.save()
    context.translate(xDots, yDots)
    context.rotate((rotation * Math.PI) / 180)
    drawPixels(0, 0)
    context.restore()
  }
}

export function Canvas({
  document,
  selectedId,
  onSelect,
  previewMode,
  zoomPercent,
}: CanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const rasterRef = useRef<HTMLCanvasElement>(null)

  const previewScale = useMemo(() => {
    const baseScale = previewMode === 'pixel'
      ? 1
      : 96 / Math.max(96, document.setup.dpi || 203)

    return baseScale * (zoomPercent / 100)
  }, [document.setup.dpi, previewMode, zoomPercent])

  const labelWidth = document.canvas.widthDots * previewScale
  const labelHeight = document.canvas.heightDots * previewScale

  useEffect(() => {
    const canvas = rasterRef.current

    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')

    if (!context) {
      return
    }

    canvas.width = document.canvas.widthDots
    canvas.height = document.canvas.heightDots

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#f7f7f7'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = false

    for (const element of document.elements) {
      if (element.kind === 'text') {
        drawThermalText(
          context,
          element.content,
          element.xDots,
          element.yDots,
          element.font?.residentId ?? '0',
          element.font?.typeId ?? '0',
          element.font?.scaleX ?? 1,
          element.font?.scaleY ?? 1,
          element.rotation,
        )
      }

      if (element.kind === 'barcode') {        const barcodeCanvas = globalThis.document.createElement('canvas')
        const moduleWidth = Math.max(1, element.barcode?.narrowBarDots ?? 2)
        const barcodeHeight = Math.max(24, element.heightDots)
        const format = resolveBarcodeFormat(element.barcode?.symbology ?? 'X')
        const normalizedValue = normalizeBarcodeData(format, element.content)

        try {
          JsBarcode(barcodeCanvas, normalizedValue, {
            format,
            displayValue: false,
            margin: 0,
            lineColor: '#111111',
            background: '#f7f7f7',
            width: moduleWidth,
            height: barcodeHeight,
          })

          context.drawImage(barcodeCanvas, element.xDots, element.yDots)
        } catch {
          context.fillStyle = '#111111'
          drawPseudoBarcode(
            context,
            element.content,
            element.xDots,
            element.yDots,
            barcodeHeight,
            element.barcode?.narrowBarDots ?? 2,
            element.barcode?.wideBarDots ?? 4,
          )
        }
      }

      if (element.kind === 'line') {
        drawLine(
          context,
          element.xDots,
          element.yDots,
          element.widthDots,
          element.heightDots,
        )
      }

      if (element.kind === 'box') {
        drawBox(
          context,
          element.xDots,
          element.yDots,
          element.widthDots,
          element.heightDots,
          element.box?.topBottomThickDots ?? 2,
          element.box?.sideThickDots ?? 2,
        )
      }
    }
  }, [document])

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
            <canvas
              ref={rasterRef}
              className="absolute inset-0 block"
              style={{
                width: labelWidth,
                height: labelHeight,
                imageRendering: 'pixelated',
              }}
            />

            {document.elements.map(element => (
              <div
                key={element.id}
                className={cn(
                  'absolute transition-shadow bg-transparent',
                  selectedId === element.id && 'shadow-[0_0_0_2px_#1971c2]',
                )}
                style={{
                  // For 180° text the PPLA anchor is at the right edge of the text;
                  // shift left by widthDots so the hitbox covers the actual text area.
                  left: element.rotation === 180
                    ? (element.xDots - element.widthDots) * previewScale
                    : element.xDots * previewScale,
                  top: element.yDots * previewScale,
                  width: element.widthDots * previewScale,
                  height: Math.max(1, element.heightDots * previewScale),
                }}
                onClick={event => {
                  event.stopPropagation()
                  onSelect(element.id)
                }}
              />
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

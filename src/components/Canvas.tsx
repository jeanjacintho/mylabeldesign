import {
  DEFAULT_LABEL_HEIGHT_MM,
  DEFAULT_LABEL_WIDTH_MM,
  DEFAULT_PREVIEW_SCREEN_SCALE,
  labelMmToPreviewPx,
} from '@/lib/label-units'
import {
  estimatePplaLayoutExtentsDots,
  parsePplaLabelPreamble,
  PplaParserService,
  pplaLayoutExtentsToMinLabelMm,
  PPLA_LAYOUT_MARGIN_DOTS,
  PplaRendererService,
  printStartOffsetDotsX,
  shiftPplaElements,
  verticalPrintOffsetDotsY,
} from '@/lib/ppla-engine'
import { cn } from '@/lib/utils'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'

interface CanvasProps {
  pplaCode: string
  labelWidthMm: number
  labelHeightMm: number
  /** DPI efetivo: Dwh do PPLA quando existir, senão o DPI escolhido na UI. */
  coordinateDpi: number
  previewScreenScale?: number
}

export function Canvas({
  pplaCode,
  labelWidthMm = DEFAULT_LABEL_WIDTH_MM,
  labelHeightMm = DEFAULT_LABEL_HEIGHT_MM,
  coordinateDpi,
  previewScreenScale = DEFAULT_PREVIEW_SCREEN_SCALE,
}: CanvasProps) {

  const parser = useMemo(() => {
    return new PplaParserService({
      normalizeLineEndings: true,
      printerDpi: coordinateDpi,
    })
  }, [coordinateDpi])

  const pplaParse = useMemo(() => {
    return parser.parseWithDiagnostics(pplaCode)
  }, [parser, pplaCode])
  const parsedElements = pplaParse.elements
  const pplaLabelState = pplaParse.label

  const labelPreamble = useMemo(() => {
    return parsePplaLabelPreamble(pplaCode)
  }, [pplaCode])

  const printStartShiftXDots = useMemo(() => {
    return printStartOffsetDotsX(labelPreamble, coordinateDpi)
  }, [coordinateDpi, labelPreamble])

  const verticalPrintShiftYDots = useMemo(() => {
    return verticalPrintOffsetDotsY(labelPreamble, coordinateDpi)
  }, [coordinateDpi, labelPreamble])

  const layoutElements = useMemo(() => {
    return shiftPplaElements(
      parsedElements,
      printStartShiftXDots,
      verticalPrintShiftYDots,
    )
  }, [parsedElements, printStartShiftXDots, verticalPrintShiftYDots])

  const layoutExtents = useMemo(() => {
    return estimatePplaLayoutExtentsDots(layoutElements)
  }, [layoutElements])

  const minLabelFromPplaMm = useMemo(() => {
    return pplaLayoutExtentsToMinLabelMm(
      layoutExtents,
      coordinateDpi,
      PPLA_LAYOUT_MARGIN_DOTS,
    )
  }, [coordinateDpi, layoutExtents])

  const effectiveLabelWidthMm = Math.max(
    labelWidthMm,
    minLabelFromPplaMm.minWidthMm,
  )
  const minHeightFromFStopMm = useMemo(() => {
    const h = pplaLabelState.heightHundredths
    if (h == null || h <= 0) {
      return 0
    }
    return (h / 100) * 25.4
  }, [pplaLabelState.heightHundredths])

  const effectiveLabelHeightMm = Math.max(
    labelHeightMm,
    minLabelFromPplaMm.minHeightMm,
    minHeightFromFStopMm,
  )

  const labelWidthPx = useMemo(
    () =>
      labelMmToPreviewPx(
        effectiveLabelWidthMm,
        coordinateDpi,
        previewScreenScale,
      ),
    [coordinateDpi, effectiveLabelWidthMm, previewScreenScale],
  )
  const labelHeightPx = useMemo(
    () =>
      labelMmToPreviewPx(
        effectiveLabelHeightMm,
        coordinateDpi,
        previewScreenScale,
      ),
    [coordinateDpi, effectiveLabelHeightMm, previewScreenScale],
  )

  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const canvasElementRef = useRef<HTMLCanvasElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom] = useState(1)
  const renderer = useMemo(() => {
    return new PplaRendererService({
      dpi: coordinateDpi,
      scaleFactor: previewScreenScale,
    })
  }, [coordinateDpi, previewScreenScale])

  useLayoutEffect(() => {
    const canvas = canvasElementRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const devicePixelRatio = window.devicePixelRatio || 1
    const logicalWidthPx = Math.max(1, Math.floor(labelWidthPx))
    const logicalHeightPx = Math.max(1, Math.floor(labelHeightPx))
    canvas.width = Math.floor(logicalWidthPx * devicePixelRatio)
    canvas.height = Math.floor(logicalHeightPx * devicePixelRatio)
    canvas.style.width = `${logicalWidthPx}px`
    canvas.style.height = `${logicalHeightPx}px`

    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    ctx.clearRect(0, 0, logicalWidthPx, logicalHeightPx)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, logicalWidthPx, logicalHeightPx)
    ctx.fillStyle = '#111827'

    renderer.render(layoutElements, ctx, {
      canvasHeightPx: logicalHeightPx,
      labelState: pplaLabelState,
    })
  }, [labelHeightPx, labelWidthPx, layoutElements, pplaLabelState, renderer])

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
            style={{
              width: labelWidthPx + 16,
              height: labelHeightPx + 16,
            }}
          >
            {/* "Frame 2" - label render surface */}
            <div
              className={cn(
                'absolute border-2 bg-white',
                selectedId === 'frame-2'
                  ? 'border-[#1971c2]'
                  : 'border-[#ff6b6b]',
              )}
              style={{
                left: 8,
                top: 8,
                width: labelWidthPx,
                height: labelHeightPx,
              }}
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

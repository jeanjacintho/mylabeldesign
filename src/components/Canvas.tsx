import {
  DEFAULT_LABEL_HEIGHT_MM,
  DEFAULT_LABEL_WIDTH_MM,
  DEFAULT_PREVIEW_SCREEN_SCALE,
  labelMmToPreviewPx,
} from '@/lib/label-units'
import type { AnyPplaElement, PplaElementKind } from '@/lib/ppla-model'
import { getPplaElementVerticalExtentDots } from '@/lib/ppla-layout'
import {
  snapToNearestScaleMultiplier,
  stagePositionToElementXY,
  stagePxToDots,
} from '@/lib/ppla-coords'
import { PplaElementShape } from '@/components/konva/PplaElementShape'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type Konva from 'konva'
import { Layer, Rect, Stage, Text, Transformer } from 'react-konva'

export type CanvasTool = 'select' | 'text' | 'box' | 'line'

/** Margem em torno da etiqueta dentro da viewport, como fração do menor lado disponível. */
const FIT_MARGIN_RATIO = 0.9

interface CanvasProps {
  elements: AnyPplaElement[]
  labelWidthMm: number
  labelHeightMm: number
  /** DPI efetivo: Dwh do PPLA quando existir, senão o DPI escolhido na UI. */
  coordinateDpi: number
  previewScreenScale?: number
  selectedIndex: number | null
  onSelect: (index: number | null) => void
  onUpdateElement: (index: number, patch: Partial<AnyPplaElement>) => void
  activeTool: CanvasTool
  onCreateElement: (kind: PplaElementKind, xDots: number, yDots: number) => void
  onToolUsed: () => void
}

/** Tipos cujo redimensionamento tem um campo PPLA real por trás (largura/altura de
 * texto = multiplicadores; box/line = width/height diretos). Barcode/graphic ficam só
 * com arrastar+rotacionar por ora — a "largura" deles no preview é aproximada, não um
 * campo do PPLA que dê pra escrever de volta. */
function isResizable(kind: AnyPplaElement['type']): boolean {
  return kind === 'text' || kind === 'box' || kind === 'line'
}

export function Canvas({
  elements,
  labelWidthMm = DEFAULT_LABEL_WIDTH_MM,
  labelHeightMm = DEFAULT_LABEL_HEIGHT_MM,
  coordinateDpi,
  previewScreenScale = DEFAULT_PREVIEW_SCREEN_SCALE,
  selectedIndex,
  onSelect,
  onUpdateElement,
  activeTool,
  onCreateElement,
  onToolUsed,
}: CanvasProps) {
  const labelWidthPx = useMemo(
    () => labelMmToPreviewPx(labelWidthMm, coordinateDpi, previewScreenScale),
    [coordinateDpi, labelWidthMm, previewScreenScale],
  )
  const labelHeightPx = useMemo(
    () => labelMmToPreviewPx(labelHeightMm, coordinateDpi, previewScreenScale),
    [coordinateDpi, labelHeightMm, previewScreenScale],
  )

  const viewportRef = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 })
  const shapeNodes = useRef(new Map<number, Konva.Node>())
  const transformerRef = useRef<Konva.Transformer>(null)
  const selectedElement = selectedIndex !== null ? elements[selectedIndex] : undefined

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry) return
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /**
   * "Fit to frame": a etiqueta sempre ocupa o mesmo espaço fixo na tela (a viewport), e o
   * zoom é recalculado pra ela caber inteira — menor que a viewport dá zoom in, maior dá
   * zoom out. Escala nativa do Stage Konva (não CSS `transform`), então continua nítido em
   * qualquer tamanho de etiqueta, ao contrário de esticar via CSS um bitmap já rasterizado.
   */
  const fitZoom = useMemo(() => {
    if (labelWidthPx <= 0 || labelHeightPx <= 0 || viewportSize.width <= 1 || viewportSize.height <= 1) {
      return 1
    }
    const scaleToFit = Math.min(
      viewportSize.width / labelWidthPx,
      viewportSize.height / labelHeightPx,
    )
    // Nunca amplia além do tamanho físico real (100%) — só reduz quando a etiqueta não
    // cabe na viewport. Sem isso, em telas grandes a viewport é enorme e o fit ampliava a
    // etiqueta pra preencher o espaço todo, ficando exageradamente grande.
    return Math.min(scaleToFit * FIT_MARGIN_RATIO, 1)
  }, [labelWidthPx, labelHeightPx, viewportSize])

  const stagePos = useMemo(
    () => ({
      x: (viewportSize.width - labelWidthPx * fitZoom) / 2,
      y: (viewportSize.height - labelHeightPx * fitZoom) / 2,
    }),
    [viewportSize, labelWidthPx, labelHeightPx, fitZoom],
  )

  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) return
    if (selectedIndex === null) {
      transformer.nodes([])
      transformer.getLayer()?.batchDraw()
      return
    }
    const node = shapeNodes.current.get(selectedIndex)
    transformer.nodes(node ? [node] : [])
    transformer.getLayer()?.batchDraw()
  }, [selectedIndex, elements])

  function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const clickedOnEmpty = e.target === e.target.getStage()
    if (!clickedOnEmpty) {
      return
    }

    if (activeTool === 'select') {
      onSelect(null)
      return
    }

    const stage = e.target.getStage()
    // Ponto relativo ao "mundo" da etiqueta (já descontando o fit/zoom do Stage), não o
    // ponteiro cru na tela — o Stage tem seu próprio x/y/scale (auto-fit) agora.
    const pointer = stage?.getRelativePointerPosition()
    if (!pointer) return

    const kind: PplaElementKind = activeTool
    const xDots = stagePxToDots(pointer.x, coordinateDpi, previewScreenScale)
    const yDots = stagePxToDots(labelHeightPx - pointer.y, coordinateDpi, previewScreenScale)
    onCreateElement(kind, xDots, yDots)
    onToolUsed()
  }

  function handleDragEnd(index: number, node: Konva.Node) {
    const element = elements[index]
    if (!element) return
    const verticalExtentDots = getPplaElementVerticalExtentDots(element)
    const xy = stagePositionToElementXY(
      node.x(), node.y(), verticalExtentDots, labelHeightPx, coordinateDpi, previewScreenScale,
    )
    onUpdateElement(index, { x: xy.x, y: xy.y })
  }

  function handleTransformEnd(index: number, node: Konva.Node) {
    const element = elements[index]
    if (!element) return

    const rotation = (((Math.round(node.rotation() / 90) * 90) % 360) + 360) % 360 as 0 | 90 | 180 | 270
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()

    let patch: Partial<AnyPplaElement> = { rotation }

    if (element.type === 'text') {
      patch = {
        ...patch,
        widthMultiplier: snapToNearestScaleMultiplier(element.widthMultiplier * Math.abs(scaleX)),
        heightMultiplier: snapToNearestScaleMultiplier(element.heightMultiplier * scaleY),
      }
    } else if (element.type === 'box' || element.type === 'line') {
      const newWidthPx = node.width() * scaleX
      const newHeightPx = node.height() * scaleY
      patch = {
        ...patch,
        width: Math.max(1, Math.round(stagePxToDots(newWidthPx, coordinateDpi, previewScreenScale))),
        height: Math.max(1, Math.round(stagePxToDots(newHeightPx, coordinateDpi, previewScreenScale))),
      }
      node.scaleX(1)
      node.scaleY(1)
    }

    const merged = { ...element, ...patch } as AnyPplaElement
    const verticalExtentDots = getPplaElementVerticalExtentDots(merged)
    const xy = stagePositionToElementXY(
      node.x(), node.y(), verticalExtentDots, labelHeightPx, coordinateDpi, previewScreenScale,
    )

    onUpdateElement(index, { ...patch, x: xy.x, y: xy.y })
  }

  return (
    <div
      className="flex-1 relative overflow-hidden bg-[#1a1a1a]"
      style={{
        backgroundImage:
          'radial-gradient(circle, #3a3a3a 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Rulers - top */}
      <div className="absolute top-0 left-8 right-0 h-6 bg-[#252525] border-b border-[#3a3a3a] z-10 overflow-hidden">
        <svg width="100%" height="24" className="text-[#555]">
          {Array.from({ length: 60 }).map((_, i) => {
            const x = i * 50
            const isMajor = i % 2 === 0
            return (
              <g key={i}>
                <line x1={x} y1={isMajor ? 12 : 16} x2={x} y2={24} stroke="#555" strokeWidth="1" />
                {isMajor && (
                  <text x={x + 3} y={10} fontSize="9" fill="#666" fontFamily="monospace">
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
                <line x1={isMajor ? 12 : 16} y1={y} x2={32} y2={y} stroke="#555" strokeWidth="1" />
                {isMajor && (
                  <text
                    x={10} y={y + 3} fontSize="9" fill="#666" fontFamily="monospace"
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
        ref={viewportRef}
        className="absolute inset-0"
        style={{ top: '24px', left: '32px' }}
      >
        <Stage
          width={Math.max(1, Math.floor(viewportSize.width))}
          height={Math.max(1, Math.floor(viewportSize.height))}
          x={stagePos.x}
          y={stagePos.y}
          scaleX={fitZoom}
          scaleY={fitZoom}
          onMouseDown={handleStageMouseDown}
          onTouchStart={handleStageMouseDown}
        >
          <Layer>
            <Rect
              x={-1} y={-1}
              width={Math.max(1, Math.floor(labelWidthPx)) + 2}
              height={Math.max(1, Math.floor(labelHeightPx)) + 2}
              fill="none"
              stroke={selectedIndex !== null ? '#1971c2' : '#ff6b6b'}
              strokeWidth={2}
              shadowColor="black"
              shadowBlur={16}
              shadowOpacity={0.4}
            />
            <Rect
              x={0} y={0}
              width={Math.max(1, Math.floor(labelWidthPx))}
              height={Math.max(1, Math.floor(labelHeightPx))}
              fill="#ffffff"
            />
            <Text
              text="PPLA Preview"
              x={0}
              y={labelHeightPx + 10}
              width={labelWidthPx}
              align="center"
              fontSize={11}
              fill="#93c5fd"
            />
                  {elements.map((element, index) => (
                    <PplaElementShape
                      key={index}
                      element={element}
                      index={index}
                      canvasHeightPx={labelHeightPx}
                      dpi={coordinateDpi}
                      scale={previewScreenScale}
                      isSelected={selectedIndex === index}
                      draggable={activeTool === 'select'}
                      onSelect={onSelect}
                      onDragEnd={handleDragEnd}
                      onTransformEnd={handleTransformEnd}
                      shapeRef={(i, node) => {
                        if (node) shapeNodes.current.set(i, node)
                        else shapeNodes.current.delete(i)
                      }}
                    />
                  ))}
            <Transformer
              ref={transformerRef}
              rotationSnaps={[0, 90, 180, 270]}
              resizeEnabled={selectedElement !== undefined && isResizable(selectedElement.type)}
              rotateEnabled
            />
          </Layer>
        </Stage>
      </div>
    </div>
  )
}

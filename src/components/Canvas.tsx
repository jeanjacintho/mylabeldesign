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
import { cn } from '@/lib/utils'
import { useEffect, useMemo, useRef, useState } from 'react'
import type Konva from 'konva'
import { Layer, Rect, Stage, Transformer } from 'react-konva'

export type CanvasTool = 'select' | 'text' | 'box' | 'line'

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

  const [zoom] = useState(1)
  const shapeNodes = useRef(new Map<number, Konva.Node>())
  const transformerRef = useRef<Konva.Transformer>(null)
  const selectedElement = selectedIndex !== null ? elements[selectedIndex] : undefined

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
    const pointer = stage?.getPointerPosition()
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
        className="absolute inset-0 flex items-center justify-center"
        style={{ top: '24px', left: '32px' }}
      >
        <div className="relative" style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
          <div className="absolute -top-6 left-0 text-xs text-[#666] whitespace-nowrap">
            Frame 1
          </div>

          <div
            className="relative bg-[#f5f5f5] shadow-2xl"
            style={{ width: labelWidthPx + 16, height: labelHeightPx + 16 }}
          >
            <div
              className={cn(
                'absolute border-2 bg-white',
                selectedIndex !== null ? 'border-[#1971c2]' : 'border-[#ff6b6b]',
              )}
              style={{ left: 8, top: 8, width: labelWidthPx, height: labelHeightPx }}
            >
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-[#1971c2] text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap">
                PPLA Preview
              </div>

              <Stage
                width={Math.max(1, Math.floor(labelWidthPx))}
                height={Math.max(1, Math.floor(labelHeightPx))}
                onMouseDown={handleStageMouseDown}
                onTouchStart={handleStageMouseDown}
              >
                <Layer>
                  <Rect
                    x={0} y={0}
                    width={Math.max(1, Math.floor(labelWidthPx))}
                    height={Math.max(1, Math.floor(labelHeightPx))}
                    fill="#ffffff"
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
        </div>
      </div>
    </div>
  )
}

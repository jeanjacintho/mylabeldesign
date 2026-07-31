import { useMemo } from 'react'
import type Konva from 'konva'
import { Group, Rect, Shape, Text } from 'react-konva'
import type { AnyPplaElement } from '@/lib/ppla-model'
import {
  getBaseFontHeightDots,
  getPplaElementLocalSizeDots,
  PPLA_TEXT_CONDENSE_FACTOR,
  PPLA_TEXT_FONT_FAMILY,
} from '@/lib/ppla-layout'
import { dotsToStagePx, elementTopLeftStagePosition } from '@/lib/ppla-coords'

export interface PplaElementShapeProps {
  element: AnyPplaElement
  index: number
  canvasHeightPx: number
  dpi: number
  scale: number
  isSelected: boolean
  draggable: boolean
  onSelect: (index: number) => void
  onDragEnd: (index: number, node: Konva.Node) => void
  onTransformEnd: (index: number, node: Konva.Node) => void
  shapeRef: (index: number, node: Konva.Node | null) => void
}

const FILL = '#111827'

/** Um nó Konva por elemento PPLA — dispatcha por tipo. Posição/rotação seguem a mesma
 * convenção do renderer 2D cru (`ppla-render.ts`): canto superior-esquerdo + rotação em
 * torno desse canto, pra bater visualmente com o preview já existente. */
export function PplaElementShape({
  element,
  index,
  canvasHeightPx,
  dpi,
  scale,
  isSelected,
  draggable,
  onSelect,
  onDragEnd,
  onTransformEnd,
  shapeRef,
}: PplaElementShapeProps) {
  const pos = useMemo(
    () => elementTopLeftStagePosition(element, canvasHeightPx, dpi, scale),
    [element, canvasHeightPx, dpi, scale],
  )
  const localSizeDots = useMemo(() => getPplaElementLocalSizeDots(element), [element])
  const widthPx = dotsToStagePx(localSizeDots.width, dpi, scale)
  const heightPx = dotsToStagePx(localSizeDots.height, dpi, scale)

  const commonProps = {
    x: pos.x,
    y: pos.y,
    rotation: element.rotation,
    draggable,
    onClick: () => onSelect(index),
    onTap: () => onSelect(index),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => onDragEnd(index, e.target),
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => onTransformEnd(index, e.target),
    ref: (node: Konva.Node | null) => shapeRef(index, node),
  }

  if (element.type === 'text') {
    const baseDots = getBaseFontHeightDots(element.fontId, element.subfont)
    const fontSizePx = dotsToStagePx(baseDots * Math.max(1, element.heightMultiplier), dpi, scale)
    const mirrorScaleX =
      (element.mirror ? -1 : 1) * Math.max(1, element.widthMultiplier) * PPLA_TEXT_CONDENSE_FACTOR
    return (
      <Text
        {...commonProps}
        text={element.text}
        fontSize={fontSizePx}
        fontFamily={PPLA_TEXT_FONT_FAMILY}
        fill={FILL}
        // No `width`/`height`: those are only a rough estimate (`roughTextCellDots`), and
        // Konva's Text still clips/aligns to a fixed width even with `wrap="none"` — an
        // underestimate silently truncated real label text. Auto-sizing to the actual
        // glyph metrics can never cut it off short.
        wrap="none"
        scaleX={mirrorScaleX}
        stroke={isSelected ? '#1971c2' : undefined}
        strokeWidth={isSelected ? 0.5 : 0}
      />
    )
  }

  if (element.type === 'line') {
    return (
      <Rect
        {...commonProps}
        width={widthPx}
        height={heightPx}
        fill={FILL}
        stroke={isSelected ? '#1971c2' : undefined}
        strokeWidth={isSelected ? 1 : 0}
      />
    )
  }

  if (element.type === 'box') {
    const el = element
    const tTbPx = Math.max(1, dotsToStagePx(el.thicknessTopBottom, dpi, scale))
    const tSidePx = Math.max(1, dotsToStagePx(el.thicknessSides, dpi, scale))
    return (
      <Shape
        {...commonProps}
        width={widthPx}
        height={heightPx}
        stroke={isSelected ? '#1971c2' : undefined}
        strokeWidth={isSelected ? 1 : 0}
        sceneFunc={(context, shape) => {
          const w = shape.width()
          const h = shape.height()
          const tH = Math.min(tTbPx, h / 2)
          const tW = Math.min(tSidePx, w / 2)
          context.fillStyle = FILL
          context.fillRect(0, 0, w, tH)
          context.fillRect(0, h - tH, w, tH)
          context.fillRect(0, 0, tW, h)
          context.fillRect(w - tW, 0, tW, h)
          context.fillStrokeShape(shape)
        }}
        hitFunc={(context, shape) => {
          // Caixa PPLA é oca (só a moldura é desenhada) — sem isto, só as ~poucas linhas
          // de borda respondem a clique/arraste; o miolo vazio precisa contar como a
          // área inteira do elemento pra selecionar/mover funcionar de forma previsível.
          context.beginPath()
          context.rect(0, 0, shape.width(), shape.height())
          context.closePath()
          context.fillStrokeShape(shape)
        }}
      />
    )
  }

  if (element.type === 'barcode') {
    return (
      <Group {...commonProps}>
        <Rect
          width={widthPx}
          height={heightPx}
          stroke={FILL}
          strokeWidth={1}
        />
        <Text
          text={`[${element.barcodeType}] ${element.data.slice(0, 24)}`}
          fontSize={10}
          fontFamily="monospace"
          fill={FILL}
          x={2}
          y={2}
          width={widthPx - 4}
        />
        {isSelected && (
          <Rect width={widthPx} height={heightPx} stroke="#1971c2" strokeWidth={1} />
        )}
      </Group>
    )
  }

  // graphic — placeholder (tamanho real vem do arquivo gráfico externo, não do código PPLA)
  return (
    <Group {...commonProps}>
      <Rect width={widthPx} height={heightPx} stroke={FILL} strokeWidth={1} />
      <Text
        text={element.name.slice(0, 16)}
        fontSize={10}
        fontFamily="monospace"
        fill={FILL}
        x={4}
        y={2}
      />
      {isSelected && (
        <Rect width={widthPx} height={heightPx} stroke="#1971c2" strokeWidth={1} />
      )}
    </Group>
  )
}

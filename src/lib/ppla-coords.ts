/**
 * Conversões de coordenadas isoladas para o editor visual (Konva) — mantém toda a
 * matemática de dots ↔ px do stage ↔ inversão de shift num só lugar, longe dos handlers
 * de evento (arrastar/redimensionar), pra evitar erros de sinal/eixo espalhados pelo código.
 *
 * Convenção adotada (espelha exatamente o que `ppla-render.ts` já faz, pra o editor Konva
 * bater visualmente com o preview cru já existente):
 * - PPLA: origem inferior-esquerda, Y cresce pra cima (guia A1).
 * - Stage/canvas: origem superior-esquerda, Y cresce pra baixo.
 * - Cada nó Konva é posicionado pelo canto superior-esquerdo (sem offsetX/offsetY), com
 *   `rotation` igual ao do elemento — o pivô de rotação fica nesse canto, igual ao
 *   `ctx.translate(x, topY); ctx.rotate(...)` do renderer 2D cru.
 */

import { printerDotsToPreviewPx } from '@/lib/label-units'
import type { AnyPplaElement, PplaElementFormatShift } from '@/lib/ppla-model'
import { getPplaElementVerticalExtentDots } from '@/lib/ppla-layout'
import { parseScaleChar, scaleMultiplierToPplaChar } from '@/lib/ppla-scale'

export function dotsToStagePx(dots: number, dpi: number, scale: number): number {
  return printerDotsToPreviewPx(dots, dpi, scale)
}

/** Inverso de `dotsToStagePx` — deriva o fator px-por-dot da própria função, sem duplicar constantes. */
export function stagePxToDots(px: number, dpi: number, scale: number): number {
  const pxPerDot = printerDotsToPreviewPx(1, dpi, scale)
  if (!Number.isFinite(pxPerDot) || pxPerDot === 0) {
    return 0
  }
  return px / pxPerDot
}

/** Canto superior-esquerdo do elemento no stage — mesmo cálculo de `pplaTopLeftScreenY` em ppla-render.ts. */
export function elementTopLeftStagePosition(
  element: AnyPplaElement,
  canvasHeightPx: number,
  dpi: number,
  scale: number,
): { x: number; y: number } {
  const verticalExtentDots = getPplaElementVerticalExtentDots(element)
  return {
    x: dotsToStagePx(element.x, dpi, scale),
    y: canvasHeightPx - dotsToStagePx(element.y + verticalExtentDots, dpi, scale),
  }
}

/**
 * Inverso de `elementTopLeftStagePosition`: dado onde o canto superior-esquerdo do nó
 * Konva ficou no stage (depois de um arraste), devolve o x/y (em dots, já com os shifts
 * de margem/preâmbulo aplicados) que o elemento deveria assumir. `verticalExtentDots` deve
 * vir do elemento tal como está ANTES do arraste (rotação/tamanho não mudam ao só mover).
 */
export function stagePositionToElementXY(
  stageX: number,
  stageY: number,
  verticalExtentDots: number,
  canvasHeightPx: number,
  dpi: number,
  scale: number,
): { x: number; y: number } {
  return {
    x: stagePxToDots(stageX, dpi, scale),
    y: stagePxToDots(canvasHeightPx - stageY, dpi, scale) - verticalExtentDots,
  }
}

/**
 * O x/y de um `AnyPplaElement` já parseado tem os shifts de `C`/`R` (margem/offset do
 * bloco, guia A6) e o shift global de preâmbulo (`O`/`R` de sistema, `printStartOffsetDotsX`/
 * `verticalPrintOffsetDotsY`) somados. Pra reescrever a linha crua de um elemento editado,
 * é preciso subtrair os dois antes de emitir — usando o shift EXATO gravado por elemento
 * em `elementFormatShifts` (não um valor recalculado do estado atual, que pode ter mudado
 * de lá pra cá com `C`/`R` repetidos dentro do mesmo bloco).
 */
export function toRawHeaderXY(
  finalXDots: number,
  finalYDots: number,
  elementShift: PplaElementFormatShift,
  globalShiftXDots: number,
  globalShiftYDots: number,
): { x: number; y: number } {
  return {
    x: finalXDots - elementShift.dx - globalShiftXDots,
    y: finalYDots - elementShift.dy - globalShiftYDots,
  }
}

/** Direção oposta de `toRawHeaderXY` — usada só se algum dia precisarmos exibir o valor cru. */
export function fromRawHeaderXY(
  rawXDots: number,
  rawYDots: number,
  elementShift: PplaElementFormatShift,
  globalShiftXDots: number,
  globalShiftYDots: number,
): { x: number; y: number } {
  return {
    x: rawXDots + elementShift.dx + globalShiftXDots,
    y: rawYDots + elementShift.dy + globalShiftYDots,
  }
}

/**
 * Redimensionar texto no PPLA não é um W/H livre — é `widthMultiplier`/`heightMultiplier`
 * inteiros de 1 a 24 (guia A7, `h`/`v`). Converte um fator de escala contínuo (do
 * Transformer do Konva) pro multiplicador inteiro válido mais próximo.
 */
export function snapToNearestScaleMultiplier(rawMultiplier: number): number {
  const clamped = Math.max(1, Math.min(24, Math.round(rawMultiplier)))
  // garante que o valor resultante é redondamente representável num carácter de escala PPLA
  return parseScaleChar(scaleMultiplierToPplaChar(clamped))
}

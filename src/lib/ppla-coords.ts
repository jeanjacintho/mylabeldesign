/**
 * Isolated coordinate conversions for the visual (Konva) editor — keeps all the
 * dots <-> stage-px <-> shift-inversion math in one place, away from event handlers
 * (drag/resize), to avoid sign/axis mistakes scattered across the codebase.
 *
 * Convention used (mirrors exactly what `ppla-render.ts` already does, so the Konva
 * editor matches the existing raw-canvas preview visually):
 * - PPLA: bottom-left origin, Y grows upward (A1 guide).
 * - Stage/canvas: top-left origin, Y grows downward.
 * - Each Konva node is positioned by its top-left corner (no offsetX/offsetY), with
 *   `rotation` equal to the element's — the rotation pivot stays at that corner, same
 *   as the raw 2D renderer's `ctx.translate(x, topY); ctx.rotate(...)`.
 */

import { printerDotsToPreviewPx } from '@/lib/label-units'
import type { AnyPplaElement, PplaElementFormatShift } from '@/lib/ppla-model'
import { getPplaElementVerticalExtentDots } from '@/lib/ppla-layout'
import { parseScaleChar, scaleMultiplierToPplaChar } from '@/lib/ppla-scale'

/** Converts printer dots to Konva stage pixels at the given DPI/scale. */
export function dotsToStagePx(dots: number, dpi: number, scale: number): number {
  return printerDotsToPreviewPx(dots, dpi, scale)
}

/** Inverse of `dotsToStagePx` — derives the px-per-dot factor from that same function, without duplicating constants. */
export function stagePxToDots(px: number, dpi: number, scale: number): number {
  const pxPerDot = printerDotsToPreviewPx(1, dpi, scale)
  if (!Number.isFinite(pxPerDot) || pxPerDot === 0) {
    return 0
  }
  return px / pxPerDot
}

/** The element's top-left corner on the stage — same calculation as `pplaTopLeftScreenY` in ppla-render.ts. */
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
 * Inverse of `elementTopLeftStagePosition`: given where the Konva node's top-left corner
 * ended up on the stage (after a drag), returns the x/y (in dots, already including the
 * margin/preamble shifts) the element should take. `verticalExtentDots` should come from
 * the element as it was BEFORE the drag (rotation/size don't change from just moving it).
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
 * A parsed `AnyPplaElement`'s x/y already has the `C`/`R` shift (block margin/offset, A6
 * guide) and the global preamble shift (system `O`/`R`, `printStartOffsetDotsX`/
 * `verticalPrintOffsetDotsY`) added in. To rewrite an edited element's raw line, both must
 * be subtracted before emitting — using the EXACT shift recorded per element in
 * `elementFormatShifts` (not a value recomputed from the current state, which may have
 * changed since then via repeated `C`/`R` within the same block).
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

/** Opposite direction of `toRawHeaderXY` — used only if we ever need to display the raw value. */
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
 * Resizing text in PPLA isn't a free W/H — it's integer `widthMultiplier`/`heightMultiplier`
 * from 1 to 24 (A7 guide, `h`/`v`). Converts a continuous scale factor (from Konva's
 * Transformer) to the nearest valid integer multiplier.
 */
export function snapToNearestScaleMultiplier(rawMultiplier: number): number {
  const clamped = Math.max(1, Math.min(24, Math.round(rawMultiplier)))
  // ensures the resulting value round-trips through a real PPLA scale character
  return parseScaleChar(scaleMultiplierToPplaChar(clamped))
}

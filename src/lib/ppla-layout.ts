import { DEFAULT_PRINTER_DPI } from '@/lib/label-units'
import type { AnyPplaElement, PplaText } from '@/lib/ppla-model'

export const PPLA_LAYOUT_MARGIN_DOTS = 32
export const PPLA_GRAPHIC_PLACEHOLDER_WIDTH_DOTS = 64
export const PPLA_GRAPHIC_PLACEHOLDER_HEIGHT_DOTS = 32

/**
 * `ooo` is NOT a pixel height for fonts 0-8, ':' (Courier), or ';' (font board) — A7/AD manual:
 * fonts 0-8 use a fixed `ooo` of '000' (confirmed by every A9/AB example in the manual), ':'
 * uses `ooo` as a symbol-set selector (000-007), and ';' uses `ooo` as the font's index in ROM
 * (AD, p. 89). These internal fonts have a fixed native size, scaled only by h/v.
 *
 * The Programmer's Manual never prints exact per-font dot sizes (AD, p. 90-92, only shows
 * character maps at growing but unlabeled sizes). The printer's own General Specifications
 * (Argox OS-2140 series User Manual, "Fonts" §, p. 58) does publish a real range for these
 * resident fonts: 0.049"H ~ 0.23"H (1.25mm ~ 6.0mm) at 203 dpi, i.e. ~10 to ~48 dots. Font 0 is
 * the smallest (barely-legible ASCII set) and font 8 (OCR-B) the largest per the AD character
 * maps, so we interpolate across that documented range instead of using one flat size for all
 * of them — a flat size was the bug: small fonts (0-3) rendered as oversized as font 8.
 * Only font '9' uses `ooo` as a real size: index 000-006 -> points (4-18pt) -> dots at
 * `DEFAULT_PRINTER_DPI`, or a PCL font ID (unknown size) for `ooo` outside that range.
 * @see docs/PPLA_Parser_Guide.md §6.4
 */
const RESIDENT_FONT_HEIGHT_DOTS: Record<string, number> = {
  '0': 10,
  '1': 13,
  '2': 16,
  '3': 20,
  '4': 24,
  '5': 28,
  '6': 32,
  '7': 38,
  '8': 48,
}
const DEFAULT_RESIDENT_FONT_HEIGHT_DOTS = 24

export function getBaseFontHeightDots(fontType: string, subfont: string): number {
  if (fontType === '9' && /^\d{3}$/.test(subfont)) {
    const n = Number.parseInt(subfont, 10)
    if (n >= 0 && n <= 6) {
      const pointSizes = [4, 6, 8, 10, 12, 14, 18]
      const pt = pointSizes[n] ?? 10
      return Math.max(
        4,
        Math.round((pt / 72) * DEFAULT_PRINTER_DPI),
      )
    }
  }

  return RESIDENT_FONT_HEIGHT_DOTS[fontType] ?? DEFAULT_RESIDENT_FONT_HEIGHT_DOTS
}

/** Rough (not pixel-perfect) local width/height estimate for a text element, based on font size and string length. */
function roughTextCellDots(element: PplaText): { w: number; h: number } {
  const baseDots = getBaseFontHeightDots(element.fontId, element.subfont)
  const cellH = baseDots * Math.max(1, element.heightMultiplier)
  const charStep = Math.max(8, baseDots * 0.52)
  const w =
    Math.max(
      charStep,
      element.text.length * charStep * Math.max(1, element.widthMultiplier),
    )
  const h = cellH
  return { w, h }
}

/** Returns an element's local (pre-rotation) width/height in dots, used for both rendering and layout math. */
export function getPplaElementLocalSizeDots(
  element: AnyPplaElement,
): { width: number; height: number } {
  if (element.type === 'text') {
    const { w, h } = roughTextCellDots(element)
    return { width: w, height: h }
  }
  if (element.type === 'line' || element.type === 'box') {
    return { width: element.width, height: element.height }
  }
  if (element.type === 'barcode') {
    return {
      width: Math.max(12, element.wideBarScale * 10 + element.data.length * 6),
      height: element.height,
    }
  }
  return {
    width: PPLA_GRAPHIC_PLACEHOLDER_WIDTH_DOTS,
    height: PPLA_GRAPHIC_PLACEHOLDER_HEIGHT_DOTS,
  }
}

/** Returns how far an element extends along the vertical (Y) axis on screen, swapping width/height for 90°/270° rotations. */
export function getPplaElementVerticalExtentDots(
  element: AnyPplaElement,
): number {
  const size = getPplaElementLocalSizeDots(element)
  if (element.rotation === 90 || element.rotation === 270) {
    return size.width
  }
  return size.height
}

/** Returns how far an element extends along the horizontal (X) axis on screen, swapping width/height for 90°/270° rotations. */
function getPplaElementHorizontalExtentDots(element: AnyPplaElement): number {
  const size = getPplaElementLocalSizeDots(element)
  if (element.rotation === 90 || element.rotation === 270) {
    return size.height
  }
  return size.width
}

/** Computes the furthest X/Y extent reached by any element, i.e. the label's minimum content bounding box. */
export function estimatePplaLayoutExtentsDots(
  elements: AnyPplaElement[],
): { maxX: number; maxY: number } {
  let maxX = 0
  let maxY = 0
  for (const el of elements) {
    maxX = Math.max(maxX, el.x + getPplaElementHorizontalExtentDots(el))
    maxY = Math.max(maxY, el.y + getPplaElementVerticalExtentDots(el))
  }
  return { maxX, maxY }
}

/** Converts a content bounding box (dots) plus a margin into a minimum label size in millimeters. */
export function pplaLayoutExtentsToMinLabelMm(
  extents: { maxX: number; maxY: number },
  coordinateDpi: number,
  marginDots: number,
): { minWidthMm: number; minHeightMm: number } {
  if (
    !Number.isFinite(coordinateDpi) ||
    coordinateDpi <= 0 ||
    !Number.isFinite(extents.maxX) ||
    !Number.isFinite(extents.maxY)
  ) {
    return { minWidthMm: 0, minHeightMm: 0 }
  }
  const pad = Math.max(0, marginDots)
  const wDots = Math.max(0, extents.maxX + pad)
  const hDots = Math.max(0, extents.maxY + pad)
  return {
    minWidthMm: (wDots * 25.4) / coordinateDpi,
    minHeightMm: (hDots * 25.4) / coordinateDpi,
  }
}

import { DEFAULT_PRINTER_DPI } from '@/lib/label-units'
import type { AnyPplaElement, PplaText } from '@/lib/ppla-model'

export const PPLA_LAYOUT_MARGIN_DOTS = 32
export const PPLA_GRAPHIC_PLACEHOLDER_WIDTH_DOTS = 64
export const PPLA_GRAPHIC_PLACEHOLDER_HEIGHT_DOTS = 32

/**
 * ooo: fontes 1–8 e : ; = altura em pixels (na grelha da impressora);
 * fonte 9 = índice 000–006 → pontos (4–18 pt) → dots @ DEFAULT_PRINTER_DPI.
 * @see docs/PPLA_Parser_Guide.md §6.4
 */
export function getBaseFontHeightDots(fontType: string, subfont: string): number {
  const DEFAULT = 24

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

  if (
    (fontType >= '1' && fontType <= '8'
      || fontType === '0'
      || fontType === ':'
      || fontType === ';')
    && /^\d{3}$/.test(subfont)
  ) {
    const px = Number.parseInt(subfont, 10)
    if (Number.isFinite(px)) {
      return Math.max(1, Math.min(999, px))
    }
  }

  return DEFAULT
}

function roughTextCellDots(element: PplaText): { w: number; h: number } {
  const cellH = getBaseFontHeightDots(element.fontId, element.subfont)
    * Math.max(1, element.heightMultiplier)
  const charStep = Math.max(8, cellH * 0.52)
  const w =
    Math.max(
      charStep,
      element.text.length * charStep * Math.max(1, element.widthMultiplier),
    )
  const h = cellH
  return { w, h }
}

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

export function getPplaElementVerticalExtentDots(
  element: AnyPplaElement,
): number {
  const size = getPplaElementLocalSizeDots(element)
  if (element.rotation === 90 || element.rotation === 270) {
    return size.width
  }
  return size.height
}

function getPplaElementHorizontalExtentDots(element: AnyPplaElement): number {
  const size = getPplaElementLocalSizeDots(element)
  if (element.rotation === 90 || element.rotation === 270) {
    return size.height
  }
  return size.width
}

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

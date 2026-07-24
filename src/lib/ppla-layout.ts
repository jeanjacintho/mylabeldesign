import { DEFAULT_PRINTER_DPI } from '@/lib/label-units'
import type { AnyPplaElement, PplaText } from '@/lib/ppla-model'

export const PPLA_LAYOUT_MARGIN_DOTS = 32
export const PPLA_GRAPHIC_PLACEHOLDER_WIDTH_DOTS = 64
export const PPLA_GRAPHIC_PLACEHOLDER_HEIGHT_DOTS = 32

/**
 * ooo NÃO é altura em pixels para fontes 0–8, ':' (Courier) ou ';' (font board) — manual A7/AD:
 * fontes 0–8 usam ooo fixo em '000' (todos os exemplos A9/AB do manual confirmam), ':' usa ooo
 * como seletor de symbol set (000–007) e ';' usa ooo como índice da fonte na ROM (AD, pág. 89).
 * Essas fontes internas têm tamanho nativo fixo (não documentado neste manual), escalado só por
 * h/v; usamos aqui um tamanho base único como aproximação razoável.
 * Só a fonte '9' usa ooo como tamanho de verdade: índice 000–006 → pontos (4–18pt) → dots
 * @DEFAULT_PRINTER_DPI, ou ID de fonte PCL (sem tamanho conhecido) para ooo fora dessa faixa.
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

  return DEFAULT
}

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

/**
 * Espaço físico da etiqueta (mm, dots na impressora) ↔ pixels do preview no canvas.
 *
 * - PPLA (A7): x, y, largura, altura em **dots** no **DPI da impressora** (ex. Argox 203).
 * - RND: Dots = floor((mm / 25.4) * DPI).
 * - Preview: 1 dot → px lógicos via PPI de referência do canvas (96) e escala visual opcional.
 */

export const DEFAULT_PRINTER_DPI = 203
export const DEFAULT_PREVIEW_SCREEN_SCALE = 2

/** DPIS comuns para seleção na UI (Argox/termicas). */
export const COMMON_PRINTER_DPIS = [203, 300, 600] as const

const SCREEN_PPI = 96

export const DEFAULT_LABEL_WIDTH_MM = 69
export const DEFAULT_LABEL_HEIGHT_MM = 37

/**
 * Milímetros → dots no papel (floor, como no RND).
 */
export function labelMmToPrinterDots(mm: number, printerDpi: number): number {
  if (!Number.isFinite(mm) || !Number.isFinite(printerDpi) || printerDpi <= 0) {
    return 0
  }
  return Math.floor((mm / 25.4) * printerDpi)
}

/**
 * Dots da impressora → pixels lógicos do canvas de preview.
 * Deve ser a MESMA função usada pelo PplaRendererService ao desenhar elementos.
 */
export function printerDotsToPreviewPx(
  dots: number,
  printerDpi: number,
  previewScreenScale: number,
): number {
  if (!Number.isFinite(dots) || !Number.isFinite(printerDpi) || printerDpi <= 0) {
    return 0
  }
  const scale = Number.isFinite(previewScreenScale) && previewScreenScale > 0
    ? previewScreenScale
    : 1
  return dots * (SCREEN_PPI / printerDpi) * scale
}

export function labelMmToPreviewPx(
  mm: number,
  printerDpi: number,
  previewScreenScale: number,
): number {
  const dots = labelMmToPrinterDots(mm, printerDpi)
  return printerDotsToPreviewPx(dots, printerDpi, previewScreenScale)
}

export function previewPxToLabelMm(
  px: number,
  printerDpi: number,
  previewScreenScale: number,
): number {
  if (!Number.isFinite(px) || !Number.isFinite(printerDpi) || printerDpi <= 0) {
    return 0
  }
  const scale = Number.isFinite(previewScreenScale) && previewScreenScale > 0
    ? previewScreenScale
    : 1
  const dots = px / ((SCREEN_PPI / printerDpi) * scale)
  return (dots * 25.4) / printerDpi
}

/** @deprecated Use labelMmToPreviewPx(mm, dpi, scale). */
export const LABEL_PREVIEW_DPI = DEFAULT_PRINTER_DPI
/** @deprecated Use DEFAULT_PREVIEW_SCREEN_SCALE. */
export const LABEL_PREVIEW_SCREEN_SCALE = DEFAULT_PREVIEW_SCREEN_SCALE

/** @deprecated Use labelMmToPreviewPx com DEFAULT_PRINTER_DPI. */
export function labelMmToCanvasPreviewPx(mm: number): number {
  return labelMmToPreviewPx(mm, DEFAULT_PRINTER_DPI, DEFAULT_PREVIEW_SCREEN_SCALE)
}

/** @deprecated Use previewPxToLabelMm. */
export function canvasPreviewPxToLabelMm(px: number): number {
  return previewPxToLabelMm(px, DEFAULT_PRINTER_DPI, DEFAULT_PREVIEW_SCREEN_SCALE)
}

/**
 * Physical label space (mm, printer dots) ↔ preview canvas pixels.
 *
 * - PPLA (A7): x, y, width, height are in **dots** at the **printer's DPI** (e.g. Argox 203).
 * - Rounding: dots = floor((mm / 25.4) * DPI).
 * - Preview: 1 dot → logical px via the canvas reference PPI (96) and an optional visual scale.
 */

export const DEFAULT_PRINTER_DPI = 203
export const DEFAULT_PREVIEW_SCREEN_SCALE = 2

/** Common DPI choices for the UI selector (Argox/thermal printers). */
export const COMMON_PRINTER_DPIS = [203, 300, 600] as const

const SCREEN_PPI = 96

export const DEFAULT_LABEL_WIDTH_MM = 69
export const DEFAULT_LABEL_HEIGHT_MM = 37

/**
 * Converts millimeters to printer dots (floored, matching the PPLA/RND convention).
 */
export function labelMmToPrinterDots(mm: number, printerDpi: number): number {
  if (!Number.isFinite(mm) || !Number.isFinite(printerDpi) || printerDpi <= 0) {
    return 0
  }
  return Math.floor((mm / 25.4) * printerDpi)
}

/**
 * Converts printer dots to logical preview-canvas pixels.
 * Must be the SAME function used by `PplaRendererService` when drawing elements, so the
 * on-screen preview and the size/position math stay consistent.
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

/** Converts millimeters directly to preview-canvas pixels (mm → dots → px). */
export function labelMmToPreviewPx(
  mm: number,
  printerDpi: number,
  previewScreenScale: number,
): number {
  const dots = labelMmToPrinterDots(mm, printerDpi)
  return printerDotsToPreviewPx(dots, printerDpi, previewScreenScale)
}

/** Inverse of `labelMmToPreviewPx`: converts preview-canvas pixels back to millimeters. */
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

/** @deprecated Use labelMmToPreviewPx with DEFAULT_PRINTER_DPI. */
export function labelMmToCanvasPreviewPx(mm: number): number {
  return labelMmToPreviewPx(mm, DEFAULT_PRINTER_DPI, DEFAULT_PREVIEW_SCREEN_SCALE)
}

/** @deprecated Use previewPxToLabelMm. */
export function canvasPreviewPxToLabelMm(px: number): number {
  return previewPxToLabelMm(px, DEFAULT_PRINTER_DPI, DEFAULT_PREVIEW_SCREEN_SCALE)
}

/**
 * Emits PPLA A7 lines — the inverse of parsing; format aligned with
 * [printer-ppla](https://github.com/gillianpalhano/printer-ppla) (`addText`, `addBarcode`, `addLine`, `addBox`).
 */

import type {
  AnyPplaElement,
  PrinterPplaBarcodePayload,
  PrinterPplaTextPayload,
  PplaBarcode,
  PplaBox,
  PplaGraphic,
  PplaLine,
  PplaText,
} from '@/lib/ppla-model'
import { rotationToDirectionChar } from '@/lib/ppla-model'
import { scaleMultiplierToPplaChar } from '@/lib/ppla-scale'

/** Zero-pads a number to 4 digits (A7 `yyyy`/`xxxx` coordinate fields). */
function pad4(n: number): string {
  return Math.max(0, Math.floor(n)).toString().padStart(4, '0')
}

/** Zero-pads a number to 3 digits (A7 `ooo`/thickness fields). */
function pad3(n: number): string {
  return Math.max(0, Math.floor(n)).toString().padStart(3, '0')
}

/** Normalizes a text `subfont` value into a 3-character field, padding numeric values and truncating others. */
function normalizePplaField3(value: string): string {
  if (/^\d+$/.test(value)) {
    return pad3(Number(value))
  }
  return value.slice(0, 3).padStart(3, '0')
}

/** Converts a `PplaText` element into the printer-ppla `addText` payload shape. */
export function pplaTextToPrinterPplaPayload(element: PplaText): PrinterPplaTextPayload {
  return {
    y: element.y,
    x: element.x,
    text: element.text,
    font: element.fontId,
    subFont: element.subfont,
    hScale: scaleMultiplierToPplaChar(element.widthMultiplier),
    vScale: scaleMultiplierToPplaChar(element.heightMultiplier),
    direction: rotationToDirectionChar(element.rotation),
  }
}

/** Converts a `PplaBarcode` element into the printer-ppla `addBarcode` payload shape. */
export function pplaBarcodeToPrinterPplaPayload(
  element: PplaBarcode,
): PrinterPplaBarcodePayload {
  return {
    y: element.y,
    x: element.x,
    data: element.data,
    type: element.barcodeType,
    wideBarWidth: scaleMultiplierToPplaChar(element.wideBarScale),
    narrowBarWidth: scaleMultiplierToPplaChar(element.narrowBarScale),
    height: element.height,
    direction: rotationToDirectionChar(element.rotation),
  }
}

/** Emits a text element as the `Rthvoooyyyyxxxx` + data line (same format as `addText`). */
export function emitPplaTextLine(element: PplaText): string {
  const p = pplaTextToPrinterPplaPayload(element)
  return `${p.direction}${p.font}${p.hScale}${p.vScale}${normalizePplaField3(p.subFont)}${pad4(p.y)}${pad4(p.x)}${p.text}`
}

/** Emits a barcode element as the `Rthvoooyyyyxxxx` + data line (same format as `addBarcode`). */
export function emitPplaBarcodeLine(element: PplaBarcode): string {
  const p = pplaBarcodeToPrinterPplaPayload(element)
  const heights = pad3(p.height)
  return `${p.direction}${p.type}${p.wideBarWidth}${p.narrowBarWidth}${heights}${pad4(p.y)}${pad4(p.x)}${p.data}`
}

/** Emits a line element, using the 4-digit (`l`) variant when any dimension exceeds 999, else the 3-digit (`L`) variant. */
export function emitPplaLineLine(element: PplaLine): string {
  const d = rotationToDirectionChar(element.rotation)
  if (element.width > 999 || element.height > 999) {
    const a = pad4(element.width)
    const b = pad4(element.height)
    return `${d}X11000${pad4(element.y)}${pad4(element.x)}l${a}${b}`
  }
  const a = pad3(element.width)
  const b = pad3(element.height)
  return `${d}X11000${pad4(element.y)}${pad4(element.x)}L${a}${b}`
}

/** Emits a box element, using the 4-digit (`b`) variant when any dimension exceeds 999, else the 3-digit (`B`) variant. */
export function emitPplaBoxLine(element: PplaBox): string {
  const d = rotationToDirectionChar(element.rotation)
  const useWide =
    element.width > 999 ||
    element.height > 999 ||
    element.thicknessTopBottom > 999 ||
    element.thicknessSides > 999
  if (useWide) {
    const a = pad4(element.width)
    const b = pad4(element.height)
    const t = pad4(element.thicknessTopBottom)
    const s = pad4(element.thicknessSides)
    return `${d}X11000${pad4(element.y)}${pad4(element.x)}b${a}${b}${t}${s}`
  }
  const a = pad3(element.width)
  const b = pad3(element.height)
  const t = pad3(element.thicknessTopBottom)
  const s = pad3(element.thicknessSides)
  return `${d}X11000${pad4(element.y)}${pad4(element.x)}B${a}${b}${t}${s}`
}

/** Emits a graphic reference line (`1Y11000yyyyxxxx<name>`), always direction '1' and name capped at 16 chars. */
export function emitPplaGraphicLine(element: PplaGraphic): string {
  return `1Y11000${pad4(element.y)}${pad4(element.x)}${element.name.slice(0, 16)}`
}

/** Dispatches to the matching `emitPpla*Line` function based on the element's kind. */
export function emitPplaElementLine(element: AnyPplaElement): string {
  if (element.type === 'text') {
    return emitPplaTextLine(element)
  }
  if (element.type === 'barcode') {
    return emitPplaBarcodeLine(element)
  }
  if (element.type === 'line') {
    return emitPplaLineLine(element)
  }
  if (element.type === 'box') {
    return emitPplaBoxLine(element)
  }
  if (element.type === 'graphic') {
    return emitPplaGraphicLine(element)
  }
  return ''
}

/** Emits a full array of elements to their corresponding PPLA source lines, in order. */
export function emitPplaElementsToLines(elements: AnyPplaElement[]): string[] {
  return elements.map(emitPplaElementLine)
}

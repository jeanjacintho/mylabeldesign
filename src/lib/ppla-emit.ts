/**
 * Emissão de linhas PPLA A7 — inverso do parse; formato alinhado a
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

function pad4(n: number): string {
  return Math.max(0, Math.floor(n)).toString().padStart(4, '0')
}

function pad3(n: number): string {
  return Math.max(0, Math.floor(n)).toString().padStart(3, '0')
}

function normalizePplaField3(value: string): string {
  if (/^\d+$/.test(value)) {
    return pad3(Number(value))
  }
  return value.slice(0, 3).padStart(3, '0')
}

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

/** Formato `Rthvoooyyyyxxxx` + dados (igual `addText`). */
export function emitPplaTextLine(element: PplaText): string {
  const p = pplaTextToPrinterPplaPayload(element)
  return `${p.direction}${p.font}${p.hScale}${p.vScale}${normalizePplaField3(p.subFont)}${pad4(p.y)}${pad4(p.x)}${p.text}`
}

/** Formato `Rthvoooyyyyxxxx` + dados (igual `addBarcode`). */
export function emitPplaBarcodeLine(element: PplaBarcode): string {
  const p = pplaBarcodeToPrinterPplaPayload(element)
  const heights = pad3(p.height)
  return `${p.direction}${p.type}${p.wideBarWidth}${p.narrowBarWidth}${heights}${pad4(p.y)}${pad4(p.x)}${p.data}`
}

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

export function emitPplaGraphicLine(element: PplaGraphic): string {
  return `1Y11000${pad4(element.y)}${pad4(element.x)}${element.name.slice(0, 16)}`
}

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

export function emitPplaElementsToLines(elements: AnyPplaElement[]): string[] {
  return elements.map(emitPplaElementLine)
}

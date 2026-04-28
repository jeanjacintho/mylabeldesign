/**
 * Modelo de primitivas PPLA — espelha o contrato de
 * [printer-ppla](https://github.com/gillianpalhano/printer-ppla) (`IText`, `IBarcode`, `ILine`, `IBox`, `TDirections`)
 * com coordenadas em **dots** (manual A7).
 */

/** Mesmo conjunto que `TDirections` em printer-ppla (`Direction.PORTRAIT` = `'1'`, …). */
export type PplaDirection = '1' | '2' | '3' | '4'

/** Aliases equivalentes a `Direction` em [printer-ppla](https://github.com/gillianpalhano/printer-ppla). */
export const PplaDirections = {
  PORTRAIT: '1' as const,
  REV_LAND: '2' as const,
  REV_PORT: '3' as const,
  LANDSCAP: '4' as const,
}

export type PplaElementKind = 'text' | 'barcode' | 'box' | 'line' | 'graphic'

export type PplaRotation = 0 | 90 | 180 | 270

export interface PplaElement {
  type: PplaElementKind
  x: number
  y: number
  rotation: PplaRotation
}

export interface PplaText extends PplaElement {
  type: 'text'
  text: string
  fontId: string
  widthMultiplier: number
  heightMultiplier: number
  subfont: string
}

export interface PplaBarcode extends PplaElement {
  type: 'barcode'
  barcodeType: string
  data: string
  height: number
  wideBarScale: number
  narrowBarScale: number
}

export interface PplaBox extends PplaElement {
  type: 'box'
  width: number
  height: number
  thicknessTopBottom: number
  thicknessSides: number
}

export interface PplaLine extends PplaElement {
  type: 'line'
  width: number
  height: number
}

export interface PplaGraphic extends PplaElement {
  type: 'graphic'
  name: string
}

export type AnyPplaElement = PplaText | PplaBarcode | PplaBox | PplaLine | PplaGraphic

export type PplaParseDiagnosticSeverity = 'warning' | 'error'

export interface PplaParseDiagnostic {
  lineNumber: number
  rawLine: string
  normalizedLine: string
  severity: PplaParseDiagnosticSeverity
  code: string
  message: string
}

/**
 * Metadados do job PPLA (bloco de sistema + estado dentro de L..E).
 * @see docs/PPLA_Parser_Guide.md
 */
export interface PplaPixelSize {
  w: number
  h: number
}

export interface PplaLabelState {
  /** cXXXX comprimento (1/100 pol); 0 = contínuo / a definir pelo conteúdo */
  continuousLengthHundredths: number | null
  /** fXXX posição de parada (1/100 pol) */
  stopPositionHundredths: number | null
  /** Largura lógica em 1/100 pol (quando derivada de c ou fallback) */
  widthHundredths: number | null
  /** Altura lógica: c, f, ou inferida */
  heightHundredths: number | null
  /** Oxxxx — início de impressão vs 0220; no preview: ver `printStartOffsetDotsX` em ppla-interpreter (eixo X) */
  printStartHundredths: number | null
  /** Rxxxx de sistema (fora de L..E) — offset vertical (1/100 pol) */
  systemVerticalOffsetHundredths: number | null
  /** Dwh — tamanho de pixel; default D22 = 2x2 */
  pixelSize: PplaPixelSize
  /** H02–H20 */
  heat: number | null
  /** Qxxxx */
  quantity: number | null
  /** Cxxxx no bloco de formatação — margem esquerda (1/100 pol), último valor vence */
  formatLeftMarginHundredths: number
  /** Rxxxx no bloco L..E — deslocamento vertical (1/100 pol), último valor vence */
  formatVerticalOffsetHundredths: number
  /** A1 = XOR, A2 = OR; no preview usa OR por defeito (guia) */
  logicMode: 1 | 2
  /** M sem dígitos — espelho (toggle simples) */
  mirror: boolean
  /** Último c activou modo contínuo até e/r */
  continuousLabelMode: boolean
  /** m / n */
  measurementIsMetric: boolean
}

export function createEmptyPplaLabelState(): PplaLabelState {
  return {
    continuousLengthHundredths: null,
    stopPositionHundredths: null,
    widthHundredths: null,
    heightHundredths: null,
    printStartHundredths: null,
    systemVerticalOffsetHundredths: null,
    pixelSize: { w: 2, h: 2 },
    heat: null,
    quantity: null,
    formatLeftMarginHundredths: 0,
    formatVerticalOffsetHundredths: 0,
    logicMode: 1,
    mirror: false,
    continuousLabelMode: false,
    measurementIsMetric: false,
  }
}

export interface PplaParseResult {
  label: PplaLabelState
  elements: AnyPplaElement[]
  diagnostics: PplaParseDiagnostic[]
}

/** Payload equivalente a `IText` do printer-ppla (addText). */
export interface PrinterPplaTextPayload {
  y: number
  x: number
  text: string
  font: string
  subFont: string
  hScale: string
  vScale: string
  direction: PplaDirection
}

/** Payload equivalente a `IBarcode` (addBarcode). */
export interface PrinterPplaBarcodePayload {
  y: number
  x: number
  data: string
  type: string
  wideBarWidth: string
  narrowBarWidth: string
  height: number
  direction: PplaDirection
}

export function mapDirectionCharToRotation(direction: string): PplaRotation {
  if (direction === '1') {
    return 0
  }
  if (direction === '2') {
    return 90
  }
  if (direction === '3') {
    return 180
  }
  if (direction === '4') {
    return 270
  }
  return 0
}

export function rotationToDirectionChar(rotation: PplaRotation): PplaDirection {
  if (rotation === 0) {
    return PplaDirections.PORTRAIT
  }
  if (rotation === 90) {
    return PplaDirections.REV_LAND
  }
  if (rotation === 180) {
    return PplaDirections.REV_PORT
  }
  if (rotation === 270) {
    return PplaDirections.LANDSCAP
  }
  return PplaDirections.PORTRAIT
}

export function mapLegacyRotationIndexToDegrees(rotationCode: number): PplaRotation {
  if (rotationCode === 1) {
    return 90
  }
  if (rotationCode === 2) {
    return 180
  }
  if (rotationCode === 3) {
    return 270
  }
  return 0
}

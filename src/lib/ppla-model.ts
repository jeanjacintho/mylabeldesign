/**
 * PPLA primitive model — mirrors the contract of
 * [printer-ppla](https://github.com/gillianpalhano/printer-ppla) (`IText`, `IBarcode`, `ILine`, `IBox`, `TDirections`)
 * with coordinates in **dots** (A7 manual).
 */

/** Same set as `TDirections` in printer-ppla (`Direction.PORTRAIT` = `'1'`, …). */
export type PplaDirection = '1' | '2' | '3' | '4'

/** Aliases equivalent to `Direction` in [printer-ppla](https://github.com/gillianpalhano/printer-ppla). */
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
  /** State of `M` (mirror) at the moment this element was declared (A6 guide). */
  mirror?: boolean
  /** State of `A1`/`A2` (XOR/OR) at the moment this element was declared (A6 guide). */
  logicMode?: 1 | 2
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
 * Metadata for the PPLA job (system block + state inside L..E).
 * @see docs/PPLA_Parser_Guide.md
 */
export interface PplaPixelSize {
  w: number
  h: number
}

export interface PplaLabelState {
  /** cXXXX length (1/100 inch); 0 = continuous / determined by content */
  continuousLengthHundredths: number | null
  /** fXXX stop position (1/100 inch) */
  stopPositionHundredths: number | null
  /** Logical width in 1/100 inch (when derived from c or a fallback) */
  widthHundredths: number | null
  /** Logical height: c, f, or inferred */
  heightHundredths: number | null
  /** Oxxxx — print start vs 0220; see `printStartOffsetDotsX` in ppla-parse-preamble (X axis) */
  printStartHundredths: number | null
  /** System-level Rxxxx (outside L..E) — vertical offset (1/100 inch) */
  systemVerticalOffsetHundredths: number | null
  /** Dwh — pixel size; default D22 = 2x2 */
  pixelSize: PplaPixelSize
  /** H02–H20 */
  heat: number | null
  /** Qxxxx */
  quantity: number | null
  /** Cxxxx inside the formatting block — left margin (1/100 inch), last value wins */
  formatLeftMarginHundredths: number
  /** Rxxxx inside the L..E block — vertical offset (1/100 inch), last value wins */
  formatVerticalOffsetHundredths: number
  /** A1 = XOR, A2 = OR; the preview defaults to OR (guide) */
  logicMode: 1 | 2
  /** Bare `M` (no digits) — mirror toggle */
  mirror: boolean
  /** Last `c` activated continuous mode until e/r */
  continuousLabelMode: boolean
  /** m / n */
  measurementIsMetric: boolean
}

/** Creates a fresh `PplaLabelState` with all PPLA defaults (D22 pixel size, XOR logic mode, etc). */
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

/** Margin/offset shift (A6 guide, `C`/`R` inside the block) already added to an element's x/y. */
export interface PplaElementFormatShift {
  dx: number
  dy: number
}

export interface PplaParseResult {
  label: PplaLabelState
  elements: AnyPplaElement[]
  diagnostics: PplaParseDiagnostic[]
  /**
   * Source line index (0-based, into the already-split line array) for each entry in
   * `elements`, in the same order. Used by the visual editor to surgically replace only
   * that element's line, without touching the rest of the code.
   */
  elementSourceLines: number[]
  /**
   * The `C`/`R` shift (A6 guide) exactly as it was applied to each element at the moment
   * it was read — this can't be reconstructed from the final `label`, because `C`/`R` can
   * change multiple times within the same block. Must be inverted when rewriting the raw
   * line of a visually-edited element.
   */
  elementFormatShifts: PplaElementFormatShift[]
}

/** Payload equivalent to printer-ppla's `IText` (addText). */
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

/** Payload equivalent to printer-ppla's `IBarcode` (addBarcode). */
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

/** Converts an A7 direction character ('1'-'4') to its rotation in degrees. */
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

/** Inverse of `mapDirectionCharToRotation`: converts a rotation in degrees back to its A7 direction character. */
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

/** Converts the legacy `A<rotation>...` text format's single-digit rotation code (0-3) to degrees. */
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

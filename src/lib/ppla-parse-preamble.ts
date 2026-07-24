import type { AnyPplaElement } from '@/lib/ppla-model'

const LABEL_FORMAT_MIN_DOT_INCH_OS204 = 0.0049

/** Standard Argox manual pattern `<STX>Oxxxx` (e.g. 0220). */
const DEFAULT_PRINT_START_HUNDREDTHS = 220

const IGNORED_LABEL_FORMATTING_LINE_PATTERNS = [
  /^D[12][123]$/,
  /^M\d{4}$/,
  /^M$/,
  /^[mn]$/,
  /^c\d{4}$/,
  /^O\d{4}$/,
  /^R\d{4}$/,
  /^f\d{3}$/,
  /^Q\d{4}$/,
  /^H\d{2}$/,
  /^E$/,
  /^L$/,
  /^[er]$/,
  /^PF$/,
  /^SF$/,
  /^S[0-6]$/,
  /^Sp$/,
]

const LEADING_INVISIBLE_FORMAT_CHARS =
  /^[\ufeff\u200b-\u200f\u202a-\u202e\u2066-\u2069]+/
/** Strips leading zero-width/bidi marks (e.g. LRM) so a leftover BOM-like prefix doesn't hide the real first character. */
function stripLeadingInvisibleFormatChars(s: string): string {
  let out = s
  while (LEADING_INVISIBLE_FORMAT_CHARS.test(out)) {
    out = out.replace(LEADING_INVISIBLE_FORMAT_CHARS, '')
  }
  return out
}

/**
 * Normalizes a single PPLA job line:
 * - trims both ends;
 * - removes a leading BOM (U+FEFF);
 * - removes **only** C0 control characters (and DEL) **in the prefix**, before the first
 *   printable character — typically `<STX>`, `<SOH>`, etc. (Argox manual).
 * - removes zero-width/bidi marks in the prefix (e.g. LRM) so the A7 direction digit
 *   `1`–`4` is recognized after pasting text from editors or PDFs.
 *
 * Does not scan the rest of the line: the `data` field after the 15-character header may
 * contain TAB or other characters that used to get stripped and broke parsing/rendering.
 */
export function stripPplaLineControls(line: string): string {
  const trimmed = line.trim().replace(/^\ufeff+/, '')
  if (!trimmed) {
    return ''
  }

  let i = 0
  while (i < trimmed.length) {
    const codePoint = trimmed.codePointAt(i)
    if (codePoint === undefined) {
      break
    }
    if (codePoint < 32 || codePoint === 127) {
      i += codePoint > 0xffff ? 2 : 1
      continue
    }
    break
  }

  return stripLeadingInvisibleFormatChars(trimmed.slice(i)).trimEnd()
}

/** Returns true for lines that are known label-formatting noise safe to ignore (outside a label block). */
export function isIgnorablePplaFormattingLine(line: string): boolean {
  return IGNORED_LABEL_FORMATTING_LINE_PATTERNS.some(re => re.test(line))
}

/** Scans the raw PPLA code for a `Dwh` command and estimates the printer's coordinate DPI from it. */
export function estimateCoordinateDpiFromPplaCode(pplaCode: string): number | null {
  const lines = pplaCode.split(/\r\n|\r|\n/)
  for (const raw of lines) {
    const s = stripPplaLineControls(raw)
    const m = /^D([12])([123])$/.exec(s)
    if (m) {
      const w = m[1]
      const widthFactor = w === '1' ? 1 : 2
      const dotWidthInch = LABEL_FORMAT_MIN_DOT_INCH_OS204 * widthFactor
      return Math.round(1 / dotWidthInch)
    }
  }
  return null
}

export interface PplaLabelPreamble {
  continuousLabelModeActive: boolean
  measurementIsMetric: boolean
  printStartHundredthsInch: number | null
  verticalOffsetHundredthsInch: number | null
}

/**
 * Oxxxx relative to the 0220 default: X offset (inch/mm) in **dots** for the preview.
 * (docs/ppla-interpreter.md; the PPLA guide's table 3.1 mentions the vertical axis — the
 * Argox manual/this preview use the horizontal-offset convention instead.)
 */
export function printStartOffsetDotsX(
  preamble: PplaLabelPreamble,
  coordinateDpi: number,
): number {
  if (preamble.continuousLabelModeActive) {
    return 0
  }
  if (preamble.printStartHundredthsInch === null) {
    return 0
  }
  if (!Number.isFinite(coordinateDpi) || coordinateDpi <= 0) {
    return 0
  }
  const deltaHundredths =
    preamble.printStartHundredthsInch - DEFAULT_PRINT_START_HUNDREDTHS
  const deltaBaseUnits = deltaHundredths / 100
  if (preamble.measurementIsMetric) {
    return (deltaBaseUnits / 25.4) * coordinateDpi
  }
  return deltaBaseUnits * coordinateDpi
}

/** Converts the system-level vertical offset (`R` outside the L..E block) to a dots shift for the Y axis. */
export function verticalPrintOffsetDotsY(
  preamble: PplaLabelPreamble,
  coordinateDpi: number,
): number {
  if (preamble.verticalOffsetHundredthsInch === null) {
    return 0
  }
  if (!Number.isFinite(coordinateDpi) || coordinateDpi <= 0) {
    return 0
  }
  const baseUnits = preamble.verticalOffsetHundredthsInch / 100
  if (preamble.measurementIsMetric) {
    return (baseUnits / 25.4) * coordinateDpi
  }
  return baseUnits * coordinateDpi
}

/** Translates every element's x/y by the given dots delta (used to apply the print-start/vertical-offset shifts). */
export function shiftPplaElements(
  elements: AnyPplaElement[],
  deltaXDots: number,
  deltaYDots: number,
): AnyPplaElement[] {
  if (deltaXDots === 0 && deltaYDots === 0) {
    return elements
  }
  return elements.map(el => {
    return {
      ...el,
      x: el.x + deltaXDots,
      y: el.y + deltaYDots,
    }
  })
}

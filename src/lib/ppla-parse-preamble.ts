import type { AnyPplaElement } from '@/lib/ppla-model'

const LABEL_FORMAT_MIN_DOT_INCH_OS204 = 0.0049

/** Padrão manual Argox `<STX>Oxxxx` (ex.: 0220). */
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
  /^[\uFEFF\u200B-\u200F\u202A-\u202E\u2066-\u2069]+/
function stripLeadingInvisibleFormatChars(s: string): string {
  let out = s
  while (LEADING_INVISIBLE_FORMAT_CHARS.test(out)) {
    out = out.replace(LEADING_INVISIBLE_FORMAT_CHARS, '')
  }
  return out
}

/**
 * Normaliza uma linha de job PPLA:
 * - `trim` nas pontas;
 * - remove BOM (U+FEFF) no início;
 * - remove **apenas** caracteres de controlo C0 (e DEL) **no prefixo** antes do primeiro carácter
 *   imprimível — típico `<STX>`, `<SOH>`, etc. (manual Argox).
 * - remove marcas de largura zero / bidi no prefixo (ex.: LRM) para o dígito de direção A7 `1`–`4`
 *   ser reconhecido após colar texto de editores ou PDFs.
 *
 * Não percorre o resto da linha: o campo `data` após o cabeçalho de 15 caracteres pode conter TAB
 * ou outros caracteres que antes eram apagados e quebravam o parse/render.
 */
export function stripPplaLineControls(line: string): string {
  const trimmed = line.trim().replace(/^\uFEFF+/, '')
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

export function isIgnorablePplaFormattingLine(line: string): boolean {
  return IGNORED_LABEL_FORMATTING_LINE_PATTERNS.some(re => re.test(line))
}

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
 * Oxxxx frente a 0220: offset em X (polegada/mm) em **dots** no preview.
 * (docs/ppla-interpreter.md; o guia PPLA tabela 3.1 cita eixo vertical — o manual Argox/este preview usa a convenção de deslocamento horizontal.)
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

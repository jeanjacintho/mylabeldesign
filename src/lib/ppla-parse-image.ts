import { DEFAULT_PRINTER_DPI } from '@/lib/label-units'
import type {
  AnyPplaElement,
  PplaBarcode,
  PplaBox,
  PplaGraphic,
  PplaLine,
  PplaLabelState,
  PplaParseDiagnostic,
  PplaParseResult,
  PplaText,
} from '@/lib/ppla-model'
import {
  createEmptyPplaLabelState,
  mapDirectionCharToRotation,
  mapLegacyRotationIndexToDegrees,
  type PplaRotation,
} from '@/lib/ppla-model'
import type { PplaLabelPreamble } from '@/lib/ppla-parse-preamble'
import {
  isIgnorablePplaFormattingLine,
  stripPplaLineControls,
} from '@/lib/ppla-parse-preamble'
import { parseScaleChar } from '@/lib/ppla-scale'

const A7_HEADER_LENGTH = 15
const GRAPHIC_NAME_MAX_LENGTH = 16

export const isIgnorableLabelFormattingLine = isIgnorablePplaFormattingLine

interface ParsedLineResult {
  element: AnyPplaElement | null
  diagnostic: PplaParseDiagnostic | null
}

function createDiagnostic(
  lineNumber: number,
  rawLine: string,
  normalizedLine: string,
  code: string,
  message: string,
  severity: PplaParseDiagnostic['severity'] = 'warning',
): PplaParseDiagnostic {
  return {
    lineNumber,
    rawLine,
    normalizedLine,
    severity,
    code,
    message,
  }
}

function isTextFontTypeChar(t: string): boolean {
  if (t >= '0' && t <= '9') {
    return true
  }
  return t === ':' || t === ';'
}

function isBarcodeTypeChar(t: string): boolean {
  if (t >= 'A' && t <= 'T') {
    return true
  }
  return t >= 'a' && t <= 'z'
}

function isScaleChar(char: string): boolean {
  if (char >= '0' && char <= '9') {
    return true
  }
  return char >= 'A' && char <= 'O'
}

function parseFourDigitField(value: string): number | null {
  if (!/^\d{4}$/.test(value)) {
    return null
  }
  return Number(value)
}

function parseThreeDigitField(value: string): number | null {
  if (!/^\d{3}$/.test(value)) {
    return null
  }
  return Number(value)
}

function parseA7HeaderCoordinates(header: string): { x: number; y: number } | null {
  const y = parseFourDigitField(header.slice(7, 11))
  const x = parseFourDigitField(header.slice(11, 15))

  if (x === null || y === null) {
    return null
  }

  return { x, y }
}

function parseTextHeader(
  header: string,
  data: string,
  rotation: PplaRotation,
): PplaText | null {
  const h = header[2]
  const v = header[3]
  const ooo = header.slice(4, 7)
  const coordinates = parseA7HeaderCoordinates(header)

  const widthMultiplier = parseScaleChar(h)
  const heightMultiplier = parseScaleChar(v)

  if (
    coordinates === null ||
    !isScaleChar(h) ||
    !isScaleChar(v) ||
    !/^\d{3}$/.test(ooo)
  ) {
    return null
  }

  return {
    type: 'text',
    x: coordinates.x,
    y: coordinates.y,
    rotation,
    fontId: header[1],
    widthMultiplier,
    heightMultiplier,
    subfont: ooo,
    text: data,
  }
}

function parseBarcodeHeader(
  header: string,
  data: string,
  rotation: PplaRotation,
): PplaBarcode | null {
  const t = header[1]
  const h = header[2]
  const v = header[3]
  const ooo = header.slice(4, 7)
  const coordinates = parseA7HeaderCoordinates(header)

  const height = parseThreeDigitField(ooo)
  const wideBarScale = parseScaleChar(h)
  const narrowBarScale = parseScaleChar(v)

  if (
    coordinates === null ||
    height === null ||
    !isBarcodeTypeChar(t) ||
    !isScaleChar(h) ||
    !isScaleChar(v)
  ) {
    return null
  }

  return {
    type: 'barcode',
    x: coordinates.x,
    y: coordinates.y,
    rotation,
    barcodeType: t,
    data,
    height,
    wideBarScale,
    narrowBarScale,
  }
}

function tryParseBox(line: string): PplaBox | null {
  const box3 =
    /^([1-4])X11000(\d{4})(\d{4})B(\d{3})(\d{3})(\d{3})(\d{3})$/
  const m3 = line.match(box3)
  if (m3) {
    const rotation = mapDirectionCharToRotation(m3[1])
    const y = Number(m3[2])
    const x = Number(m3[3])
    const width = Number(m3[4])
    const height = Number(m3[5])
    const ttt = Number(m3[6])
    const sss = Number(m3[7])
    if (
      [y, x, width, height, ttt, sss].some(n => Number.isNaN(n))
    ) {
      return null
    }
    return {
      type: 'box',
      x,
      y,
      rotation,
      width,
      height,
      thicknessTopBottom: ttt,
      thicknessSides: sss,
    }
  }

  const box4 =
    /^([1-4])X11000(\d{4})(\d{4})b(\d{4})(\d{4})(\d{4})(\d{4})$/
  const m4 = line.match(box4)
  if (m4) {
    const rotation = mapDirectionCharToRotation(m4[1])
    const y = Number(m4[2])
    const x = Number(m4[3])
    const width = Number(m4[4])
    const height = Number(m4[5])
    const tttt = Number(m4[6])
    const ssss = Number(m4[7])
    if (
      [y, x, width, height, tttt, ssss].some(n => Number.isNaN(n))
    ) {
      return null
    }
    return {
      type: 'box',
      x,
      y,
      rotation,
      width,
      height,
      thicknessTopBottom: tttt,
      thicknessSides: ssss,
    }
  }

  return null
}

function tryParseLine(line: string): PplaLine | null {
  const line3 = /^([1-4])X11000(\d{4})(\d{4})L(\d{3})(\d{3})$/
  const m3 = line.match(line3)
  if (m3) {
    const rotation = mapDirectionCharToRotation(m3[1])
    const y = Number(m3[2])
    const x = Number(m3[3])
    const width = Number(m3[4])
    const height = Number(m3[5])
    if ([y, x, width, height].some(n => Number.isNaN(n))) {
      return null
    }
    return {
      type: 'line',
      x,
      y,
      rotation,
      width,
      height,
    }
  }

  const line4 = /^([1-4])X11000(\d{4})(\d{4})l(\d{4})(\d{4})$/
  const m4 = line.match(line4)
  if (m4) {
    const rotation = mapDirectionCharToRotation(m4[1])
    const y = Number(m4[2])
    const x = Number(m4[3])
    const width = Number(m4[4])
    const height = Number(m4[5])
    if ([y, x, width, height].some(n => Number.isNaN(n))) {
      return null
    }
    return {
      type: 'line',
      x,
      y,
      rotation,
      width,
      height,
    }
  }

  return null
}

function tryParseLegacyText(line: string): PplaText | null {
  const textRegex =
    /^A(?<rotation>[0-3])(?<fontId>[A-Za-z0-9])(?<widthMul>\d)(?<heightMul>\d)(?<x>\d+),(?<y>\d+),"(?<text>.*)"$/

  const match = line.match(textRegex)
  if (!match || !match.groups) {
    return null
  }

  const rotationIndex = Number(match.groups.rotation)
  const rotation = mapLegacyRotationIndexToDegrees(rotationIndex)

  const x = Number(match.groups.x)
  const y = Number(match.groups.y)
  const widthMultiplier = Number(match.groups.widthMul)
  const heightMultiplier = Number(match.groups.heightMul)
  const fontId = match.groups.fontId
  const text = match.groups.text

  if (
    Number.isNaN(x) ||
    Number.isNaN(y) ||
    Number.isNaN(widthMultiplier) ||
    Number.isNaN(heightMultiplier)
  ) {
    return null
  }

  return {
    type: 'text',
    x,
    y,
    rotation,
    text,
    fontId,
    widthMultiplier,
    heightMultiplier,
    subfont: '000',
  }
}

function tryParseLegacyBox(line: string): PplaBox | null {
  const boxRegex = /^X(?<x>\d+),(?<y>\d+),(?<width>\d+),(?<height>\d+),(?<thickness>\d+)$/

  const match = line.match(boxRegex)
  if (!match || !match.groups) {
    return null
  }

  const x = Number(match.groups.x)
  const y = Number(match.groups.y)
  const width = Number(match.groups.width)
  const height = Number(match.groups.height)
  const thickness = Number(match.groups.thickness)

  if (
    Number.isNaN(x) ||
    Number.isNaN(y) ||
    Number.isNaN(width) ||
    Number.isNaN(height) ||
    Number.isNaN(thickness)
  ) {
    return null
  }

  return {
    type: 'box',
    x,
    y,
    rotation: 0,
    width,
    height,
    thicknessTopBottom: thickness,
    thicknessSides: thickness,
  }
}

function tryParseGraphicReference(line: string): PplaGraphic | null {
  const match = /^1Y11000(\d{4})(\d{4})(.{1,16})$/.exec(line)
  if (!match) {
    return null
  }

  const y = Number(match[1])
  const x = Number(match[2])
  const name = match[3].trim()

  if (Number.isNaN(x) || Number.isNaN(y) || !name) {
    return null
  }

  return {
    type: 'graphic',
    x,
    y,
    rotation: 0,
    name,
  }
}

const LABEL_NOISE_LINE_PATTERNS: RegExp[] = [
  /^PF$/,
  /^SF$/,
  /^Sp$/,
  /^S[0-6]$/,
  /^DL$/,
  /^KI/,
]

function isLabelContextNoiseLine(line: string): boolean {
  return LABEL_NOISE_LINE_PATTERNS.some(re => re.test(line))
}

function resetLabelBlockFormatting(s: PplaLabelState): void {
  s.formatLeftMarginHundredths = 0
  s.formatVerticalOffsetHundredths = 0
  s.pixelSize = { w: 2, h: 2 }
  s.heat = null
  s.quantity = null
  s.logicMode = 1
  s.mirror = false
}

function tryConsumePplaStateCommand(
  line: string,
  s: PplaLabelState,
  inLabel: boolean,
): boolean {
  if (line === 'm') {
    s.measurementIsMetric = true
    return true
  }
  if (line === 'n') {
    s.measurementIsMetric = false
    return true
  }
  if (line === 'e' || line === 'r') {
    s.continuousLabelMode = false
    return true
  }

  const cM = /^c(\d{4})$/i.exec(line)
  if (cM) {
    s.continuousLabelMode = true
    const v = Number(cM[1])
    s.continuousLengthHundredths = v
    if (v > 0) {
      s.heightHundredths = v
    }
    return true
  }

  const fM = /^f(\d{3})$/i.exec(line)
  if (fM) {
    const v = Number(fM[1])
    s.stopPositionHundredths = v
    s.heightHundredths = v
    return true
  }

  const oM = /^O(\d{4})$/i.exec(line)
  if (oM) {
    s.printStartHundredths = Number(oM[1])
    return true
  }

  if (/^M\d{4}$/i.test(line)) {
    return true
  }

  if (line === 'M') {
    if (inLabel) {
      s.mirror = !s.mirror
    }
    return true
  }

  const dM = /^D([12])([123])$/i.exec(line)
  if (dM) {
    s.pixelSize = {
      w: Number(dM[1]),
      h: Number(dM[2]),
    }
    return true
  }

  const hM = /^H(\d{2})$/i.exec(line)
  if (hM) {
    s.heat = Number(hM[1])
    return true
  }

  const qM = /^Q(\d{4})$/i.exec(line)
  if (qM) {
    s.quantity = Number(qM[1])
    return true
  }

  const cMargin = /^C(\d{4})$/i.exec(line)
  if (cMargin) {
    s.formatLeftMarginHundredths = Number(cMargin[1])
    return true
  }

  const rM = /^R(\d{4})$/i.exec(line)
  if (rM) {
    const v = Number(rM[1])
    if (inLabel) {
      s.formatVerticalOffsetHundredths = v
    } else {
      s.systemVerticalOffsetHundredths = v
    }
    return true
  }

  const aM = /^A([12])$/.exec(line)
  if (aM) {
    s.logicMode = Number(aM[1]) as 1 | 2
    return true
  }

  return false
}

function applyLabelFormatShifts(
  el: AnyPplaElement,
  s: PplaLabelState,
  printerDpi: number,
): AnyPplaElement {
  if (s.formatLeftMarginHundredths === 0 && s.formatVerticalOffsetHundredths === 0) {
    return el
  }
  const dx = (s.formatLeftMarginHundredths / 100) * printerDpi
  const dy = (s.formatVerticalOffsetHundredths / 100) * printerDpi
  return {
    ...el,
    x: el.x + dx,
    y: el.y + dy,
  }
}

export function tryParseImageFormattingCommand(line: string): AnyPplaElement | null {
  if (line.length < 2) {
    return null
  }

  const r = line[0]
  if (r < '1' || r > '4') {
    return null
  }

  const graphic = tryParseGraphicReference(line)
  if (graphic) {
    return graphic
  }

  if (line[1] === 'X') {
    const box = tryParseBox(line)
    if (box) {
      return box
    }
    const lineEl = tryParseLine(line)
    if (lineEl) {
      return lineEl
    }
    return null
  }

  if (line.length < A7_HEADER_LENGTH) {
    return null
  }

  const header = line.slice(0, A7_HEADER_LENGTH)
  const data = line.slice(A7_HEADER_LENGTH)
  const rotation = mapDirectionCharToRotation(r)
  const t = header[1]

  if (isTextFontTypeChar(t)) {
    return parseTextHeader(header, data, rotation)
  }

  return parseBarcodeHeader(header, data, rotation)
}

function parsePplaElementLine(
  rawLine: string,
  lineNumber: number,
): ParsedLineResult {
  const line = stripPplaLineControls(rawLine)

  if (!line) {
    return { element: null, diagnostic: null }
  }

  if (isLabelContextNoiseLine(line)) {
    return { element: null, diagnostic: null }
  }

  const imageElement = tryParseImageFormattingCommand(line)
  if (imageElement) {
    return { element: imageElement, diagnostic: null }
  }

  const legacyText = tryParseLegacyText(line)
  if (legacyText) {
    return {
      element: legacyText,
      diagnostic: createDiagnostic(
        lineNumber,
        rawLine,
        line,
        'legacy-text-format',
        'Legacy A... text format parsed; prefer A7 Rthvoooyyyyxxxx[data].',
      ),
    }
  }

  const legacyBox = tryParseLegacyBox(line)
  if (legacyBox) {
    return {
      element: legacyBox,
      diagnostic: createDiagnostic(
        lineNumber,
        rawLine,
        line,
        'legacy-box-format',
        'Legacy X... box format parsed; prefer A7 RX11000yyyyxxxxB...',
      ),
    }
  }

  if (line.length > A7_HEADER_LENGTH + GRAPHIC_NAME_MAX_LENGTH && /^1Y11000/.test(line)) {
    return {
      element: null,
      diagnostic: createDiagnostic(
        lineNumber,
        rawLine,
        line,
        'invalid-graphic-name',
        'PPLA graphic reference names must be 1 to 16 characters.',
        'error',
      ),
    }
  }

  if (/^[1-4]/.test(line)) {
    return {
      element: null,
      diagnostic: createDiagnostic(
        lineNumber,
        rawLine,
        line,
        'invalid-a7-command',
        'Unsupported or invalid PPLA A7 formatting command.',
        'error',
      ),
    }
  }

  return {
    element: null,
    diagnostic: createDiagnostic(
      lineNumber,
      rawLine,
      line,
      'unsupported-line',
      'Ignored unsupported PPLA line.',
    ),
  }
}

export interface ParsePplaElementsOptions {
  normalizeLineEndings?: boolean
  /** 1/100 pol → deslocamento em dots (mesma grelha que x/y) para C/R de formatação */
  printerDpi?: number
}

function finalizeLabelState(s: PplaLabelState): void {
  if (s.heightHundredths == null && s.stopPositionHundredths != null) {
    s.heightHundredths = s.stopPositionHundredths
  }
}

export function splitPplaLines(
  pplaCode: string,
  normalizeLineEndings?: boolean,
): string[] {
  if (normalizeLineEndings === true) {
    const normalized = pplaCode.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    return normalized.split('\n')
  }

  return pplaCode.split(/\r\n|\r|\n/)
}

export function parsePplaElementsFromCode(
  pplaCode: string,
  options: ParsePplaElementsOptions = {},
): AnyPplaElement[] {
  return parsePplaCode(pplaCode, options).elements
}

export function parsePplaCode(
  pplaCode: string,
  options: ParsePplaElementsOptions = {},
): PplaParseResult {
  const lines = splitPplaLines(pplaCode, options.normalizeLineEndings)
  const label = createEmptyPplaLabelState()
  const elements: AnyPplaElement[] = []
  const diagnostics: PplaParseDiagnostic[] = []
  const printerDpi = options.printerDpi ?? DEFAULT_PRINTER_DPI

  let inLabel = false
  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index]
    const line = stripPplaLineControls(rawLine)
    if (!line) {
      continue
    }

    if (line === 'E' && inLabel) {
      inLabel = false
      continue
    }
    if (line === 'E' && !inLabel) {
      continue
    }

    if (line === 'L' && inLabel) {
      resetLabelBlockFormatting(label)
      continue
    }

    if (line === 'L' && !inLabel) {
      inLabel = true
      resetLabelBlockFormatting(label)
      continue
    }

    if (tryConsumePplaStateCommand(line, label, inLabel)) {
      continue
    }

    if (inLabel) {
      if (isLabelContextNoiseLine(line)) {
        continue
      }
    }

    if (!inLabel && isIgnorablePplaFormattingLine(line)) {
      continue
    }

    const result = parsePplaElementLine(rawLine, index + 1)
    if (result.element) {
      elements.push(
        applyLabelFormatShifts(
          result.element,
          label,
          printerDpi,
        ),
      )
    }
    if (result.diagnostic) {
      diagnostics.push(result.diagnostic)
    }
  }

  finalizeLabelState(label)
  return { label, elements, diagnostics }
}

export function parsePplaLabelPreamble(pplaCode: string): PplaLabelPreamble {
  const { label } = parsePplaCode(pplaCode, {
    normalizeLineEndings: true,
    printerDpi: DEFAULT_PRINTER_DPI,
  })
  return {
    continuousLabelModeActive: label.continuousLabelMode,
    measurementIsMetric: label.measurementIsMetric,
    printStartHundredthsInch: label.printStartHundredths,
    verticalOffsetHundredthsInch: label.systemVerticalOffsetHundredths,
  }
}

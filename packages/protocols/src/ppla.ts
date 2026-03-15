import type { LabelElementModel, ParsedLabelDocument } from '@openlabel/core'

const DEFAULT_DPI = 203

// Dot-based metrics for resident fonts. '9' = ASD smooth, ':' = Courier.
const RESIDENT_FONT_METRICS: Record<string, {
  family: string
  cellWidthDots: number
  cellHeightDots: number
  trackingDots: number
}> = {
  '0': { family: 'PPLA Font 0', cellWidthDots: 8, cellHeightDots: 12, trackingDots: 1 },
  '1': { family: 'PPLA Font 1', cellWidthDots: 10, cellHeightDots: 14, trackingDots: 1 },
  '2': { family: 'PPLA Font 2', cellWidthDots: 12, cellHeightDots: 16, trackingDots: 1 },
  '3': { family: 'PPLA Font 3', cellWidthDots: 14, cellHeightDots: 20, trackingDots: 2 },
  '4': { family: 'PPLA Font 4', cellWidthDots: 16, cellHeightDots: 24, trackingDots: 2 },
  '5': { family: 'PPLA Font 5', cellWidthDots: 20, cellHeightDots: 28, trackingDots: 2 },
  '6': { family: 'PPLA Font 6', cellWidthDots: 24, cellHeightDots: 32, trackingDots: 2 },
  '7': { family: 'PPLA Font 7', cellWidthDots: 28, cellHeightDots: 40, trackingDots: 3 },
  '8': { family: 'PPLA Font 8', cellWidthDots: 32, cellHeightDots: 48, trackingDots: 3 },
  '9': { family: 'PPLA Smooth Font', cellWidthDots: 12, cellHeightDots: 16, trackingDots: 1 },
  ':': { family: 'PPLA Courier', cellWidthDots: 10, cellHeightDots: 14, trackingDots: 1 },
}

function dotsToMm(dots: number, dpi = DEFAULT_DPI) {
  return Number(((dots / dpi) * 25.4).toFixed(2))
}

function roundToDots(value: number) {
  return Math.max(0, Math.round(value))
}

function clampPositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

// Decode a PPLA scale code: '1'-'9' → 1-9 (0 treated as 1), 'A'-'O' → 10-24
function decodeScale(code: string): number {
  const upper = code.toUpperCase()
  if (upper >= 'A' && upper <= 'O') {
    return upper.charCodeAt(0) - 55 // A=10, B=11, …, O=24
  }
  const n = parseInt(code, 10)
  return Number.isFinite(n) ? Math.max(1, n) : 1
}

function getContentStart(line: string) {
  const markerMatches = [line.indexOf('{{'), line.search(/[A-Za-z#]/)]
    .filter(index => index >= 0)
    .sort((left, right) => left - right)

  return markerMatches[0] ?? -1
}

// Map PPLA print direction code (R) to canvas degrees.
// R=1 → portrait (0°), R=2 → reverse landscape (90°), R=3 → reverse portrait (180°), R=4 → landscape (270°)
function parseRotation(R: string): number {
  if (R === '2') return 90
  if (R === '3') return 180
  if (R === '4') return 270
  return 0
}

// Parse font metadata from PPLA fields: t=font type, h=horizontal scale, v=vertical scale
function parseFontMeta(t: string, h: string, v: string) {
  const residentId = t
  const scaleX = decodeScale(h)
  const scaleY = decodeScale(v)
  const profile = RESIDENT_FONT_METRICS[residentId] ?? RESIDENT_FONT_METRICS['0']

  return {
    family: profile.family,
    residentId,
    typeId: '0',
    scaleX,
    scaleY,
  }
}

// ── Text command ──────────────────────────────────────────────────────────────
// PPLA format: R(1) t(1) h(1) v(1) ooo(3) yyyy(4) xxxx(4) [data]
// R=print direction (1-4), t=font type (0-9 or ':'), h=horizontal scale, v=vertical scale
// ooo=sub-font/height code, yyyy=Y coordinate (from bottom), xxxx=X coordinate (from left)

interface ParsedTextCommand {
  R: string
  t: string
  h: string
  v: string
  ooo: string
  xDots: number   // PPLA X — horizontal offset from left
  yDots: number   // PPLA Y — vertical offset from bottom (needs flip for screen)
  content: string
}

function parseTextCommand(line: string): ParsedTextCommand | null {
  const match = line.match(
    /^([1-4])([0-9:])([0-9A-Oa-o])([0-9A-Oa-o])(\d{3})(\d{4})(\d{4})(.+)$/,
  )
  if (!match) return null

  const [, R, t, h, v, ooo, yyyyStr, xxxxStr, content] = match
  const yDots = Number(yyyyStr) // PPLA Y (vertical, from bottom)
  const xDots = Number(xxxxStr) // PPLA X (horizontal, from left)

  if (!Number.isFinite(xDots) || !Number.isFinite(yDots) || !content.trim()) {
    return null
  }

  return { R, t, h, v, ooo, xDots, yDots, content: content.trim() }
}

// ── Barcode command ───────────────────────────────────────────────────────────
// PPLA format: R(1) t(1) h(1) v(1) ooo(3) yyyy(4) xxxx(4) [data]
// t=barcode type letter (A-W, Z, a-w, z). 'X' and 'Y' are reserved for line/graphic commands.

interface ParsedBarcodeCommand {
  R: string
  symbology: string
  wideBarsCode: string
  narrowBarsCode: string
  heightCode: string
  xDots: number
  yDots: number
  data: string
}

function parseBarcodeCommand(line: string): ParsedBarcodeCommand | null {
  const match = line.match(
    /^([1-4])([A-WZa-wz])([0-9A-Oa-o])([0-9A-Oa-o])(\d{3})(\d{4})(\d{4})(.+)$/,
  )
  if (!match) return null

  const [, R, t, h, v, ooo, yyyyStr, xxxxStr, data] = match

  return {
    R,
    symbology: t,
    wideBarsCode: h,
    narrowBarsCode: v,
    heightCode: ooo,
    xDots: Number(xxxxStr),
    yDots: Number(yyyyStr),
    data: data.trim(),
  }
}

// ── Line command ──────────────────────────────────────────────────────────────
// PPLA format: R X [2-digit pixel size] [3 ignored digits] yyyy(4) xxxx(4) L/l aaa/aaaa bbb/bbbb
// L → 3-digit width + height params; l → 4-digit params

interface ParsedLineCommand {
  R: string
  xDots: number
  yDots: number
  widthDots: number
  heightDots: number
}

function parseLineCommand(line: string): ParsedLineCommand | null {
  const match = line.match(/^([1-4])X\d{5}(\d{4})(\d{4})[Ll](\d{3,4})(\d{3,4})$/)
  if (!match) return null

  const [, R, yyyyStr, xxxxStr, widthStr, heightStr] = match

  return {
    R,
    xDots: Number(xxxxStr),
    yDots: Number(yyyyStr),
    widthDots: Number(widthStr),
    heightDots: Number(heightStr),
  }
}

// ── Box command ───────────────────────────────────────────────────────────────
// PPLA format: R X [pixel] [3 ignored] yyyy(4) xxxx(4) B/b width height topBottom side
// B → 3-digit params; b → 4-digit params

interface ParsedBoxCommand {
  R: string
  xDots: number
  yDots: number
  widthDots: number
  heightDots: number
  topBottomThickDots: number
  sideThickDots: number
}

function parseBoxCommand(line: string): ParsedBoxCommand | null {
  const matchUpper = line.match(/^([1-4])X\d{5}(\d{4})(\d{4})B(\d{3})(\d{3})(\d{3})(\d{3})$/)
  if (matchUpper) {
    const [, R, yyyyStr, xxxxStr, widthStr, heightStr, topBotStr, sideStr] = matchUpper
    return {
      R,
      xDots: Number(xxxxStr),
      yDots: Number(yyyyStr),
      widthDots: Number(widthStr),
      heightDots: Number(heightStr),
      topBottomThickDots: Number(topBotStr),
      sideThickDots: Number(sideStr),
    }
  }

  const matchLower = line.match(/^([1-4])X\d{5}(\d{4})(\d{4})b(\d{4})(\d{4})(\d{4})(\d{4})$/)
  if (matchLower) {
    const [, R, yyyyStr, xxxxStr, widthStr, heightStr, topBotStr, sideStr] = matchLower
    return {
      R,
      xDots: Number(xxxxStr),
      yDots: Number(yyyyStr),
      widthDots: Number(widthStr),
      heightDots: Number(heightStr),
      topBottomThickDots: Number(topBotStr),
      sideThickDots: Number(sideStr),
    }
  }

  return null
}

function estimateTextWidth(content: string, font: NonNullable<LabelElementModel['font']>) {
  const profile = RESIDENT_FONT_METRICS[font.residentId] ?? RESIDENT_FONT_METRICS['0']
  const perChar = profile.cellWidthDots * font.scaleX + profile.trackingDots

  return roundToDots(Math.max(profile.cellWidthDots, content.length * perChar))
}

function estimateTextHeight(font: NonNullable<LabelElementModel['font']>) {
  const profile = RESIDENT_FONT_METRICS[font.residentId] ?? RESIDENT_FONT_METRICS['0']

  return roundToDots(Math.max(profile.cellHeightDots, profile.cellHeightDots * font.scaleY))
}

function buildTextElement(line: string, index: number): LabelElementModel | null {
  const parsed = parseTextCommand(line)
  if (!parsed) return null

  const font = parseFontMeta(parsed.t, parsed.h, parsed.v)
  const widthDots = estimateTextWidth(parsed.content, font)
  const heightDots = estimateTextHeight(font)

  return {
    id: `text-${index}`,
    commandIndex: index,
    kind: 'text',
    name: `Text ${index + 1}`,
    rawCommand: line,
    content: parsed.content,
    xDots: parsed.xDots,
    yDots: 0,
    sourceYDots: parsed.yDots,
    widthDots,
    heightDots,
    xMm: 0,
    yMm: 0,
    widthMm: 0,
    heightMm: 0,
    rotation: parseRotation(parsed.R),
    meta: `${parsed.R}${parsed.t}${parsed.h}${parsed.v}${parsed.ooo}`,
    font,
  }
}

const DEFAULT_BARCODE_HEIGHT_DOTS = 58

function buildBarcodeElement(line: string, index: number): LabelElementModel | null {
  const parsed = parseBarcodeCommand(line)
  if (!parsed) return null

  const narrowBarDots = clampPositive(decodeScale(parsed.narrowBarsCode), 2)
  const wideBarDots = clampPositive(decodeScale(parsed.wideBarsCode), narrowBarDots + 1)
  const explicitHeight = Number(parsed.heightCode)
  const heightDots = clampPositive(explicitHeight, DEFAULT_BARCODE_HEIGHT_DOTS)
  const widthEstimate = parsed.data.length * (narrowBarDots * 4 + wideBarDots * 3)
  const widthDots = clampPositive(widthEstimate, 180)

  return {
    id: `barcode-${index}`,
    commandIndex: index,
    kind: 'barcode',
    name: `Barcode ${index + 1}`,
    rawCommand: line,
    content: parsed.data,
    xDots: parsed.xDots,
    yDots: 0,
    sourceYDots: parsed.yDots,
    widthDots,
    heightDots,
    xMm: 0,
    yMm: 0,
    widthMm: 0,
    heightMm: 0,
    rotation: parseRotation(parsed.R),
    meta: `${parsed.R}${parsed.symbology}${parsed.wideBarsCode}${parsed.narrowBarsCode}${parsed.heightCode}`,
    barcode: {
      symbology: parsed.symbology,
      narrowBarDots,
      wideBarDots,
    },
  }
}

function buildLineElement(line: string, index: number): LabelElementModel | null {
  const parsed = parseLineCommand(line)
  if (!parsed) return null

  return {
    id: `line-${index}`,
    commandIndex: index,
    kind: 'line',
    name: `Line ${index + 1}`,
    rawCommand: line,
    content: '',
    xDots: parsed.xDots,
    yDots: 0,
    sourceYDots: parsed.yDots,
    widthDots: Math.max(1, parsed.widthDots),
    heightDots: Math.max(1, parsed.heightDots),
    xMm: 0,
    yMm: 0,
    widthMm: 0,
    heightMm: 0,
    rotation: parseRotation(parsed.R),
    meta: `${parsed.R}X`,
  }
}

function buildBoxElement(line: string, index: number): LabelElementModel | null {
  const parsed = parseBoxCommand(line)
  if (!parsed) return null

  return {
    id: `box-${index}`,
    commandIndex: index,
    kind: 'box',
    name: `Box ${index + 1}`,
    rawCommand: line,
    content: '',
    xDots: parsed.xDots,
    yDots: 0,
    sourceYDots: parsed.yDots,
    widthDots: Math.max(1, parsed.widthDots),
    heightDots: Math.max(1, parsed.heightDots),
    xMm: 0,
    yMm: 0,
    widthMm: 0,
    heightMm: 0,
    rotation: parseRotation(parsed.R),
    meta: `${parsed.R}X`,
    box: {
      topBottomThickDots: Math.max(1, parsed.topBottomThickDots),
      sideThickDots: Math.max(1, parsed.sideThickDots),
    },
  }
}

function normalizeElements(
  elements: LabelElementModel[],
  _canvasWidthDots: number,
  canvasHeightDots: number,
) {
  return elements.map(element => {
    // PPLA Y=0 is at the bottom, increasing upward. Flip to screen (top-down) coords.
    // For any rotation, yDots is the screen top of the visual bounding box.
    const yDots = canvasHeightDots - element.sourceYDots - element.heightDots

    return {
      ...element,
      yDots,
      xMm: dotsToMm(element.xDots),
      yMm: dotsToMm(yDots),
      widthMm: dotsToMm(element.widthDots),
      heightMm: dotsToMm(element.heightDots),
    }
  })
}

export interface PplaParseOptions {
  overrideSizeMm?: { widthMm: number; heightMm: number }
  dpi?: number
}

export function parsePpla(source: string, options: PplaParseOptions = {}): ParsedLabelDocument {
  const lines = source
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  const elements: LabelElementModel[] = []
  const commands: string[] = []
  const warnings: string[] = []
  const setup: ParsedLabelDocument['setup'] = {
    dpi: options.dpi ?? DEFAULT_DPI,
  }

  let parsedFormLengthDots: number | null = null
  let parsedLabelWidthDots: number | null = null

  lines.forEach((line, lineIndex) => {
    commands.push(line)

    // ── System / label-level setup commands ────────────────────────────────

    // f / F = form length in 1/100 inch (e.g. f320 = 3.2" at 203 DPI ≈ 650 dots)
    if (/^[fF](\d+)$/.test(line)) {
      const raw = Number(line.slice(1))
      parsedFormLengthDots = Math.round((raw * setup.dpi) / 100)
      return
    }

    // O = label width / print-start offset in 1/100 inch
    if (/^O(\d+)$/i.test(line)) {
      const raw = Number(line.slice(1))
      parsedLabelWidthDots = Math.round((raw * setup.dpi) / 100)
      return
    }

    if (/^H\d+$/i.test(line)) {
      setup.darkness = Number(line.slice(1))
      return
    }

    if (/^Q\d+$/i.test(line)) {
      setup.quantity = Number(line.slice(1))
      return
    }

    if (/^S.+$/i.test(line)) {
      setup.speed = line.slice(1)
      return
    }

    if (/^D\d+$/i.test(line)) {
      setup.density = line.slice(1)
      return
    }

    // ── Image editing commands — all led by print direction digit 1–4 ──────
    if (!/^[1-4]/.test(line)) {
      return
    }

    const secondChar = line[1]

    // Line or Box: second character is 'X'
    if (secondChar === 'X') {
      const isBox = /^[1-4]X\d{5}\d{4}\d{4}[Bb]/.test(line)
      if (isBox) {
        const boxElement = buildBoxElement(line, elements.length)
        if (boxElement) {
          elements.push({ ...boxElement, commandIndex: lineIndex })
        } else {
          warnings.push(`Nao foi possivel interpretar o comando de caixa: ${line}`)
        }
      } else {
        const lineElement = buildLineElement(line, elements.length)
        if (lineElement) {
          elements.push({ ...lineElement, commandIndex: lineIndex })
        } else {
          warnings.push(`Nao foi possivel interpretar o comando de linha: ${line}`)
        }
      }
      return
    }

    // Graphic image reference: second character is 'Y' — not rendered yet
    if (secondChar === 'Y' || secondChar === 'y') {
      return
    }

    // Text: second character is a digit (0-9) or ':' (Courier font type)
    if (/^[0-9:]$/.test(secondChar)) {
      const textElement = buildTextElement(line, elements.length)
      if (textElement) {
        elements.push({ ...textElement, commandIndex: lineIndex })
      } else {
        warnings.push(`Nao foi possivel interpretar a linha de texto: ${line}`)
      }
      return
    }

    // Barcode: second character is a letter (A–W, Z, a–w, z)
    if (/^[A-WZa-wz]$/.test(secondChar)) {
      const barcodeElement = buildBarcodeElement(line, elements.length)
      if (barcodeElement) {
        elements.push({ ...barcodeElement, commandIndex: lineIndex })
      } else {
        warnings.push(`Nao foi possivel interpretar o codigo de barras: ${line}`)
      }
    }
  })

  const contentWidth = elements.reduce(
    (max, element) => Math.max(max, element.xDots + element.widthDots),
    0,
  )
  const contentHeight = elements.reduce(
    (max, element) => Math.max(max, element.sourceYDots + element.heightDots),
    0,
  )

  const resolvedDpi = setup.dpi

  let canvasWidthDots: number
  let canvasHeightDots: number

  if (options.overrideSizeMm) {
    canvasWidthDots = Math.round(options.overrideSizeMm.widthMm * resolvedDpi / 25.4)
    canvasHeightDots = Math.round(options.overrideSizeMm.heightMm * resolvedDpi / 25.4)
  } else {
    // Use dimensions parsed from PPLA header commands (f / O) when available.
    // Fall back to content-fit so the rectangle always contains all elements.
    const minWidth = elements.length ? Math.max(1, contentWidth) : 640
    const minHeight = elements.length ? Math.max(1, contentHeight) : 420
    canvasWidthDots = parsedLabelWidthDots ? Math.max(parsedLabelWidthDots, minWidth) : minWidth
    canvasHeightDots = parsedFormLengthDots ? Math.max(parsedFormLengthDots, minHeight) : minHeight
  }

  return {
    protocol: 'PPLA',
    source,
    commands,
    setup,
    canvas: {
      widthDots: canvasWidthDots,
      heightDots: canvasHeightDots,
      widthMm: dotsToMm(canvasWidthDots),
      heightMm: dotsToMm(canvasHeightDots),
    },
    elements: normalizeElements(elements, canvasWidthDots, canvasHeightDots),
    warnings,
  }
}

export function updatePplaElementContent(
  source: string,
  element: LabelElementModel,
  nextContent: string,
) {
  const lines = source.split(/\r?\n/)
  const targetLine = lines[element.commandIndex]

  if (!targetLine) {
    return source
  }

  if (element.kind === 'text') {
    const contentStart = getContentStart(targetLine)

    if (contentStart < 0) {
      return source
    }

    lines[element.commandIndex] = `${targetLine.slice(0, contentStart)}${nextContent}`
    return lines.join('\n')
  }

  return source
}

export function updatePplaElementCoordinates(
  source: string,
  element: LabelElementModel,
  axis: 'x' | 'y',
  nextValue: number,
) {
  const lines = source.split(/\r?\n/)
  const targetLine = lines[element.commandIndex]

  if (!targetLine || !Number.isFinite(nextValue) || nextValue < 0) {
    return source
  }

  const xDots = axis === 'x' ? Math.round(nextValue) : element.xDots
  const sourceYDots = axis === 'y'
    ? Math.round(element.yDots + element.heightDots > 0
        ? element.sourceYDots + (nextValue - element.yDots) * -1
        : nextValue)
    : element.sourceYDots

  const normalizedYDots = Math.max(0, sourceYDots)
  if (element.kind === 'text') {
    const contentStart = getContentStart(targetLine)

    if (contentStart < 0) {
      return source
    }

    const prefix = targetLine.slice(0, contentStart)

    if (prefix.length < 8) {
      return source
    }

    // PPLA text format: R t h v ooo yyyy xxxx [data]
    // yyyy is at offset -8..-5 from contentStart, xxxx at offset -4..0
    // Write yyyy (PPLA Y) first, then xxxx (PPLA X)
    const coords
      = `${String(normalizedYDots).padStart(4, '0')}${String(Math.max(0, xDots)).padStart(4, '0')}`
    lines[element.commandIndex] = `${prefix.slice(0, -8)}${coords}${targetLine.slice(contentStart)}`
    return lines.join('\n')
  }

  if (element.kind === 'barcode') {
    // Barcode command: R t h v ooo yyyy xxxx [data] (same layout as text)
    const match = targetLine.match(
      /^([1-4][A-WZa-wz][0-9A-Oa-o][0-9A-Oa-o]\d{3})(\d{4})(\d{4})(.+)$/,
    )
    if (!match) return source

    const [, prefix, , , data] = match
    const newCoords
      = `${String(normalizedYDots).padStart(4, '0')}${String(Math.max(0, xDots)).padStart(4, '0')}`
    lines[element.commandIndex] = `${prefix}${newCoords}${data}`
    return lines.join('\n')
  }

  return source
}
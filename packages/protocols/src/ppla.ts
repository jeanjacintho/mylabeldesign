import type { LabelElementModel, ParsedLabelDocument } from '@openlabel/core'

const DEFAULT_DPI = 203

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

function getContentStart(line: string) {
  const markerMatches = [line.indexOf('{{'), line.search(/[A-Za-z#]/)]
    .filter(index => index >= 0)
    .sort((left, right) => left - right)

  return markerMatches[0] ?? -1
}

function parseRotation(meta: string) {
  // meta[0] is the ori field: 1=0°, 2=90°, 3=180°, 4=270°
  const oriCode = Number(meta.at(0) ?? '1')
  if (oriCode === 2) return 90
  if (oriCode === 3) return 180
  if (oriCode === 4) return 270
  return 0
}

function parseFontMeta(meta: string) {
  const parts = meta.split('')
  const residentId = parts.at(1) ?? '0'
  const typeId = parts.at(2) ?? '0'
  const scaleXCode = parts.at(3) ?? '0'
  const scaleYCode = parts.at(4) ?? '0'

  const decodeScale = (value: string) => {
    const numeric = Number(value)

    if (!Number.isFinite(numeric)) {
      return 1
    }

    // Compact flavor often uses 0 to represent the base factor.
    return Math.max(1, numeric)
  }

  const scaleX = decodeScale(scaleXCode)
  const scaleY = decodeScale(scaleYCode)
  const profile = RESIDENT_FONT_METRICS[residentId] ?? RESIDENT_FONT_METRICS['0']

  return {
    family: profile.family,
    residentId,
    typeId,
    scaleX,
    scaleY,
  }
}

interface ParsedTextCommand {
  meta: string
  xDots: number
  yDots: number
  content: string
}

interface ParsedBarcodeCommand {
  meta: string
  data: string
  xDots: number
  yDots: number
}

const SUPPORTED_BARCODE_SYMBOLOGIES = new Set(['X', 'A', 'E', 'U', 'I', 'C', 'B'])

function parseTextCommand(line: string): ParsedTextCommand | null {
  // Compact PPLA text commands follow: 2 + meta(6) + x(4) + y(4) + content
  const match = line.match(/^2(?<meta>\d{6})(?<x>\d{4})(?<y>\d{4})(?<content>.+)$/)

  if (!match?.groups) {
    return null
  }

  const xDots = Number(match.groups.x)
  const yDots = Number(match.groups.y)
  const content = match.groups.content.trim()

  if (!Number.isFinite(xDots) || !Number.isFinite(yDots) || !content) {
    return null
  }

  return {
    meta: match.groups.meta,
    xDots,
    yDots,
    content,
  }
}

function parseBarcodeCommand(line: string): ParsedBarcodeCommand | null {
  const match = line.match(/^1(?<meta>[A-Za-z0-9]+?)(?<data>.+?)L(?<coords>\d{6,8})$/)

  if (!match?.groups) {
    return null
  }

  const coords = match.groups.coords
  const splitIndex = coords.length % 2 === 0 ? coords.length / 2 : 4
  const xDots = Number(coords.slice(0, splitIndex))
  const yDots = Number(coords.slice(splitIndex))

  if (!Number.isFinite(xDots) || !Number.isFinite(yDots)) {
    return null
  }

  return {
    meta: match.groups.meta,
    data: match.groups.data,
    xDots,
    yDots,
  }
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

  if (!parsed) {
    return null
  }
  const meta = parsed.meta
  const font = parseFontMeta(meta)
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
    rotation: parseRotation(meta),
    meta,
    font,
  }
}

function parseBarcodeMeta(meta: string) {
  const symbology = meta.at(0) ?? 'X'
  const numericTokens = meta.slice(1).match(/\d+/g) ?? []
  const tail = numericTokens.at(-1) ?? ''
  const narrowCandidate = tail.slice(-2, -1)
  const wideCandidate = tail.slice(-1)

  const narrowBarDots = clampPositive(Number(narrowCandidate || '2'), 2)
  const wideBarDots = clampPositive(Number(wideCandidate || String(narrowBarDots + 1)), narrowBarDots + 1)

  return {
    symbology,
    narrowBarDots,
    wideBarDots,
  }
}

function buildBarcodeElement(line: string, index: number): LabelElementModel | null {
  const parsed = parseBarcodeCommand(line)

  if (!parsed) {
    return null
  }
  const barcode = parseBarcodeMeta(parsed.meta)
  const widthEstimate = parsed.data.length * (barcode.narrowBarDots * 4 + barcode.wideBarDots * 3)
  const widthDots = clampPositive(widthEstimate, 180)
  const heightFromMeta = Number(parsed.meta.match(/(\d{2,3})$/)?.[1] ?? NaN)
  const heightDots = clampPositive(heightFromMeta, 58)

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
    rotation: 0,
    meta: parsed.meta,
    barcode,
  }
}

function getBarcodeSupportWarning(element: LabelElementModel) {
  const symbology = element.barcode?.symbology?.toUpperCase() ?? ''

  if (!SUPPORTED_BARCODE_SYMBOLOGIES.has(symbology)) {
    return `Simbologia de barcode ainda nao mapeada no renderer: ${symbology || 'desconhecida'}`
  }

  return null
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

    // f / F = form length in 1/100 inch (e.g. f320 = 3.2" = 81.3mm at 203 DPI = ~650 dots)
    if (/^f(\d+)$/i.test(line)) {
      const raw = Number(line.slice(1))
      parsedFormLengthDots = Math.round(raw * setup.dpi / 100)
      return
    }

    // O = label width spec; treat as 1/100 inch similar to form length
    if (/^O(\d+)$/i.test(line)) {
      const raw = Number(line.slice(1))
      parsedLabelWidthDots = Math.round(raw * setup.dpi / 100)
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

    if (/^D.+$/i.test(line)) {
      setup.density = line.slice(1)
      return
    }

    if (line.startsWith('2')) {
      const textElement = buildTextElement(line, elements.length)

      if (textElement) {
        elements.push({ ...textElement, commandIndex: lineIndex })
      } else {
        warnings.push(`Nao foi possivel interpretar a linha de texto: ${line}`)
      }

      return
    }

    if (line.startsWith('1')) {
      const barcodeElement = buildBarcodeElement(line, elements.length)

      if (barcodeElement) {
        elements.push({ ...barcodeElement, commandIndex: lineIndex })
        const barcodeWarning = getBarcodeSupportWarning(barcodeElement)

        if (barcodeWarning) {
          warnings.push(`${barcodeWarning}. Linha: ${line}`)
        }
      } else {
        warnings.push(`Nao foi possivel interpretar a linha de codigo de barras: ${line}`)
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

    const coords = `${String(Math.max(0, xDots)).padStart(4, '0')}${String(normalizedYDots).padStart(4, '0')}`
    lines[element.commandIndex] = `${prefix.slice(0, -8)}${coords}${targetLine.slice(contentStart)}`
    return lines.join('\n')
  }

  const barcodeMatch = targetLine.match(/L(\d{6,8})$/)

  if (!barcodeMatch) {
    return source
  }

  const coordsLength = barcodeMatch[1].length
  const splitIndex = coordsLength % 2 === 0 ? coordsLength / 2 : 4
  const xPart = String(Math.max(0, xDots)).padStart(splitIndex, '0')
  const yPart = String(normalizedYDots).padStart(coordsLength - splitIndex, '0')

  lines[element.commandIndex] = targetLine.replace(/L\d{6,8}$/, `L${xPart}${yPart}`)

  return lines.join('\n')
}
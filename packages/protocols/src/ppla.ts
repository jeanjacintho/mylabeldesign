import type { LabelElementModel, ParsedLabelDocument } from '@openlabel/core'

const DEFAULT_DPI = 203

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
  // In this compact PPLA flavor, the leading meta digits are font/scale flags,
  // not the orientation field. Default to horizontal until we map the exact token.
  void meta
  return 0
}

function parseFontMeta(meta: string) {
  const parts = meta.split('')
  const residentId = parts.at(1) ?? '0'
  const scaleY = clampPositive(Number(parts.at(2) ?? '1'), 1)
  const scaleX = clampPositive(Number(parts.at(3) ?? '1'), scaleY)

  return {
    family: `PPLA Font ${residentId}`,
    residentId,
    scaleX,
    scaleY,
  }
}

function estimateTextWidth(content: string, scaleX: number) {
  return roundToDots(Math.max(42, content.length * (7 + scaleX * 2.2)))
}

function estimateTextHeight(scaleY: number) {
  return roundToDots(Math.max(18, 12 + scaleY * 7))
}

function buildTextElement(line: string, index: number): LabelElementModel | null {
  const contentStart = getContentStart(line)

  if (contentStart < 0) {
    return null
  }

  const prefix = line.slice(0, contentStart)
  const content = line.slice(contentStart).trim()

  if (prefix.length < 9 || !content) {
    return null
  }

  const xDots = Number(prefix.slice(-8, -4))
  const yDots = Number(prefix.slice(-4))
  const meta = prefix.slice(1, -8)
  const font = parseFontMeta(meta)
  const widthDots = estimateTextWidth(content, font.scaleX)
  const heightDots = estimateTextHeight(font.scaleY)

  return {
    id: `text-${index}`,
    commandIndex: index,
    kind: 'text',
    name: `Text ${index + 1}`,
    rawCommand: line,
    content,
    xDots,
    yDots: 0,
    sourceYDots: yDots,
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
  return {
    symbology: meta.at(1) ?? 'X',
    narrowBarDots: clampPositive(Number(meta.at(-2) ?? '2'), 2),
    wideBarDots: clampPositive(Number(meta.at(-1) ?? '4'), 4),
  }
}

function buildBarcodeElement(line: string, index: number): LabelElementModel | null {
  const coordsMatch = line.match(/(\d{6,8})$/)

  if (!coordsMatch) {
    return null
  }

  const coords = coordsMatch[1]
  const xDigits = coords.length >= 7 ? 3 : Math.floor(coords.length / 2)
  const xDots = Number(coords.slice(0, xDigits))
  const yDots = Number(coords.slice(xDigits))
  const meta = line.slice(0, line.length - coords.length)
  const barcode = parseBarcodeMeta(meta)
  const widthDots = clampPositive(barcode.wideBarDots * 45, 180)
  const heightDots = 58

  return {
    id: `barcode-${index}`,
    commandIndex: index,
    kind: 'barcode',
    name: `Barcode ${index + 1}`,
    rawCommand: line,
    content: meta,
    xDots,
    yDots: 0,
    sourceYDots: yDots,
    widthDots,
    heightDots,
    xMm: 0,
    yMm: 0,
    widthMm: 0,
    heightMm: 0,
    rotation: 0,
    meta,
    barcode,
  }
}

function normalizeElements(elements: LabelElementModel[], canvasHeightDots: number) {
  return elements.map(element => {
    const yDots = Math.max(20, canvasHeightDots - element.sourceYDots - element.heightDots)

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

export function parsePpla(source: string): ParsedLabelDocument {
  const lines = source
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  const elements: LabelElementModel[] = []
  const commands: string[] = []
  const warnings: string[] = []
  const setup: ParsedLabelDocument['setup'] = {
    dpi: DEFAULT_DPI,
  }

  lines.forEach((line, lineIndex) => {
    commands.push(line)

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

  const canvasWidthDots = Math.max(640, contentWidth + 80)
  const canvasHeightDots = Math.max(420, contentHeight + 80)

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
    elements: normalizeElements(elements, canvasHeightDots),
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

  const contentStart = element.kind === 'text'
    ? getContentStart(targetLine)
    : targetLine.length - 6

  if (contentStart < 0) {
    return source
  }

  const prefix = targetLine.slice(0, contentStart)

  if (prefix.length < 8) {
    return source
  }

  const xDots = axis === 'x' ? Math.round(nextValue) : element.xDots
  const sourceYDots = axis === 'y'
    ? Math.round(element.yDots + element.heightDots > 0
        ? element.sourceYDots + (nextValue - element.yDots) * -1
        : nextValue)
    : element.sourceYDots

  const normalizedYDots = Math.max(0, sourceYDots)
  const coords = `${String(Math.max(0, xDots)).padStart(4, '0')}${String(normalizedYDots).padStart(4, '0')}`
  lines[element.commandIndex] = `${prefix.slice(0, -8)}${coords}${targetLine.slice(contentStart)}`

  return lines.join('\n')
}
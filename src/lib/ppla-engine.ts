export type PplaElementKind = 'text' | 'barcode' | 'box'

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
}

export interface PplaBarcode extends PplaElement {
  type: 'barcode'
  barcodeType: string
  data: string
  height: number
}

export interface PplaBox extends PplaElement {
  type: 'box'
  width: number
  height: number
  thickness: number
}

export type AnyPplaElement = PplaText | PplaBarcode | PplaBox

export interface PplaParserOptions {
  normalizeLineEndings?: boolean
}

export class PplaParserService {
  private readonly options: PplaParserOptions

  constructor(options: PplaParserOptions = {}) {
    this.options = options
  }

  public parse(pplaCode: string): AnyPplaElement[] {
    const lines = this.splitIntoLines(pplaCode)
    const elements: AnyPplaElement[] = []

    for (const rawLine of lines) {
      const line = this.sanitizeLine(rawLine)

      if (!line) {
        continue
      }

      const textElement = this.tryParseText(line)
      if (textElement) {
        elements.push(textElement)
        continue
      }

      const boxElement = this.tryParseBox(line)
      if (boxElement) {
        elements.push(boxElement)
        continue
      }

      console.warn('[PplaParserService] Ignored unsupported or invalid line:', rawLine)
    }

    return elements
  }

  private splitIntoLines(pplaCode: string): string[] {
    if (this.options.normalizeLineEndings === true) {
      const normalized = pplaCode.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      return normalized.split('\n')
    }

    return pplaCode.split(/\r\n|\r|\n/)
  }

  private sanitizeLine(line: string): string {
    const trimmed = line.trim()
    if (!trimmed) {
      return ''
    }

    let result = ''
    for (const char of trimmed) {
      const codePoint = char.codePointAt(0)
      if (codePoint === undefined) {
        continue
      }
      if (codePoint < 32 || codePoint === 127) {
        continue
      }
      result += char
    }

    return result.trim()
  }

  private tryParseText(line: string): PplaText | null {
    const textRegex =
      /^A(?<rotation>[0-3])(?<fontId>[A-Za-z0-9])(?<widthMul>\d)(?<heightMul>\d)(?<x>\d+),(?<y>\d+),"(?<text>.*)"$/

    const match = line.match(textRegex)
    if (!match || !match.groups) {
      return null
    }

    const rotationIndex = Number(match.groups.rotation)
    const rotation: PplaRotation = this.mapRotationCodeToDegrees(rotationIndex)

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
      console.warn('[PplaParserService] Invalid numeric values in text line:', line)
      return null
    }

    const element: PplaText = {
      type: 'text',
      x,
      y,
      rotation,
      text,
      fontId,
      widthMultiplier,
      heightMultiplier,
    }

    return element
  }

  private tryParseBox(line: string): PplaBox | null {
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
      console.warn('[PplaParserService] Invalid numeric values in box line:', line)
      return null
    }

    const element: PplaBox = {
      type: 'box',
      x,
      y,
      rotation: 0,
      width,
      height,
      thickness,
    }

    return element
  }

  private mapRotationCodeToDegrees(rotationCode: number): PplaRotation {
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
}

export interface PplaRendererOptions {
  dpi?: number
  scaleFactor?: number
}

export class PplaRendererService {
  private readonly dpi: number
  private readonly scaleFactor: number

  constructor(options: PplaRendererOptions = {}) {
    const DEFAULT_DPI = 203
    const DEFAULT_SCALE_FACTOR = 1

    this.dpi = options.dpi ?? DEFAULT_DPI
    this.scaleFactor = options.scaleFactor ?? DEFAULT_SCALE_FACTOR
  }

  public render(elements: AnyPplaElement[], ctx: CanvasRenderingContext2D): void {
    for (const element of elements) {
      if (element.type === 'text') {
        this.renderText(element, ctx)
        continue
      }
      if (element.type === 'box') {
        this.renderBox(element, ctx)
        continue
      }
      if (element.type === 'barcode') {
        this.renderBarcode(element, ctx)
        continue
      }

      console.warn('[PplaRendererService] Ignored unsupported element:', element)
    }
  }

  private convertDotsToPixels(valueInDots: number): number {
    const SCREEN_PPI = 96
    return (valueInDots * (SCREEN_PPI / this.dpi)) * this.scaleFactor
  }

  private renderText(element: PplaText, ctx: CanvasRenderingContext2D): void {
    if (!Number.isFinite(element.x) || !Number.isFinite(element.y)) {
      console.warn('[PplaRendererService] Invalid text position:', element)
      return
    }

    const xPx = this.convertDotsToPixels(element.x)
    const yPx = this.convertDotsToPixels(element.y)
    const fontSizeDots = this.getFontSizeDotsForFontId(element.fontId)
    const fontSizePx = this.convertDotsToPixels(
      fontSizeDots * Math.max(1, element.heightMultiplier),
    )

    ctx.save()
    ctx.translate(xPx, yPx)
    this.applyRotation(ctx, element.rotation)

    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.font = `${fontSizePx}px monospace`

    if (element.widthMultiplier > 1) {
      ctx.save()
      ctx.scale(Math.max(1, element.widthMultiplier), 1)
      ctx.fillText(element.text, 0, 0)
      ctx.restore()
    } else {
      ctx.fillText(element.text, 0, 0)
    }

    ctx.restore()
  }

  private renderBarcode(element: PplaBarcode, ctx: CanvasRenderingContext2D): void {
    void element
    void ctx
    console.warn('[PplaRendererService] Barcode rendering not implemented yet.')
  }

  private renderBox(element: PplaBox, ctx: CanvasRenderingContext2D): void {
    if (
      !Number.isFinite(element.x) ||
      !Number.isFinite(element.y) ||
      !Number.isFinite(element.width) ||
      !Number.isFinite(element.height) ||
      !Number.isFinite(element.thickness)
    ) {
      console.warn('[PplaRendererService] Invalid box values:', element)
      return
    }

    if (element.width <= 0 || element.height <= 0 || element.thickness <= 0) {
      console.warn('[PplaRendererService] Ignored box with non-positive size:', element)
      return
    }

    const xPx = this.convertDotsToPixels(element.x)
    const yPx = this.convertDotsToPixels(element.y)
    const widthPx = this.convertDotsToPixels(element.width)
    const heightPx = this.convertDotsToPixels(element.height)
    const thicknessPx = Math.max(1, this.convertDotsToPixels(element.thickness))

    ctx.save()
    ctx.translate(xPx, yPx)
    this.applyRotation(ctx, element.rotation)

    this.drawBoxStroke(ctx, widthPx, heightPx, thicknessPx)

    ctx.restore()
  }

  private applyRotation(ctx: CanvasRenderingContext2D, rotation: PplaRotation): void {
    if (rotation === 0) {
      return
    }
    const radians = (Math.PI / 180) * rotation
    ctx.rotate(radians)
  }

  private drawBoxStroke(
    ctx: CanvasRenderingContext2D,
    widthPx: number,
    heightPx: number,
    thicknessPx: number,
  ): void {
    const t = Math.min(thicknessPx, widthPx, heightPx)

    // Top
    ctx.fillRect(0, 0, widthPx, t)
    // Left
    ctx.fillRect(0, 0, t, heightPx)
    // Right
    ctx.fillRect(widthPx - t, 0, t, heightPx)
    // Bottom
    ctx.fillRect(0, heightPx - t, widthPx, t)
  }

  private getFontSizeDotsForFontId(fontId: string): number {
    const DEFAULT_FONT_SIZE_DOTS = 24

    const normalized = fontId.trim().toUpperCase()

    const map: Record<string, number> = {
      A: 24,
      B: 32,
      C: 40,
      D: 48,
      E: 56,
    }

    return map[normalized] ?? DEFAULT_FONT_SIZE_DOTS
  }
}


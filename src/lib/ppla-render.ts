import {
  DEFAULT_PRINTER_DPI,
  printerDotsToPreviewPx,
} from '@/lib/label-units'
import type {
  AnyPplaElement,
  PplaBarcode,
  PplaBox,
  PplaGraphic,
  PplaLabelState,
  PplaLine,
  PplaRotation,
  PplaText,
} from '@/lib/ppla-model'
import {
  getBaseFontHeightDots,
  getPplaElementLocalSizeDots,
  getPplaElementVerticalExtentDots,
} from '@/lib/ppla-layout'

export interface PplaRendererOptions {
  dpi?: number
  scaleFactor?: number
}

export interface PplaRenderContext {
  canvasHeightPx: number
  /** Dwh, A1/A2: the preview follows docs/PPLA_Parser_Guide.md (OR preferred over XOR) */
  labelState?: PplaLabelState
}

/** Draws parsed PPLA elements onto a raw HTML5 2D canvas context — the read-only preview renderer. */
export class PplaRendererService {
  private readonly dpi: number
  private readonly scaleFactor: number

  constructor(options: PplaRendererOptions = {}) {
    const DEFAULT_SCALE_FACTOR = 1

    this.dpi = options.dpi ?? DEFAULT_PRINTER_DPI
    this.scaleFactor = options.scaleFactor ?? DEFAULT_SCALE_FACTOR
  }

  /** Draws every element onto `ctx`, dispatching by kind and applying each element's logic mode (XOR/OR). */
  public render(
    elements: AnyPplaElement[],
    ctx: CanvasRenderingContext2D,
    renderContext: PplaRenderContext,
  ): void {
    const { canvasHeightPx, labelState } = renderContext
    for (const element of elements) {
      ctx.save()
      /** A1 = XOR (overlapping ink cancels out), A2 = OR (additive) — A6 guide */
      ctx.globalCompositeOperation = element.logicMode === 1 ? 'xor' : 'source-over'

      if (element.type === 'text') {
        this.renderText(element, ctx, canvasHeightPx, labelState)
      } else if (element.type === 'box') {
        this.renderBox(element, ctx, canvasHeightPx, labelState)
      } else if (element.type === 'line') {
        this.renderLine(element, ctx, canvasHeightPx, labelState)
      } else if (element.type === 'barcode') {
        this.renderBarcode(element, ctx, canvasHeightPx, labelState)
      } else if (element.type === 'graphic') {
        this.renderGraphicReference(element, ctx, canvasHeightPx, labelState)
      } else {
        console.warn('[PplaRendererService] Ignored unsupported element:', element)
      }

      ctx.restore()
    }
  }

  /** Converts a value in printer dots to preview-canvas pixels at this renderer's configured DPI/scale. */
  private convertDotsToPixels(valueInDots: number): number {
    return printerDotsToPreviewPx(valueInDots, this.dpi, this.scaleFactor)
  }

  /** D22 = (1,1); D11 = (0.5,0.5) — @see PPLA_Parser_Guide §5.1, §11.8 */
  private dScale(
    state: PplaLabelState | undefined,
  ): { scaleX: number; scaleY: number } {
    const w = state?.pixelSize.w ?? 2
    const h = state?.pixelSize.h ?? 2
    return { scaleX: w / 2, scaleY: h / 2 }
  }

  /** Computes the top-left screen Y for an element, converting from PPLA's bottom-left/Y-up origin. */
  private pplaTopLeftScreenY(
    element: AnyPplaElement,
    canvasHeightPx: number,
    verticalExtentScale = 1,
  ): number {
    const verticalExtentDots =
      getPplaElementVerticalExtentDots(element) * verticalExtentScale
    return canvasHeightPx - this.convertDotsToPixels(element.y + verticalExtentDots)
  }

  /** Draws a text element, applying font size, rotation, and the `M` mirror toggle. */
  private renderText(
    element: PplaText,
    ctx: CanvasRenderingContext2D,
    canvasHeightPx: number,
    labelState: PplaLabelState | undefined,
  ): void {
    if (!Number.isFinite(element.x) || !Number.isFinite(element.y)) {
      console.warn('[PplaRendererService] Invalid text position:', element)
      return
    }

    const d = this.dScale(labelState)
    const dText = Math.sqrt(d.scaleX * d.scaleY)

    const xPx = this.convertDotsToPixels(element.x)
    const topScreenY = this.pplaTopLeftScreenY(element, canvasHeightPx, d.scaleY)
    const fontSizePx = this.getTextFontSizePx(element) * dText
    const heightPx = this.convertDotsToPixels(
      getPplaElementLocalSizeDots(element).height,
    ) * d.scaleY

    ctx.save()
    ctx.translate(xPx, topScreenY)
    this.applyRotation(ctx, element.rotation)

    ctx.textBaseline = 'bottom'
    ctx.font = `${fontSizePx}px monospace`

    /** M (mirror): flips the field while keeping the anchor point (x,y) fixed — A6 guide */
    const widthScale = Math.max(1, element.widthMultiplier) * (element.mirror ? -1 : 1)
    ctx.scale(widthScale, 1)
    ctx.textAlign = element.mirror ? 'right' : 'left'
    ctx.fillText(element.text, 0, heightPx)

    ctx.restore()
  }

  /** Computes a text element's rendered font size in pixels, from its font table height and multiplier. */
  private getTextFontSizePx(element: PplaText): number {
    const baseDots = getBaseFontHeightDots(element.fontId, element.subfont)
    const scaledDots = baseDots * Math.max(1, element.heightMultiplier)
    return this.convertDotsToPixels(scaledDots)
  }

  /** Draws a barcode as a placeholder box with its type and data string (not real bars/pixels). */
  private renderBarcode(
    element: PplaBarcode,
    ctx: CanvasRenderingContext2D,
    canvasHeightPx: number,
    labelState: PplaLabelState | undefined,
  ): void {
    const d = this.dScale(labelState)
    const xPx = this.convertDotsToPixels(element.x)
    const heightPx = this.convertDotsToPixels(element.height) * d.scaleY
    const widthPx = Math.max(
      this.convertDotsToPixels(
        Math.max(1, element.wideBarScale) * 8,
      ) * d.scaleX,
      40 * Math.min(d.scaleX, d.scaleY),
    )
    const topScreenY = this.pplaTopLeftScreenY(element, canvasHeightPx, d.scaleY)

    ctx.save()
    ctx.translate(xPx, topScreenY)
    this.applyRotation(ctx, element.rotation)
    ctx.strokeStyle = '#111827'
    ctx.strokeRect(0, 0, widthPx, heightPx)
    ctx.fillStyle = '#111827'
    ctx.font = '10px monospace'
    ctx.fillText(`[${element.barcodeType}]`, 2, 11)
    ctx.fillText(element.data.slice(0, 24), 2, 23)
    ctx.restore()
  }

  /** Draws a box as a hollow rectangle (four filled border strips), skipping invalid/non-positive sizes. */
  private renderBox(
    element: PplaBox,
    ctx: CanvasRenderingContext2D,
    canvasHeightPx: number,
    labelState: PplaLabelState | undefined,
  ): void {
    if (
      !Number.isFinite(element.x) ||
      !Number.isFinite(element.y) ||
      !Number.isFinite(element.width) ||
      !Number.isFinite(element.height) ||
      !Number.isFinite(element.thicknessTopBottom) ||
      !Number.isFinite(element.thicknessSides)
    ) {
      console.warn('[PplaRendererService] Invalid box values:', element)
      return
    }

    if (
      element.width <= 0 ||
      element.height <= 0 ||
      element.thicknessTopBottom <= 0 ||
      element.thicknessSides <= 0
    ) {
      console.warn('[PplaRendererService] Ignored box with non-positive size:', element)
      return
    }

    const d = this.dScale(labelState)
    const xPx = this.convertDotsToPixels(element.x)
    const widthPx = this.convertDotsToPixels(element.width) * d.scaleX
    const heightPx = this.convertDotsToPixels(element.height) * d.scaleY
    const tTbPx = Math.max(
      1,
      this.convertDotsToPixels(element.thicknessTopBottom) * d.scaleY,
    )
    const tSidePx = Math.max(
      1,
      this.convertDotsToPixels(element.thicknessSides) * d.scaleX,
    )
    const topScreenY = this.pplaTopLeftScreenY(element, canvasHeightPx, d.scaleY)

    ctx.save()
    ctx.translate(xPx, topScreenY)
    this.applyRotation(ctx, element.rotation)
    ctx.fillStyle = '#111827'

    this.drawBoxStrokeBottomLeft(ctx, widthPx, heightPx, tTbPx, tSidePx)

    ctx.restore()
  }

  /** Draws a line as a solid filled rectangle. */
  private renderLine(
    element: PplaLine,
    ctx: CanvasRenderingContext2D,
    canvasHeightPx: number,
    labelState: PplaLabelState | undefined,
  ): void {
    const d = this.dScale(labelState)
    const xPx = this.convertDotsToPixels(element.x)
    const widthPx = this.convertDotsToPixels(element.width) * d.scaleX
    const heightPx = this.convertDotsToPixels(element.height) * d.scaleY
    const topScreenY = this.pplaTopLeftScreenY(element, canvasHeightPx, d.scaleY)

    ctx.save()
    ctx.translate(xPx, topScreenY)
    this.applyRotation(ctx, element.rotation)
    ctx.fillStyle = '#111827'
    ctx.fillRect(0, 0, widthPx, heightPx)
    ctx.restore()
  }

  /** Draws a graphic reference as a placeholder box with its file name (real image data isn't available). */
  private renderGraphicReference(
    element: PplaGraphic,
    ctx: CanvasRenderingContext2D,
    canvasHeightPx: number,
    labelState: PplaLabelState | undefined,
  ): void {
    const d = this.dScale(labelState)
    const size = getPplaElementLocalSizeDots(element)
    const xPx = this.convertDotsToPixels(element.x)
    const topScreenY = this.pplaTopLeftScreenY(element, canvasHeightPx, d.scaleY)
    const widthPx = this.convertDotsToPixels(size.width) * d.scaleX
    const heightPx = this.convertDotsToPixels(size.height) * d.scaleY

    ctx.save()
    ctx.translate(xPx, topScreenY)
    this.applyRotation(ctx, element.rotation)
    ctx.strokeStyle = '#111827'
    ctx.strokeRect(0, 0, widthPx, heightPx)
    ctx.fillStyle = '#111827'
    ctx.font = '10px monospace'
    ctx.fillText(element.name.slice(0, 16), 4, Math.min(14, heightPx - 2))
    ctx.restore()
  }

  /** Rotates the canvas context around its current origin by the element's PPLA rotation. */
  private applyRotation(ctx: CanvasRenderingContext2D, rotation: PplaRotation): void {
    if (rotation === 0) {
      return
    }
    const radians = (Math.PI / 180) * rotation
    ctx.rotate(radians)
  }

  /** Fills the four border strips of a hollow box/frame, anchored at its bottom-left corner. */
  private drawBoxStrokeBottomLeft(
    ctx: CanvasRenderingContext2D,
    widthPx: number,
    heightPx: number,
    thicknessTopBottomPx: number,
    thicknessSidesPx: number,
  ): void {
    const tH = Math.min(thicknessTopBottomPx, heightPx / 2)
    const tW = Math.min(thicknessSidesPx, widthPx / 2)

    ctx.fillRect(0, 0, widthPx, tH)
    ctx.fillRect(0, heightPx - tH, widthPx, tH)
    ctx.fillRect(0, 0, tW, heightPx)
    ctx.fillRect(widthPx - tW, 0, tW, heightPx)
  }
}

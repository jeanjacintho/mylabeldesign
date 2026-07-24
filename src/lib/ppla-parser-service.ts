import {
  parsePplaCode,
  parsePplaElementsFromCode,
  type ParsePplaElementsOptions,
} from '@/lib/ppla-parse-image'
import type { AnyPplaElement, PplaParseResult } from '@/lib/ppla-model'
import { DEFAULT_PRINTER_DPI } from '@/lib/label-units'

export interface PplaParserOptions extends ParsePplaElementsOptions {
  printerDpi?: number
}

/** Thin, configured wrapper around the PPLA parser functions (fixed DPI/line-ending options per instance). */
export class PplaParserService {
  private readonly options: PplaParserOptions
  private readonly printerDpi: number

  constructor(options: PplaParserOptions = {}) {
    this.options = options
    this.printerDpi = options.printerDpi ?? DEFAULT_PRINTER_DPI
  }

  /** Returns the DPI this service was configured with (or the default). */
  public getPrinterDpi(): number {
    return this.printerDpi
  }

  /** Parses PPLA source and returns only the resulting elements. */
  public parse(pplaCode: string): AnyPplaElement[] {
    return parsePplaElementsFromCode(pplaCode, {
      normalizeLineEndings: this.options.normalizeLineEndings,
      printerDpi: this.printerDpi,
    })
  }

  /** Parses PPLA source and returns the full result: elements, label state, and diagnostics. */
  public parseWithDiagnostics(pplaCode: string): PplaParseResult {
    return parsePplaCode(pplaCode, {
      normalizeLineEndings: this.options.normalizeLineEndings,
      printerDpi: this.printerDpi,
    })
  }
}

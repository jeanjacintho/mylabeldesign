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

export class PplaParserService {
  private readonly options: PplaParserOptions
  private readonly printerDpi: number

  constructor(options: PplaParserOptions = {}) {
    this.options = options
    this.printerDpi = options.printerDpi ?? DEFAULT_PRINTER_DPI
  }

  public getPrinterDpi(): number {
    return this.printerDpi
  }

  public parse(pplaCode: string): AnyPplaElement[] {
    return parsePplaElementsFromCode(pplaCode, {
      normalizeLineEndings: this.options.normalizeLineEndings,
      printerDpi: this.printerDpi,
    })
  }

  public parseWithDiagnostics(pplaCode: string): PplaParseResult {
    return parsePplaCode(pplaCode, {
      normalizeLineEndings: this.options.normalizeLineEndings,
      printerDpi: this.printerDpi,
    })
  }
}

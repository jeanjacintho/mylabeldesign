/**
 * Motor PPLA — fachada e reexports.
 *
 * - Modelo de primitivas alinhado a [printer-ppla](https://github.com/gillianpalhano/printer-ppla)
 *   (`Direction` 1–4, `Rthvoooyyyyxxxx`, `RX11000…`).
 * - **Parse** (`parsePplaElementsFromCode` / `PplaParserService`) ↔ **emit** (`emitPplaElementLine` / `emitPplaElementsToLines`)
 *   para linhas de imagem A7.
 *
 * @see docs/PPLA_Parser_Guide.md
 * @see docs/ppla-interpreter.md
 */

export * from '@/lib/ppla-model'
export * from '@/lib/ppla-scale'
export * from '@/lib/ppla-parse-preamble'
export * from '@/lib/ppla-parse-image'
export * from '@/lib/ppla-emit'
export * from '@/lib/ppla-layout'
export {
  PplaParserService,
  type PplaParserOptions,
} from '@/lib/ppla-parser-service'
export {
  PplaRendererService,
  type PplaRendererOptions,
  type PplaRenderContext,
} from '@/lib/ppla-render'

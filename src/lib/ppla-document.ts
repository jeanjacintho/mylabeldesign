/**
 * Surgical line editing over the raw PPLA text — used by the visual editor to change,
 * insert, or remove exactly ONE element's line, without touching anything else in the
 * file (preamble, other elements, unknown vendor commands like `ySPM`/`qC`/`V0`). Line
 * indices come from `elementSourceLines` (`ppla-parse-image.ts`), which uses the same
 * split as `splitPplaLines` with `normalizeLineEndings: true`.
 */

import type { AnyPplaElement, PplaElementKind } from '@/lib/ppla-model'

/** Splits code into lines using the same line-ending rule as the parser's normalized mode. */
function splitLines(code: string): string[] {
  return code.split(/\r\n|\r|\n/)
}

/** Throws a `RangeError` if `lineIndex` doesn't point at a real line in `lines`. */
function assertLineIndexInRange(lines: string[], lineIndex: number, fn: string): void {
  if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= lines.length) {
    throw new RangeError(
      `${fn}: line index ${lineIndex} out of range (0..${lines.length - 1})`,
    )
  }
}

/** Replaces exactly one line (by index) in `code`, leaving every other line untouched. */
export function replaceLineAt(code: string, lineIndex: number, newLine: string): string {
  const lines = splitLines(code)
  assertLineIndexInRange(lines, lineIndex, 'replaceLineAt')
  lines[lineIndex] = newLine
  return lines.join('\n')
}

/** Removes exactly one line (by index) from `code`, leaving every other line untouched. */
export function removeLineAt(code: string, lineIndex: number): string {
  const lines = splitLines(code)
  assertLineIndexInRange(lines, lineIndex, 'removeLineAt')
  lines.splice(lineIndex, 1)
  return lines.join('\n')
}

/** Default element for the Toolbar's creation tools — reasonable placeholder values, always editable afterward. */
export function createDefaultElement(
  kind: PplaElementKind,
  xDots: number,
  yDots: number,
): AnyPplaElement {
  const x = Math.max(0, Math.round(xDots))
  const y = Math.max(0, Math.round(yDots))

  if (kind === 'text') {
    return {
      type: 'text', x, y, rotation: 0,
      text: 'Texto', fontId: '1', widthMultiplier: 1, heightMultiplier: 1, subfont: '000',
    }
  }
  if (kind === 'box') {
    return {
      type: 'box', x, y, rotation: 0,
      width: 100, height: 60, thicknessTopBottom: 8, thicknessSides: 8,
    }
  }
  if (kind === 'line') {
    return { type: 'line', x, y, rotation: 0, width: 100, height: 4 }
  }
  if (kind === 'barcode') {
    return {
      type: 'barcode', x, y, rotation: 0,
      barcodeType: 'A', data: '123456789', height: 50, wideBarScale: 2, narrowBarScale: 1,
    }
  }
  return { type: 'graphic', x, y, rotation: 0, name: 'grafico' }
}

/**
 * Inserts a new element line inside a label block — before the `Q`xxxx (quantity) line
 * if present, otherwise before the `E` that closes the block. If there's no `L..E` block
 * at all (empty file / no block), appends at the end.
 *
 * `targetCloseLineIndex` picks which block's `E` to insert before, for jobs with more
 * than one `L..E` block (e.g. a batch of "ROLO: 1/7".."7/7" labels) — pass the `endLine`
 * of the block currently shown in the editor (`findPplaLabelBlocks`). Omit it (or pass a
 * value that's no longer a real `E` line) to fall back to the first `E` in the file.
 */
export function insertElementLine(
  code: string,
  newLine: string,
  targetCloseLineIndex?: number,
): string {
  const lines = splitLines(code)
  const closeIndex =
    targetCloseLineIndex !== undefined && lines[targetCloseLineIndex]?.trim() === 'E'
      ? targetCloseLineIndex
      : lines.findIndex(l => l.trim() === 'E')

  if (closeIndex === -1) {
    lines.push(newLine)
    return lines.join('\n')
  }

  const beforeCloseIndex = closeIndex - 1
  const insertAt =
    beforeCloseIndex >= 0 && /^Q\d{4}$/.test(lines[beforeCloseIndex].trim())
      ? beforeCloseIndex
      : closeIndex

  lines.splice(insertAt, 0, newLine)
  return lines.join('\n')
}

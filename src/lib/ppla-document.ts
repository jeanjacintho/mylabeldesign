/**
 * Edição cirúrgica de linha sobre o texto cru do PPLA — usada pelo editor visual pra
 * alterar/inserir/remover exatamente a linha de UM elemento, sem tocar em mais nada do
 * arquivo (preâmbulo, outros elementos, comandos de fornecedor desconhecidos como
 * `ySPM`/`qC`/`V0`). Índices de linha vêm de `elementSourceLines` (`ppla-parse-image.ts`),
 * que usa o mesmo split que `splitPplaLines` com `normalizeLineEndings: true`.
 */

import type { AnyPplaElement, PplaElementKind } from '@/lib/ppla-model'

function splitLines(code: string): string[] {
  return code.split(/\r\n|\r|\n/)
}

function assertLineIndexInRange(lines: string[], lineIndex: number, fn: string): void {
  if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= lines.length) {
    throw new RangeError(
      `${fn}: line index ${lineIndex} out of range (0..${lines.length - 1})`,
    )
  }
}

export function replaceLineAt(code: string, lineIndex: number, newLine: string): string {
  const lines = splitLines(code)
  assertLineIndexInRange(lines, lineIndex, 'replaceLineAt')
  lines[lineIndex] = newLine
  return lines.join('\n')
}

export function removeLineAt(code: string, lineIndex: number): string {
  const lines = splitLines(code)
  assertLineIndexInRange(lines, lineIndex, 'removeLineAt')
  lines.splice(lineIndex, 1)
  return lines.join('\n')
}

/** Elemento padrão pra ferramentas de criação (Toolbar) — valores razoáveis, sempre editáveis depois. */
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
 * Insere uma linha nova de elemento dentro do bloco de etiqueta ativo — antes do `Q`xxxx
 * (quantidade) quando existir, senão antes do `E` que fecha o bloco. Se não houver bloco
 * `L..E` nenhum (arquivo vazio/sem bloco), acrescenta no final.
 * Nota: assume um único bloco `L..E` por arquivo (mesma limitação já conhecida do parser).
 */
export function insertElementLine(code: string, newLine: string): string {
  const lines = splitLines(code)
  const closeIndex = lines.findIndex(l => l.trim() === 'E')

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

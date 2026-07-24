import { describe, expect, it } from 'vitest'
import { insertElementLine, removeLineAt, replaceLineAt } from '@/lib/ppla-document'
import { parsePplaCode } from '@/lib/ppla-parse-image'

/** Baseado em etiquetas reais de produção: linhas de fornecedor desconhecidas (ySPM, qC,
 * V0, RN) precisam sobreviver intactas a uma edição cirúrgica de outra linha. */
const FIXTURE = `qC
n
e
c0000
RN
f220
V0
O0220
L
D11
PF
SF
H14
A2
ySPM
192200101650020MUNDIAL TEXTIL LTDA
192200501200020OP:23675
Q0001
E`

describe('replaceLineAt', () => {
  it('troca só a linha alvo, todo o resto permanece byte-idêntico', () => {
    const { elementSourceLines } = parsePplaCode(FIXTURE, { normalizeLineEndings: true })
    const targetLine = elementSourceLines[0]
    const originalLines = FIXTURE.split('\n')

    const result = replaceLineAt(FIXTURE, targetLine, '192200101650099MUNDIAL TEXTIL LTDA')
    const resultLines = result.split('\n')

    expect(resultLines).toHaveLength(originalLines.length)
    expect(resultLines[targetLine]).toBe('192200101650099MUNDIAL TEXTIL LTDA')
    for (let i = 0; i < originalLines.length; i++) {
      if (i === targetLine) continue
      expect(resultLines[i]).toBe(originalLines[i])
    }
  })

  it('lança erro com índice fora do intervalo', () => {
    expect(() => replaceLineAt(FIXTURE, 999, 'x')).toThrow(RangeError)
  })
})

describe('removeLineAt', () => {
  it('remove só a linha alvo, preservando a ordem do resto', () => {
    const originalLines = FIXTURE.split('\n')
    const result = removeLineAt(FIXTURE, 1)
    const resultLines = result.split('\n')
    expect(resultLines).toHaveLength(originalLines.length - 1)
    expect(resultLines).not.toContain('n')
    expect(resultLines[0]).toBe('qC')
    expect(resultLines[1]).toBe('e')
  })
})

describe('insertElementLine', () => {
  it('insere antes do Q quando existir', () => {
    const result = insertElementLine(FIXTURE, '192200100900020NOVO CAMPO')
    const lines = result.split('\n')
    const qIndex = lines.findIndex(l => l.trim() === 'Q0001')
    expect(lines[qIndex - 1]).toBe('192200100900020NOVO CAMPO')
    expect(lines[qIndex + 1].trim()).toBe('E')
  })

  it('insere antes do E quando não há Q', () => {
    const noQ = FIXTURE.replace('Q0001\n', '')
    const result = insertElementLine(noQ, '192200100900020NOVO CAMPO')
    const lines = result.split('\n')
    const eIndex = lines.findIndex(l => l.trim() === 'E')
    expect(lines[eIndex - 1]).toBe('192200100900020NOVO CAMPO')
  })
})

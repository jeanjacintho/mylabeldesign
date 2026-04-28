import { describe, expect, it } from 'vitest'
import { emitPplaLineLine, emitPplaTextLine } from '@/lib/ppla-emit'
import { getBaseFontHeightDots } from '@/lib/ppla-layout'
import { parsePplaCode } from '@/lib/ppla-parse-image'
import type { PplaLine, PplaText } from '@/lib/ppla-model'
import { mapDirectionCharToRotation } from '@/lib/ppla-model'
import { DEFAULT_PRINTER_DPI } from '@/lib/label-units'

const SAMPLE_JOB = `M3000
c0000
e
O0216
f320
L
D11
H10
233200502300370PURA COR
Q0001
E
`

describe('PPLA guia 12.1 / 12.2', () => {
  it('parse de bloco L..E: D11, H10, Q0001, pixelSize', () => {
    const { label } = parsePplaCode(SAMPLE_JOB, { normalizeLineEndings: true })
    expect(label.pixelSize).toEqual({ w: 1, h: 1 })
    expect(label.heat).toBe(10)
    expect(label.quantity).toBe(1)
    expect(label.stopPositionHundredths).toBe(320)
  })

  it('233200502300370PURA COR — texto e coordenadas', () => {
    const { elements } = parsePplaCode(SAMPLE_JOB, { normalizeLineEndings: true })
    const t = elements.find(
      (e): e is PplaText => e.type === 'text' && e.text === 'PURA COR',
    )
    expect(t).toBeDefined()
    if (!t) {
      return
    }
    expect(t.fontId).toBe('3')
    expect(t.widthMultiplier).toBe(3)
    expect(t.heightMultiplier).toBe(2)
    expect(t.subfont).toBe('200')
    expect(t.y).toBe(230)
    expect(t.x).toBe(370)
    expect(t.rotation).toBe(mapDirectionCharToRotation('2'))
  })
})

describe('PPLA guia 12.3 / round-trip', () => {
  it('linha: emit e parse batem', () => {
    const el: PplaLine = {
      type: 'line',
      x: 123,
      y: 1,
      rotation: 0,
      width: 2,
      height: 260,
    }
    const line = emitPplaLineLine(el)
    const { elements, label } = parsePplaCode(line, { printerDpi: DEFAULT_PRINTER_DPI })
    expect(label.pixelSize).toEqual({ w: 2, h: 2 })
    expect(elements).toHaveLength(1)
    const p = elements[0] as PplaLine
    expect(p.type).toBe('line')
    expect(p.x).toBe(123)
    expect(p.y).toBe(1)
    expect(p.width).toBe(2)
    expect(p.height).toBe(260)
  })
})

describe('getBaseFontHeightDots (guia 6.4)', () => {
  it('fonte 3 + ooo 200 → 200', () => {
    expect(getBaseFontHeightDots('3', '200')).toBe(200)
  })

  it('fonte 9 + 003 → 10pt ≈ dots 203DPI', () => {
    const dots = getBaseFontHeightDots('9', '003')
    expect(dots).toBe(Math.max(4, Math.round((10 / 72) * 203)))
  })
})

describe('emit ↔ parse texto', () => {
  it('round-trip A7 texto', () => {
    const el: PplaText = {
      type: 'text',
      x: 318,
      y: 270,
      rotation: 90,
      fontId: '1',
      widthMultiplier: 2,
      heightMultiplier: 2,
      subfont: '200',
      text: 'CRIACAO',
    }
    const line = emitPplaTextLine(el)
    const { elements } = parsePplaCode(line, { printerDpi: 203 })
    expect(elements).toHaveLength(1)
    const t = elements[0] as PplaText
    expect(t.text).toBe('CRIACAO')
    expect(t.x).toBe(318)
    expect(t.y).toBe(270)
  })
})

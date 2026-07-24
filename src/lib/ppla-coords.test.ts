import { describe, expect, it } from 'vitest'
import {
  dotsToStagePx,
  elementTopLeftStagePosition,
  fromRawHeaderXY,
  snapToNearestScaleMultiplier,
  stagePositionToElementXY,
  stagePxToDots,
  toRawHeaderXY,
} from '@/lib/ppla-coords'
import type { PplaLine, PplaText } from '@/lib/ppla-model'

const DPI = 203
const SCALE = 2

describe('dotsToStagePx / stagePxToDots', () => {
  it('são inversas uma da outra', () => {
    const px = dotsToStagePx(150, DPI, SCALE)
    expect(stagePxToDots(px, DPI, SCALE)).toBeCloseTo(150, 6)
  })
})

describe('elementTopLeftStagePosition / stagePositionToElementXY', () => {
  it('round-trip preserva x/y de um elemento sem rotação', () => {
    const el: PplaLine = { type: 'line', x: 100, y: 50, rotation: 0, width: 20, height: 30 }
    const canvasHeightPx = 800
    const pos = elementTopLeftStagePosition(el, canvasHeightPx, DPI, SCALE)
    const back = stagePositionToElementXY(pos.x, pos.y, 30, canvasHeightPx, DPI, SCALE)
    expect(back.x).toBeCloseTo(el.x, 6)
    expect(back.y).toBeCloseTo(el.y, 6)
  })

  it('arrastar pra baixo na tela diminui o y do PPLA (origem embaixo, Y pra cima)', () => {
    const el: PplaLine = { type: 'line', x: 100, y: 50, rotation: 0, width: 20, height: 30 }
    const canvasHeightPx = 800
    const pos = elementTopLeftStagePosition(el, canvasHeightPx, DPI, SCALE)
    const movedDown = stagePositionToElementXY(pos.x, pos.y + 40, 30, canvasHeightPx, DPI, SCALE)
    expect(movedDown.y).toBeLessThan(el.y)
  })

  it('para rotação 90°, a extensão vertical usa a largura local (swap já embutido em getPplaElementVerticalExtentDots)', () => {
    const el: PplaText = {
      type: 'text', x: 100, y: 50, rotation: 90, fontId: '1',
      widthMultiplier: 1, heightMultiplier: 1, subfont: '000', text: 'AB',
    }
    const canvasHeightPx = 800
    // não deve lançar, e deve produzir uma posição finita e sensata
    const pos = elementTopLeftStagePosition(el, canvasHeightPx, DPI, SCALE)
    expect(Number.isFinite(pos.x)).toBe(true)
    expect(Number.isFinite(pos.y)).toBe(true)
  })
})

describe('toRawHeaderXY / fromRawHeaderXY', () => {
  it('inverte e reaplica o shift de elemento + global corretamente', () => {
    const shift = { dx: 12, dy: -8 }
    const globalX = 5
    const globalY = 3
    const raw = toRawHeaderXY(200, 150, shift, globalX, globalY)
    // 200 - 12 - 5 = 183 ; 150 - (-8) - 3 = 155
    expect(raw.x).toBeCloseTo(183, 6)
    expect(raw.y).toBeCloseTo(155, 6)

    const back = fromRawHeaderXY(raw.x, raw.y, shift, globalX, globalY)
    expect(back.x).toBeCloseTo(200, 6)
    expect(back.y).toBeCloseTo(150, 6)
  })

  it('shift zero não altera o valor', () => {
    const raw = toRawHeaderXY(77, 88, { dx: 0, dy: 0 }, 0, 0)
    expect(raw.x).toBe(77)
    expect(raw.y).toBe(88)
  })
})

describe('snapToNearestScaleMultiplier', () => {
  it('arredonda pro inteiro mais próximo dentro de 1-24', () => {
    expect(snapToNearestScaleMultiplier(3.4)).toBe(3)
    expect(snapToNearestScaleMultiplier(3.6)).toBe(4)
  })

  it('satura em 1 e 24', () => {
    expect(snapToNearestScaleMultiplier(0)).toBe(1)
    expect(snapToNearestScaleMultiplier(-5)).toBe(1)
    expect(snapToNearestScaleMultiplier(99)).toBe(24)
  })
})

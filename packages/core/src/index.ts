export type LabelProtocol = 'PPLA' | 'PPLB' | 'ZPL'

export type LabelElementKind = 'text' | 'barcode'

export interface LabelSetup {
  dpi: number
  darkness?: number
  quantity?: number
  speed?: string
  density?: string
}

export interface LabelElementModel {
  id: string
  commandIndex: number
  kind: LabelElementKind
  name: string
  rawCommand: string
  content: string
  xDots: number
  yDots: number
  sourceYDots: number
  widthDots: number
  heightDots: number
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  rotation: number
  meta: string
  font?: {
    family: string
    residentId: string
    typeId: string
    scaleX: number
    scaleY: number
  }
  barcode?: {
    symbology: string
    narrowBarDots: number
    wideBarDots: number
  }
}

export interface ParsedLabelCanvas {
  widthDots: number
  heightDots: number
  widthMm: number
  heightMm: number
}

export interface ParsedLabelDocument {
  protocol: LabelProtocol
  source: string
  commands: string[]
  setup: LabelSetup
  canvas: ParsedLabelCanvas
  elements: LabelElementModel[]
  warnings: string[]
}
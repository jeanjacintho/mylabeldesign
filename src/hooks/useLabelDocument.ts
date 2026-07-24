import { useCallback, useMemo, useState } from 'react'
import type { AnyPplaElement, PplaElementKind } from '@/lib/ppla-model'
import { parsePplaCode, parsePplaLabelPreamble } from '@/lib/ppla-parse-image'
import { estimateCoordinateDpiFromPplaCode, printStartOffsetDotsX, verticalPrintOffsetDotsY } from '@/lib/ppla-parse-preamble'
import { emitPplaElementLine } from '@/lib/ppla-emit'
import { createDefaultElement, insertElementLine, removeLineAt, replaceLineAt } from '@/lib/ppla-document'
import { toRawHeaderXY } from '@/lib/ppla-coords'

const UNDO_STACK_LIMIT = 100

export interface UseLabelDocumentOptions {
  /** DPI escolhido na UI — só usado quando o próprio código não declara um `Dwh` (D11 etc). */
  fallbackPrinterDpi: number
}

/**
 * Fonte única de verdade do editor visual: `code` (texto PPLA cru) é o dado real; tudo
 * mais (`elements`, `label`, índices de linha, shifts, `coordinateDpi`) é derivado via
 * parse a cada mudança de código — nunca mantido como estado próprio (evita divergência).
 *
 * Editar visualmente (arrastar/redimensionar/painel) substitui/insere/remove só a linha
 * daquele elemento no texto (ppla-document.ts) — todo o resto do arquivo (preâmbulo,
 * comandos de fornecedor desconhecidos) fica intocado.
 */
export function useLabelDocument(initialCode: string, options: UseLabelDocumentOptions) {
  const { fallbackPrinterDpi } = options
  const [code, setCodeState] = useState(initialCode)
  const [undoStack, setUndoStack] = useState<string[]>([])
  const [redoStack, setRedoStack] = useState<string[]>([])
  const [selectedIndex, setSelectedIndexState] = useState<number | null>(null)

  const coordinateDpi = useMemo(
    () => estimateCoordinateDpiFromPplaCode(code) ?? fallbackPrinterDpi,
    [code, fallbackPrinterDpi],
  )

  const parseResult = useMemo(
    () => parsePplaCode(code, { normalizeLineEndings: true, printerDpi: coordinateDpi }),
    [code, coordinateDpi],
  )
  const { elements, label, diagnostics, elementSourceLines, elementFormatShifts } = parseResult

  const globalShift = useMemo(() => {
    const preamble = parsePplaLabelPreamble(code)
    return {
      dx: printStartOffsetDotsX(preamble, coordinateDpi),
      dy: verticalPrintOffsetDotsY(preamble, coordinateDpi),
    }
  }, [code, coordinateDpi])

  const selectedElement =
    selectedIndex !== null && selectedIndex >= 0 && selectedIndex < elements.length
      ? elements[selectedIndex]
      : null

  const setSelectedIndex = useCallback((index: number | null) => {
    setSelectedIndexState(index)
  }, [])

  /** Reclampa a seleção pro índice válido mais próximo sempre que a lista de elementos muda de tamanho. */
  const clampSelection = useCallback((nextLength: number) => {
    setSelectedIndexState(prev => {
      if (prev === null) return null
      if (nextLength === 0) return null
      return Math.min(prev, nextLength - 1)
    })
  }, [])

  const commit = useCallback((nextCode: string) => {
    setUndoStack(prev => {
      const next = [...prev, code]
      return next.length > UNDO_STACK_LIMIT ? next.slice(next.length - UNDO_STACK_LIMIT) : next
    })
    setRedoStack([])
    setCodeState(nextCode)
  }, [code])

  /** Edição direta do texto (textarea de código) — também entra na pilha de undo. */
  const setCode = useCallback((nextCode: string) => {
    commit(nextCode)
  }, [commit])

  const undo = useCallback(() => {
    if (undoStack.length === 0) return
    const previous = undoStack[undoStack.length - 1]
    setUndoStack(prev => prev.slice(0, -1))
    setRedoStack(prev => [...prev, code])
    setCodeState(previous)
  }, [code, undoStack])

  const redo = useCallback(() => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setRedoStack(prev => prev.slice(0, -1))
    setUndoStack(prev => [...prev, code])
    setCodeState(next)
  }, [code, redoStack])

  const updateElement = useCallback((index: number, patch: Partial<AnyPplaElement>) => {
    const current = elements[index]
    const lineIndex = elementSourceLines[index]
    const shift = elementFormatShifts[index]
    if (!current || lineIndex === undefined || !shift) {
      return
    }

    const merged = { ...current, ...patch } as AnyPplaElement
    const raw = toRawHeaderXY(merged.x, merged.y, shift, globalShift.dx, globalShift.dy)
    const rawElement = { ...merged, x: raw.x, y: raw.y }
    const newLine = emitPplaElementLine(rawElement)

    const nextCode = replaceLineAt(code, lineIndex, newLine)
    commit(nextCode)
  }, [code, commit, elementFormatShifts, elementSourceLines, elements, globalShift])

  const addElement = useCallback((kind: PplaElementKind, xDots: number, yDots: number) => {
    const draft = createDefaultElement(kind, xDots, yDots)
    // novo elemento entra no fim do bloco atual: o shift vigente nesse ponto é o estado
    // final do label (nada muda `C`/`R` depois dele, já que é inserido antes de Q/E)
    const shift = {
      dx: (label.formatLeftMarginHundredths / 100) * coordinateDpi,
      dy: (label.formatVerticalOffsetHundredths / 100) * coordinateDpi,
    }
    const raw = toRawHeaderXY(draft.x, draft.y, shift, globalShift.dx, globalShift.dy)
    const rawElement = { ...draft, x: raw.x, y: raw.y }
    const newLine = emitPplaElementLine(rawElement)

    const nextCode = insertElementLine(code, newLine)
    commit(nextCode)
    setSelectedIndexState(elements.length)
  }, [code, coordinateDpi, commit, elements.length, globalShift, label.formatLeftMarginHundredths, label.formatVerticalOffsetHundredths])

  const deleteElement = useCallback((index: number) => {
    const lineIndex = elementSourceLines[index]
    if (lineIndex === undefined) return
    const nextCode = removeLineAt(code, lineIndex)
    commit(nextCode)
    clampSelection(elements.length - 1)
  }, [clampSelection, code, commit, elementSourceLines, elements.length])

  return {
    code,
    setCode,
    elements,
    label,
    diagnostics,
    coordinateDpi,
    selectedIndex,
    setSelectedIndex,
    selectedElement,
    updateElement,
    addElement,
    deleteElement,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  }
}

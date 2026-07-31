import { useCallback, useMemo, useState } from 'react'
import type { AnyPplaElement, PplaElementKind } from '@/lib/ppla-model'
import { findPplaLabelBlocks, parsePplaCode, parsePplaLabelPreamble } from '@/lib/ppla-parse-image'
import { estimateCoordinateDpiFromPplaCode, printStartOffsetDotsX, verticalPrintOffsetDotsY } from '@/lib/ppla-parse-preamble'
import { emitPplaElementLine } from '@/lib/ppla-emit'
import { createDefaultElement, insertElementLine, removeLineAt, replaceLineAt } from '@/lib/ppla-document'
import { toRawHeaderXY } from '@/lib/ppla-coords'

const UNDO_STACK_LIMIT = 100

export interface UseLabelDocumentOptions {
  /** DPI chosen in the UI — only used when the code itself doesn't declare a `Dwh` (D11 etc). */
  fallbackPrinterDpi: number
}

/**
 * Single source of truth for the visual editor: `code` (raw PPLA text) is the real data;
 * everything else (`elements`, `label`, line indices, shifts, `coordinateDpi`) is derived
 * via parsing on every code change — never kept as its own state (avoids divergence).
 *
 * Editing visually (drag/resize/panel) replaces/inserts/removes only that element's line
 * in the text (ppla-document.ts) — the rest of the file (preamble, unknown vendor
 * commands) is left untouched.
 */
export function useLabelDocument(initialCode: string, options: UseLabelDocumentOptions) {
  const { fallbackPrinterDpi } = options
  const [code, setCodeState] = useState(initialCode)
  const [undoStack, setUndoStack] = useState<string[]>([])
  const [redoStack, setRedoStack] = useState<string[]>([])
  const [selectedIndex, setSelectedIndexState] = useState<number | null>(null)
  const [selectedBlockIndexState, setSelectedBlockIndexState] = useState(0)

  const coordinateDpi = useMemo(
    () => estimateCoordinateDpiFromPplaCode(code) ?? fallbackPrinterDpi,
    [code, fallbackPrinterDpi],
  )

  const parseResult = useMemo(
    () => parsePplaCode(code, { normalizeLineEndings: true, printerDpi: coordinateDpi }),
    [code, coordinateDpi],
  )
  const { label, diagnostics } = parseResult

  /**
   * A pasted job printing a batch of labels (e.g. "ROLO: 1/7".."7/7") concatenates several
   * full `L..E` blocks — showing/editing all of them at once overlays every copy on the
   * same x/y grid. `labelBlocks` finds each block so the UI can show one at a time;
   * `selectedBlockIndex` picks which. With 0 or 1 blocks, nothing is filtered (same
   * behavior as before this existed).
   */
  const labelBlocks = useMemo(
    () => findPplaLabelBlocks(code, true),
    [code],
  )
  const selectedBlockIndex = Math.max(
    0,
    Math.min(selectedBlockIndexState, labelBlocks.length - 1),
  )

  const activeBlock = labelBlocks.length > 1 ? labelBlocks[selectedBlockIndex] : null

  const { elements, elementSourceLines, elementFormatShifts } = useMemo(() => {
    if (!activeBlock) {
      return {
        elements: parseResult.elements,
        elementSourceLines: parseResult.elementSourceLines,
        elementFormatShifts: parseResult.elementFormatShifts,
      }
    }
    const filteredElements: AnyPplaElement[] = []
    const filteredSourceLines: number[] = []
    const filteredFormatShifts = [] as typeof parseResult.elementFormatShifts
    parseResult.elementSourceLines.forEach((lineIndex, i) => {
      if (lineIndex >= activeBlock.startLine && lineIndex <= activeBlock.endLine) {
        filteredElements.push(parseResult.elements[i])
        filteredSourceLines.push(lineIndex)
        filteredFormatShifts.push(parseResult.elementFormatShifts[i])
      }
    })
    return {
      elements: filteredElements,
      elementSourceLines: filteredSourceLines,
      elementFormatShifts: filteredFormatShifts,
    }
  }, [activeBlock, parseResult])

  /** Selects which label block (0-based) to show/edit; clamped to the available range. */
  const setSelectedBlockIndex = useCallback((index: number) => {
    setSelectedBlockIndexState(index)
    setSelectedIndexState(null)
  }, [])

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

  /** Sets which element index is currently selected (or `null` to clear selection). */
  const setSelectedIndex = useCallback((index: number | null) => {
    setSelectedIndexState(index)
  }, [])

  /** Re-clamps the selection to the nearest valid index whenever the element list changes size. */
  const clampSelection = useCallback((nextLength: number) => {
    setSelectedIndexState(prev => {
      if (prev === null) return null
      if (nextLength === 0) return null
      return Math.min(prev, nextLength - 1)
    })
  }, [])

  /** Pushes the current code onto the undo stack, clears redo, and applies `nextCode`. */
  const commit = useCallback((nextCode: string) => {
    setUndoStack(prev => {
      const next = [...prev, code]
      return next.length > UNDO_STACK_LIMIT ? next.slice(next.length - UNDO_STACK_LIMIT) : next
    })
    setRedoStack([])
    setCodeState(nextCode)
  }, [code])

  /** Direct edit of the code text (the code panel's textarea) — also goes onto the undo stack. */
  const setCode = useCallback((nextCode: string) => {
    commit(nextCode)
  }, [commit])

  /** Reverts to the previous code snapshot, moving the current one onto the redo stack. */
  const undo = useCallback(() => {
    if (undoStack.length === 0) return
    const previous = undoStack[undoStack.length - 1]
    setUndoStack(prev => prev.slice(0, -1))
    setRedoStack(prev => [...prev, code])
    setCodeState(previous)
  }, [code, undoStack])

  /** Re-applies the most recently undone code snapshot, moving the current one onto the undo stack. */
  const redo = useCallback(() => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setRedoStack(prev => prev.slice(0, -1))
    setUndoStack(prev => [...prev, code])
    setCodeState(next)
  }, [code, redoStack])

  /**
   * Applies a partial update to one element (position, size, text, etc.), re-emits just
   * that element's PPLA line (inverting the recorded margin/preamble shift first), and
   * surgically replaces only that source line in the code.
   */
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

  /** Creates a default element of `kind` at the given dots position and inserts its line into the active block. */
  const addElement = useCallback((kind: PplaElementKind, xDots: number, yDots: number) => {
    const draft = createDefaultElement(kind, xDots, yDots)
    // the new element lands at the end of the current block: the shift in effect at that
    // point is the label's final state (nothing changes `C`/`R` after it, since it's
    // inserted before Q/E)
    const shift = {
      dx: (label.formatLeftMarginHundredths / 100) * coordinateDpi,
      dy: (label.formatVerticalOffsetHundredths / 100) * coordinateDpi,
    }
    const raw = toRawHeaderXY(draft.x, draft.y, shift, globalShift.dx, globalShift.dy)
    const rawElement = { ...draft, x: raw.x, y: raw.y }
    const newLine = emitPplaElementLine(rawElement)

    const nextCode = insertElementLine(code, newLine, activeBlock?.endLine)
    commit(nextCode)
    setSelectedIndexState(elements.length)
  }, [activeBlock, code, coordinateDpi, commit, elements.length, globalShift, label.formatLeftMarginHundredths, label.formatVerticalOffsetHundredths])

  /** Removes one element's source line from the code and adjusts the selection accordingly. */
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
    /** How many `L..E` label blocks the pasted job has (1 for a normal single-label file). */
    labelBlockCount: labelBlocks.length,
    /** Which block (0-based) is currently shown/edited — only meaningful when `labelBlockCount > 1`. */
    selectedBlockIndex,
    setSelectedBlockIndex,
  }
}

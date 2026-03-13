import type { LabelElementModel, ParsedLabelDocument } from '@openlabel/core'
import {
  parsePpla,
  updatePplaElementContent,
  updatePplaElementCoordinates,
} from '@openlabel/protocols'

function resolveSelectedId(document: ParsedLabelDocument, currentSelectedId: string | null) {
  if (!document.elements.length) {
    return null
  }

  if (currentSelectedId && document.elements.some(element => element.id === currentSelectedId)) {
    return currentSelectedId
  }

  return document.elements[0].id
}

function parseDocumentState(sourceCode: string, selectedId: string | null) {
  const document = parsePpla(sourceCode)

  return {
    document,
    selectedId: resolveSelectedId(document, selectedId),
  }
}

export interface LabelEditorStore {
  initialized: boolean
  sampleSource: string
  sourceCode: string
  document: ParsedLabelDocument
  selectedId: string | null
  codeDialogOpen: boolean
  isParsing: boolean
  initialize: (sampleSource: string) => void
  setSourceCode: (sourceCode: string) => void
  setCodeDialogOpen: (open: boolean) => void
  selectElement: (id: string | null) => void
  updateSelectedTextContent: (value: string) => void
  updateSelectedElementCoordinate: (axis: 'x' | 'y', value: string) => void
  resetSampleSource: () => void
}

const emptyDocument = parsePpla('')

type Listener = () => void

let state: LabelEditorStore

const listeners = new Set<Listener>()

function emitChange() {
  listeners.forEach(listener => listener())
}

function setState(partial: Partial<LabelEditorStore>) {
  state = {
    ...state,
    ...partial,
  }
  emitChange()
}

function getState() {
  return state
}

function subscribe(listener: Listener) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

state = {
  initialized: false,
  sampleSource: '',
  sourceCode: '',
  document: emptyDocument,
  selectedId: null,
  codeDialogOpen: false,
  isParsing: false,

  initialize: sampleSource => {
    const trimmedSource = sampleSource.trim()
    const current = getState()

    if (current.initialized && current.sampleSource === trimmedSource) {
      return
    }

    const nextState = parseDocumentState(trimmedSource, current.selectedId)

    setState({
      initialized: true,
      sampleSource: trimmedSource,
      sourceCode: trimmedSource,
      document: nextState.document,
      selectedId: nextState.selectedId,
    })
  },

  setSourceCode: sourceCode => {
    const current = getState()
    const nextState = parseDocumentState(sourceCode, current.selectedId)

    setState({
      sourceCode,
      document: nextState.document,
      selectedId: nextState.selectedId,
      isParsing: false,
    })
  },

  setCodeDialogOpen: codeDialogOpen => setState({ codeDialogOpen }),

  selectElement: selectedId => setState({ selectedId }),

  updateSelectedTextContent: value => {
    const { selectedId, sourceCode, document } = getState()

    if (!selectedId) {
      return
    }

    const selectedElement = document.elements.find(element => element.id === selectedId)

    if (!selectedElement || selectedElement.kind !== 'text') {
      return
    }

    getState().setSourceCode(updatePplaElementContent(sourceCode, selectedElement, value))
  },

  updateSelectedElementCoordinate: (axis, value) => {
    const { selectedId, sourceCode, document } = getState()

    if (!selectedId) {
      return
    }

    const selectedElement = document.elements.find(element => element.id === selectedId)
    const numericValue = Number(value)

    if (!selectedElement || Number.isNaN(numericValue)) {
      return
    }

    getState().setSourceCode(
      updatePplaElementCoordinates(sourceCode, selectedElement, axis, numericValue),
    )
  },

  resetSampleSource: () => {
    const { sampleSource } = getState()
    getState().setSourceCode(sampleSource)
  },
}

export function subscribeLabelEditorStore(listener: Listener) {
  return subscribe(listener)
}

export function getLabelEditorState() {
  return getState()
}

export function selectCurrentElement(
  document: ParsedLabelDocument,
  selectedId: string | null,
): LabelElementModel | null {
  return document.elements.find(element => element.id === selectedId) ?? null
}
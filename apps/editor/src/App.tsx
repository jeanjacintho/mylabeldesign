import './App.css'
import { useEffect, useSyncExternalStore } from 'react'

import { Toolbar } from './components/Toolbar'
import { LayersPanel } from './components/LayersPanel'
import { Canvas } from './components/Canvas'
import { PropertiesPanel } from './components/PropertiesPanel'
import { CodeDialog } from './components/CodeDialog'
import {
  getLabelEditorState,
  selectCurrentElement,
  subscribeLabelEditorStore,
} from '@openlabel/store'

import samplePpla from '../../../labels/ppla.txt?raw'

function useLabelEditorStore<T>(selector: (state: ReturnType<typeof getLabelEditorState>) => T) {
  return useSyncExternalStore(
    subscribeLabelEditorStore,
    () => selector(getLabelEditorState()),
    () => selector(getLabelEditorState()),
  )
}

function App() {
  const initialize = useLabelEditorStore(state => state.initialize)
  const sourceCode = useLabelEditorStore(state => state.sourceCode)
  const document = useLabelEditorStore(state => state.document)
  const selectedId = useLabelEditorStore(state => state.selectedId)
  const codeDialogOpen = useLabelEditorStore(state => state.codeDialogOpen)
  const isParsing = useLabelEditorStore(state => state.isParsing)
  const setSourceCode = useLabelEditorStore(state => state.setSourceCode)
  const setCodeDialogOpen = useLabelEditorStore(state => state.setCodeDialogOpen)
  const selectElement = useLabelEditorStore(state => state.selectElement)
  const updateSelectedTextContent = useLabelEditorStore(state => state.updateSelectedTextContent)
  const updateSelectedElementCoordinate = useLabelEditorStore(state => state.updateSelectedElementCoordinate)
  const resetSampleSource = useLabelEditorStore(state => state.resetSampleSource)

  const selectedElement = selectCurrentElement(document, selectedId)

  useEffect(() => {
    initialize(samplePpla)
  }, [initialize])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#1e1e1e] text-[#e5e5e5]">
      <Toolbar onOpenCode={() => setCodeDialogOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <LayersPanel
          document={document}
          selectedId={selectedId}
          onSelect={selectElement}
        />
        <Canvas
          document={document}
          selectedId={selectedId}
          onSelect={selectElement}
        />
        <PropertiesPanel
          document={document}
          selectedElement={selectedElement}
          onContentChange={updateSelectedTextContent}
          onCoordinateChange={updateSelectedElementCoordinate}
        />
      </div>
      <CodeDialog
        open={codeDialogOpen}
        onOpenChange={setCodeDialogOpen}
        sourceCode={sourceCode}
        onSourceCodeChange={setSourceCode}
        parsedDocument={document}
        onResetSample={resetSampleSource}
        isParsing={isParsing}
      />
    </div>
  )
}

export default App


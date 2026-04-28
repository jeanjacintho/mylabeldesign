import { Copy, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { estimateCoordinateDpiFromPplaCode } from '@/lib/ppla-engine'
import {
  DEFAULT_LABEL_HEIGHT_MM,
  DEFAULT_LABEL_WIDTH_MM,
  DEFAULT_PREVIEW_SCREEN_SCALE,
  DEFAULT_PRINTER_DPI,
} from '@/lib/label-units'
import { Toolbar } from './components/Toolbar'
import { LayersPanel } from './components/LayersPanel'
import { Canvas } from './components/Canvas'
import { PropertiesPanel } from './components/PropertiesPanel'

const INITIAL_PPLA_CODE = `121100001000000MyLabelDesign
1X1100001000200B200030002003`
const DEFAULT_PPLA_PANEL_WIDTH = 440
const MIN_PPLA_PANEL_WIDTH = 320
const MAX_PPLA_PANEL_WIDTH = 760
const MIN_LABEL_MM = 5
const MAX_LABEL_MM = 400

function clampLabelMm(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.min(MAX_LABEL_MM, Math.max(MIN_LABEL_MM, value))
}

function App() {
  const [isPplaPanelOpen, setIsPplaPanelOpen] = useState(false)
  const [pplaCode, setPplaCode] = useState(INITIAL_PPLA_CODE)
  const [labelWidthMm, setLabelWidthMm] = useState(DEFAULT_LABEL_WIDTH_MM)
  const [labelHeightMm, setLabelHeightMm] = useState(DEFAULT_LABEL_HEIGHT_MM)
  const [printerDpi, setPrinterDpi] = useState(DEFAULT_PRINTER_DPI)

  const layoutDpi = useMemo(
    () => estimateCoordinateDpiFromPplaCode(pplaCode) ?? printerDpi,
    [pplaCode, printerDpi],
  )
  const [pplaPanelWidth, setPplaPanelWidth] = useState(DEFAULT_PPLA_PANEL_WIDTH)
  const [isResizingPplaPanel, setIsResizingPplaPanel] = useState(false)
  const lineNumbers = useMemo(() => {
    return pplaCode.split('\n').map((_, index) => index + 1)
  }, [pplaCode])

  useEffect(() => {
    if (!isResizingPplaPanel) {
      return
    }

    function handlePointerMove(event: MouseEvent) {
      const nextWidth = window.innerWidth - event.clientX - 16
      const clampedWidth = Math.min(
        MAX_PPLA_PANEL_WIDTH,
        Math.max(MIN_PPLA_PANEL_WIDTH, nextWidth),
      )

      setPplaPanelWidth(clampedWidth)
    }

    function handlePointerUp() {
      setIsResizingPplaPanel(false)
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)

    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [isResizingPplaPanel])

  return (
    <div className="relative flex flex-col h-screen w-screen overflow-hidden bg-[#1e1e1e] text-[#e5e5e5]">
      <Toolbar
        onTogglePplaCode={() => {
          setIsPplaPanelOpen(open => !open)
        }}
      />
      <div className="flex flex-1 overflow-hidden">
        <LayersPanel />
        <Canvas
          pplaCode={pplaCode}
          labelWidthMm={labelWidthMm}
          labelHeightMm={labelHeightMm}
          coordinateDpi={layoutDpi}
          previewScreenScale={DEFAULT_PREVIEW_SCREEN_SCALE}
        />
        <PropertiesPanel
          labelWidthMm={labelWidthMm}
          labelHeightMm={labelHeightMm}
          printerDpi={printerDpi}
          layoutDpi={layoutDpi}
          previewScreenScale={DEFAULT_PREVIEW_SCREEN_SCALE}
          onPrinterDpiChange={setPrinterDpi}
          onApplyLabelSizeMm={(widthMm, heightMm) => {
            setLabelWidthMm(clampLabelMm(widthMm, DEFAULT_LABEL_WIDTH_MM))
            setLabelHeightMm(clampLabelMm(heightMm, DEFAULT_LABEL_HEIGHT_MM))
          }}
        />
      </div>

      {isPplaPanelOpen && (
        <div
          className="absolute inset-y-4 right-4 z-20 overflow-hidden rounded-xl border border-[#2b3444] bg-[#0b1220] shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
          style={{ width: pplaPanelWidth }}
        >
          <button
            type="button"
            aria-label="Resize code panel"
            className="absolute inset-y-0 left-0 z-10 w-2 cursor-col-resize bg-transparent transition-colors hover:bg-[#60a5fa]/10"
            onMouseDown={() => setIsResizingPplaPanel(true)}
          />

          <div className="flex items-center justify-between border-b border-[#1e293b] bg-[#0f172a] px-4 py-2">
            <div className="flex items-center gap-3">
              <div className="rounded-md border border-[#334155] bg-[#111827] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#93c5fd]">
                Code
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-[#e2e8f0]">
                  Current label output
                </span>
                <span className="text-[11px] text-[#64748b]">
                  PPLA source generated for this project
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md border border-[#334155] bg-[#111827] px-2.5 py-1.5 text-[11px] text-[#cbd5e1] transition-colors hover:bg-[#1e293b]"
                onClick={() => {
                  void navigator.clipboard.writeText(pplaCode)
                }}
              >
                <Copy size={13} />
                Copy
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#94a3b8] transition-colors hover:bg-[#1e293b] hover:text-white"
                onClick={() => setIsPplaPanelOpen(false)}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex h-[calc(100%-57px)] bg-[#020617] font-mono text-xs">
            <div className="flex w-12 shrink-0 flex-col items-end overflow-hidden border-r border-[#1e293b] bg-[#0f172a] px-2 py-3 text-[#475569]">
              {lineNumbers.map(lineNumber => (
                <span key={lineNumber} className="leading-5">
                  {lineNumber}
                </span>
              ))}
            </div>

            <textarea
              value={pplaCode}
              onChange={event => setPplaCode(event.target.value)}
              className="h-full flex-1 resize-none bg-transparent px-4 py-3 leading-5 text-[#e2e8f0] outline-none caret-[#60a5fa] border-none"
              spellCheck={false}
              wrap="off"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default App


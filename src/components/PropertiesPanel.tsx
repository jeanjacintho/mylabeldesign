import { useEffect, useMemo, useState } from 'react'
import {
  COMMON_PRINTER_DPIS,
  labelMmToPreviewPx,
} from '@/lib/label-units'
import { cn } from '@/lib/utils'
import {
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignVerticalSpaceBetween,
  AlignHorizontalSpaceBetween,
  ChevronRight,
  LayoutGrid,
  Minus,
  Plus,
  Eye,
} from 'lucide-react'

type RightTab = 'design' | 'prototype' | 'inspect'

function SectionHeader({ title, onAdd }: { title: string; onAdd?: () => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="text-xs font-semibold text-[#ccc]">{title}</span>
      {onAdd && (
        <button
          onClick={onAdd}
          className="text-[#666] hover:text-white transition-colors"
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  )
}

interface InputRowProps {
  label: string
  value: string | number
  prefix?: React.ReactNode
  onChange?: (v: string) => void
  className?: string
}

function InputField({ label, value, prefix, onChange, className }: InputRowProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className="text-[10px] text-[#666] w-3 shrink-0">{label}</span>
      <div className="flex items-center flex-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded h-6 px-2 gap-1 focus-within:border-[#1971c2]">
        {prefix && <span className="text-[#555] text-[10px]">{prefix}</span>}
        <input
          className="flex-1 bg-transparent text-xs text-[#ccc] outline-none w-0"
          value={value}
          onChange={e => onChange?.(e.target.value)}
        />
      </div>
    </div>
  )
}

function AlignButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      title={label}
      className="flex items-center justify-center w-7 h-7 text-[#888] hover:bg-white/10 hover:text-white rounded transition-colors"
    >
      {icon}
    </button>
  )
}

function Divider() {
  return <div className="h-px bg-[#3a3a3a] mx-0" />
}

interface PropertiesPanelProps {
  labelWidthMm: number
  labelHeightMm: number
  printerDpi: number
  /** Mesmo DPI usado no canvas (Dwh do PPLA quando existir, senão DPI da UI). */
  layoutDpi: number
  previewScreenScale: number
  onPrinterDpiChange: (dpi: number) => void
  onApplyLabelSizeMm: (widthMm: number, heightMm: number) => void
}

function parseMmInput(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.')
  if (normalized === '') {
    return null
  }
  const n = Number.parseFloat(normalized)
  if (!Number.isFinite(n)) {
    return null
  }
  return n
}

export function PropertiesPanel({
  labelWidthMm,
  labelHeightMm,
  printerDpi,
  layoutDpi,
  previewScreenScale,
  onPrinterDpiChange,
  onApplyLabelSizeMm,
}: PropertiesPanelProps) {
  const [activeTab, setActiveTab] = useState<RightTab>('design')
  const [draftWidthMm, setDraftWidthMm] = useState(String(labelWidthMm))
  const [draftHeightMm, setDraftHeightMm] = useState(String(labelHeightMm))

  useEffect(() => {
    setDraftWidthMm(String(labelWidthMm))
  }, [labelWidthMm])

  useEffect(() => {
    setDraftHeightMm(String(labelHeightMm))
  }, [labelHeightMm])

  const draftPreviewHint = useMemo(() => {
    const w = parseMmInput(draftWidthMm)
    const h = parseMmInput(draftHeightMm)
    if (w === null || h === null) {
      return null
    }
    return {
      pxW: Math.round(labelMmToPreviewPx(w, layoutDpi, previewScreenScale)),
      pxH: Math.round(labelMmToPreviewPx(h, layoutDpi, previewScreenScale)),
    }
  }, [draftHeightMm, draftWidthMm, layoutDpi, previewScreenScale])

  const [x, setX] = useState('171')
  const [y, setY] = useState('285')
  const [w] = useState('1578')
  const [h] = useState('509')
  const [rotation] = useState('0')
  const [cornerRadius] = useState('0')
  const [opacity] = useState('100')
  const [autoLayoutGap] = useState('75')
  const [paddingH] = useState('100')
  const [paddingV] = useState('80')
  const [paddingBottom] = useState('20')

  return (
    <aside className="flex flex-col w-[260px] bg-[#2c2c2c] border-l border-[#3a3a3a] shrink-0 overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center border-b border-[#3a3a3a]">
        {(['design', 'prototype', 'inspect'] as RightTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 h-9 text-xs font-medium capitalize transition-colors border-b-2',
              activeTab === tab
                ? 'text-white border-[#1971c2]'
                : 'text-[#888] border-transparent hover:text-[#ccc]',
            )}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'design' && (
          <div className="flex flex-col text-xs">
            {/* Canvas / etiqueta em mm — aplica só no botão */}
            <div className="px-3 py-2">
              <span className="text-[#ccc] font-semibold block mb-2">Canvas</span>
              <p className="text-[11px] text-[#555] mb-2">
                Largura e altura físicas (mm). O preview usa o mesmo DPI das coordenadas do PPLA
                (ex. Dwh) quando existir; senão o DPI escolhido abaixo.
              </p>
              <div className="mb-2 flex flex-col gap-1">
                <label className="text-[10px] text-[#666]" htmlFor="printer-dpi">
                  DPI impressora
                </label>
                <select
                  id="printer-dpi"
                  className="h-7 rounded border border-[#3a3a3a] bg-[#1a1a1a] px-2 text-xs text-[#ccc] outline-none focus:border-[#1971c2]"
                  value={printerDpi}
                  onChange={e => onPrinterDpiChange(Number(e.target.value))}
                >
                  {COMMON_PRINTER_DPIS.map(d => (
                    <option key={d} value={d}>
                      {d} dpi
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <InputField
                  label="W"
                  prefix="mm"
                  value={draftWidthMm}
                  onChange={setDraftWidthMm}
                />
                <InputField
                  label="H"
                  prefix="mm"
                  value={draftHeightMm}
                  onChange={setDraftHeightMm}
                />
              </div>
              {draftPreviewHint !== null && (
                <p className="text-[10px] text-[#64748b] mb-2">
                  Preview ≈ {draftPreviewHint.pxW} × {draftPreviewHint.pxH} px @ {printerDpi} dpi
                  (escala {previewScreenScale}×)
                </p>
              )}
              <button
                type="button"
                className="w-full rounded-md bg-[#1971c2] px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-[#1864ab]"
                onClick={() => {
                  const w = parseMmInput(draftWidthMm)
                  const h = parseMmInput(draftHeightMm)
                  if (w !== null && h !== null) {
                    onApplyLabelSizeMm(w, h)
                  }
                }}
              >
                Aplicar tamanho
              </button>
            </div>

            <Divider />

            {/* Alignment row */}
            <div className="flex items-center justify-between px-2 py-2">
              <AlignButton icon={<AlignStartVertical size={14} />} label="Align left" />
              <AlignButton icon={<AlignCenterVertical size={14} />} label="Align center H" />
              <AlignButton icon={<AlignEndVertical size={14} />} label="Align right" />
              <AlignButton icon={<AlignStartHorizontal size={14} />} label="Align top" />
              <AlignButton icon={<AlignCenterHorizontal size={14} />} label="Align center V" />
              <AlignButton icon={<AlignEndHorizontal size={14} />} label="Align bottom" />
              <AlignButton icon={<AlignHorizontalSpaceBetween size={14} />} label="Distribute H" />
              <AlignButton icon={<AlignVerticalSpaceBetween size={14} />} label="Distribute V" />
            </div>

            <Divider />

            {/* Frame section */}
            <div className="px-3 py-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1 text-[#ccc] font-semibold">
                  <span>Frame</span>
                  <ChevronRight size={12} className="text-[#666]" />
                </div>
                <button className="text-[#666] hover:text-white">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                </button>
              </div>

              {/* X / Y */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <InputField label="X" value={x} onChange={setX} />
                <InputField label="Y" value={y} onChange={setY} />
              </div>
              {/* W / H */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <InputField label="W" value={w} />
                <InputField label="H" value={h} />
              </div>

              {/* Hug dropdowns */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="flex items-center bg-[#1a1a1a] border border-[#3a3a3a] rounded h-6 px-2 gap-1 cursor-pointer">
                  <ChevronRight size={10} className="text-[#555]" />
                  <span className="text-[11px] text-[#888]">Hug</span>
                </div>
                <div className="flex items-center bg-[#1a1a1a] border border-[#3a3a3a] rounded h-6 px-2 gap-1 cursor-pointer">
                  <span className="text-[10px] text-[#555]">X</span>
                  <span className="text-[11px] text-[#888]">Hug</span>
                </div>
              </div>

              {/* Rotation / Corner radius */}
              <div className="grid grid-cols-2 gap-2">
                <InputField label="L" value={`${rotation}°`} />
                <InputField label="⌒" value={cornerRadius} />
              </div>

              {/* Clip content */}
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="clip-content" className="w-3.5 h-3.5 accent-[#1971c2]" />
                <label htmlFor="clip-content" className="text-[11px] text-[#888] cursor-pointer">
                  Clip content
                </label>
              </div>
            </div>

            <Divider />

            {/* Auto Layout */}
            <div className="px-3 py-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[#ccc] font-semibold">Auto layout</span>
                <button className="text-[#666] hover:text-white">
                  <Minus size={14} />
                </button>
              </div>

              {/* Direction + alignment grid */}
              <div className="flex items-start gap-2 mb-2">
                <div className="flex gap-1">
                  <button className="flex items-center justify-center w-7 h-7 bg-[#1971c2]/20 border border-[#1971c2] rounded text-[#1971c2]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>
                  <button className="flex items-center justify-center w-7 h-7 bg-[#1a1a1a] border border-[#3a3a3a] rounded text-[#888] hover:text-white">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 19V5M5 12l7-7 7 7"/>
                    </svg>
                  </button>
                </div>

                {/* Alignment grid */}
                <div className="grid grid-cols-3 gap-0.5 bg-[#1a1a1a] border border-[#3a3a3a] rounded p-1">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-4 h-4 rounded-sm cursor-pointer hover:bg-white/20',
                        i === 4 ? 'bg-[#1971c2]' : 'bg-[#3a3a3a]',
                      )}
                    />
                  ))}
                </div>

                <button className="ml-auto text-[#666] hover:text-white">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                  </svg>
                </button>
              </div>

              {/* Gap */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1 flex-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded h-6 px-2">
                  <AlignHorizontalSpaceBetween size={11} className="text-[#555]" />
                  <input
                    className="flex-1 bg-transparent text-xs text-[#ccc] outline-none"
                    defaultValue={autoLayoutGap}
                  />
                </div>
                <span className="text-[#555]">—</span>
              </div>

              {/* Padding */}
              <div className="grid grid-cols-2 gap-2 mb-1">
                <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded h-6 px-2">
                  <span className="text-[10px] text-[#555]">↔</span>
                  <input className="flex-1 bg-transparent text-xs text-[#ccc] outline-none" defaultValue={paddingH} />
                </div>
                <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#1971c2] rounded h-6 px-2 ring-1 ring-[#1971c2]">
                  <span className="text-[10px] text-[#555]">↕</span>
                  <input className="flex-1 bg-transparent text-xs text-white outline-none" defaultValue={paddingV} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded h-6 px-2">
                  <span className="text-[10px] text-[#555]">↔</span>
                  <input className="flex-1 bg-transparent text-xs text-[#ccc] outline-none" defaultValue={paddingH} />
                </div>
                <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded h-6 px-2">
                  <span className="text-[10px] text-[#555]">↓</span>
                  <input className="flex-1 bg-transparent text-xs text-[#ccc] outline-none" defaultValue={paddingBottom} />
                </div>
              </div>
            </div>

            <Divider />

            {/* Constraints */}
            <div className="px-3 py-2">
              <span className="text-[#ccc] font-semibold block mb-2">Constraints</span>
              <div className="flex items-center gap-3 mb-2">
                {/* Constraint diagram */}
                <div className="relative w-12 h-12 bg-[#1a1a1a] border border-[#3a3a3a] rounded flex items-center justify-center shrink-0">
                  {/* Outer crosshairs */}
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-[#444] -translate-y-1/2" />
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#444] -translate-x-1/2" />
                  {/* Center box */}
                  <div className="w-5 h-5 border-2 border-[#1971c2] bg-[#1971c2]/20 rounded-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#555]">↔</span>
                    <button className="flex items-center gap-1 text-[11px] text-[#888] hover:text-white">
                      Left
                      <ChevronRight size={10} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#555]">↕</span>
                    <button className="flex items-center gap-1 text-[11px] text-[#888] hover:text-white">
                      Top
                      <ChevronRight size={10} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="fix-scroll" className="w-3.5 h-3.5 accent-[#1971c2]" />
                <label htmlFor="fix-scroll" className="text-[11px] text-[#888] cursor-pointer">
                  Fix position when scrolling
                </label>
              </div>
            </div>

            <Divider />

            {/* Layout Grid */}
            <SectionHeader title="Layout grid" onAdd={() => {}} />

            <Divider />

            {/* Layer */}
            <div className="px-3 py-2">
              <span className="text-[#ccc] font-semibold block mb-2">Layer</span>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border border-[#555] bg-transparent" />
                <button className="flex items-center gap-1 text-[11px] text-[#888] hover:text-white">
                  Pass through
                  <ChevronRight size={10} />
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  defaultValue={opacity}
                  className="flex-1 accent-[#1971c2] h-1"
                />
                <span className="text-[11px] text-[#888] w-8 text-right">{opacity}%</span>
                <button className="text-[#666] hover:text-white">
                  <Eye size={13} />
                </button>
              </div>
            </div>

            <Divider />

            {/* Fill */}
            <div className="px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[#ccc] font-semibold">Fill</span>
                <button
                  className="text-[#666] hover:text-white"
                  title="Add fill"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {/* no fills placeholder */}
                <p className="text-[11px] text-[#555] italic">No fills</p>
              </div>
            </div>

            <Divider />

            {/* Stroke */}
            <SectionHeader title="Stroke" onAdd={() => {}} />

            <Divider />

            {/* Effects */}
            <SectionHeader title="Effects" onAdd={() => {}} />

            <Divider />

            {/* Export */}
            <div className="px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[#ccc] font-semibold">Export</span>
                <div className="flex items-center gap-1">
                  <button className="text-[#666] hover:text-white">
                    <LayoutGrid size={13} />
                  </button>
                  <button className="text-[#666] hover:text-white">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'prototype' && (
          <div className="flex flex-col items-center justify-center h-32 text-xs text-[#555] px-4 text-center mt-8">
            Select a layer to configure prototype interactions
          </div>
        )}

        {activeTab === 'inspect' && (
          <div className="flex flex-col items-center justify-center h-32 text-xs text-[#555] px-4 text-center mt-8">
            Select a layer to inspect its properties
          </div>
        )}
      </div>
    </aside>
  )
}

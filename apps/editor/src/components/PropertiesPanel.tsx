import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  ChevronRight,
  FileCode2,
  Barcode,
  Type,
  Plus,
} from 'lucide-react'

import type { LabelElementModel, ParsedLabelDocument } from '@openlabel/core'

type RightTab = 'design' | 'prototype' | 'inspect'

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

function Divider() {
  return <div className="h-px bg-[#3a3a3a] mx-0" />
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs text-[#bfbfbf]">
      <span className="text-[#808080]">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}

interface PropertiesPanelProps {
  document: ParsedLabelDocument
  selectedElement: LabelElementModel | null
  onContentChange: (value: string) => void
  onCoordinateChange: (axis: 'x' | 'y', value: string) => void
}

export function PropertiesPanel({
  document,
  selectedElement,
  onContentChange,
  onCoordinateChange,
}: PropertiesPanelProps) {
  const [activeTab, setActiveTab] = useState<RightTab>('design')
  const title = selectedElement?.kind === 'barcode' ? 'Barcode' : 'Text'
  const icon = selectedElement?.kind === 'barcode'
    ? <Barcode size={14} className="text-[#cfcfcf]" />
    : <Type size={14} className="text-[#cfcfcf]" />

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
            <div className="px-3 py-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[#ccc] font-semibold">
                  {icon}
                  <span>{selectedElement ? title : 'Selection'}</span>
                  <ChevronRight size={12} className="text-[#666]" />
                </div>
                <span className="text-[11px] text-[#666]">PPLA</span>
              </div>

              {selectedElement ? (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <InputField
                      label="X"
                      value={selectedElement.xDots}
                      onChange={value => onCoordinateChange('x', value)}
                    />
                    <InputField
                      label="Y"
                      value={selectedElement.yDots}
                      onChange={value => onCoordinateChange('y', value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <InputField label="W" value={selectedElement.widthDots} />
                    <InputField label="H" value={selectedElement.heightDots} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <InputField label="mm" value={selectedElement.xMm} />
                    <InputField label="mm" value={selectedElement.yMm} />
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-[#7e7e7e]">
                  Selecione um elemento no canvas ou na lista de camadas para inspecionar a conversao PPLA.
                </p>
              )}
            </div>

            <Divider />

            <div className="px-3 py-2">
              <span className="text-[#ccc] font-semibold block mb-3">Conteudo</span>
              {selectedElement ? (
                <div className="rounded-md border border-[#373737] bg-[#1f1f1f] p-3">
                  {selectedElement.kind === 'text' ? (
                    <textarea
                      value={selectedElement.content}
                      onChange={event => onContentChange(event.target.value)}
                      spellCheck={false}
                      className="mb-3 min-h-24 w-full resize-y rounded border border-[#3d3d3d] bg-[#151515] px-2 py-2 font-mono text-[11px] leading-5 text-[#d5d5d5] outline-none focus:border-[#1971c2]"
                    />
                  ) : (
                    <p className="mb-3 break-all text-[11px] leading-5 text-[#d5d5d5]">
                      {selectedElement.content}
                    </p>
                  )}
                  <InfoRow label="Rotacao" value={`${selectedElement.rotation}°`} />
                  <InfoRow label="Meta" value={selectedElement.meta || '--'} />
                  <InfoRow label="Linha" value={selectedElement.commandIndex + 1} />
                  {selectedElement.font ? (
                    <InfoRow
                      label="Fonte"
                      value={`${selectedElement.font.residentId} (${selectedElement.font.scaleX}x${selectedElement.font.scaleY})`}
                    />
                  ) : null}
                  {selectedElement.barcode ? (
                    <InfoRow
                      label="Simbologia"
                      value={selectedElement.barcode.symbology}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>

            <Divider />

            <div className="px-3 py-2">
              <span className="text-[#ccc] font-semibold block mb-3">Importacao</span>
              <div className="rounded-md border border-[#373737] bg-[#1f1f1f] p-3">
                <div className="mb-3 flex items-center gap-2 text-[#d7d7d7]">
                  <FileCode2 size={14} />
                  <span className="font-medium">Estado atual do parser</span>
                </div>
                <div className="space-y-2">
                  <InfoRow label="Protocolo" value={document.protocol} />
                  <InfoRow label="Comandos" value={document.commands.length} />
                  <InfoRow label="Warnings" value={document.warnings.length} />
                  <InfoRow label="DPI" value={document.setup.dpi} />
                </div>
              </div>
            </div>

            <Divider />

            <div className="px-3 py-2">
              <span className="text-[#ccc] font-semibold block mb-3">Dispositivo</span>
              <div className="space-y-2 rounded-md border border-[#373737] bg-[#1f1f1f] p-3">
                <InfoRow label="Darkness" value={document.setup.darkness ?? '--'} />
                <InfoRow label="Speed" value={document.setup.speed ?? '--'} />
                <InfoRow label="Density" value={document.setup.density ?? '--'} />
                <InfoRow label="Quantidade" value={document.setup.quantity ?? '--'} />
              </div>
            </div>

            <Divider />

            <div className="px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[#ccc] font-semibold">Observacoes</span>
                <button
                  className="text-[#666] hover:text-white"
                  title="Add note"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                <p className="text-[11px] leading-5 text-[#7a7a7a]">
                  A leitura atual cobre linhas de texto e um placeholder inicial de codigo de barras. O proximo passo natural e mover esse parser para `packages/protocols` e adicionar conversao reversa editor → PPLA.
                </p>
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

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { AnyPplaElement } from '@/lib/ppla-model'
import {
  Type,
  Square,
  Minus,
  ImageIcon,
  Barcode,
  Trash2,
} from 'lucide-react'

const ICON_MAP: Record<AnyPplaElement['type'], React.ReactNode> = {
  text: <Type size={13} className="text-[#b3b3b3]" />,
  box: <Square size={13} className="text-[#b3b3b3]" />,
  line: <Minus size={13} className="text-[#b3b3b3]" />,
  barcode: <Barcode size={13} className="text-[#b3b3b3]" />,
  graphic: <ImageIcon size={13} className="text-[#b3b3b3]" />,
}

function labelForElement(element: AnyPplaElement): string {
  if (element.type === 'text') return element.text || 'Texto'
  if (element.type === 'barcode') return `Código de barras (${element.barcodeType})`
  if (element.type === 'box') return 'Caixa'
  if (element.type === 'line') return 'Linha'
  return element.name || 'Gráfico'
}

interface LayersPanelProps {
  elements: AnyPplaElement[]
  selectedIndex: number | null
  onSelect: (index: number | null) => void
  onDelete: (index: number) => void
}

export function LayersPanel({ elements, selectedIndex, onSelect, onDelete }: LayersPanelProps) {
  const [activeTab, setActiveTab] = useState<'layers' | 'assets'>('layers')

  return (
    <aside className="flex flex-col w-60 bg-[#2c2c2c] border-r border-[#3a3a3a] overflow-hidden shrink-0">
      <div className="flex items-center border-b border-[#3a3a3a] px-1">
        <button
          onClick={() => setActiveTab('layers')}
          className={cn(
            'px-3 h-9 text-xs font-medium transition-colors border-b-2',
            activeTab === 'layers'
              ? 'text-white border-[#1971c2]'
              : 'text-[#888] border-transparent hover:text-[#ccc]',
          )}
        >
          Layers
        </button>
        <button
          onClick={() => setActiveTab('assets')}
          className={cn(
            'px-3 h-9 text-xs font-medium transition-colors border-b-2',
            activeTab === 'assets'
              ? 'text-white border-[#1971c2]'
              : 'text-[#888] border-transparent hover:text-[#ccc]',
          )}
        >
          Assets
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {activeTab === 'layers' ? (
          elements.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-xs text-[#555] px-4 text-center">
              Nenhum elemento no código PPLA atual
            </div>
          ) : (
            <div className="px-1">
              {elements.map((element, index) => {
                const isSelected = selectedIndex === index
                return (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center gap-1.5 h-7 px-2 rounded cursor-pointer text-xs group',
                      'hover:bg-white/5',
                      isSelected ? 'bg-[#1971c2]/30 text-white' : 'text-[#cccccc]',
                    )}
                    onClick={() => onSelect(index)}
                  >
                    <span className="shrink-0">{ICON_MAP[element.type]}</span>
                    <span className="truncate flex-1">{labelForElement(element)}</span>
                    <button
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-[#888] hover:text-[#ff6b6b] transition-opacity"
                      onClick={e => {
                        e.stopPropagation()
                        onDelete(index)
                      }}
                      title="Excluir"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-xs text-[#555]">
            No assets yet
          </div>
        )}
      </div>
    </aside>
  )
}

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  ChevronRight,
  ChevronDown,
  Square,
  Frame,
  Type,
  ImageIcon,
  Group,
  Circle,
} from 'lucide-react'

type LayerType = 'frame' | 'rectangle' | 'text' | 'image' | 'group' | 'ellipse'

interface Layer {
  id: string
  name: string
  type: LayerType
  children?: Layer[]
}

const ICON_MAP: Record<LayerType, React.ReactNode> = {
  frame: <Frame size={13} className="text-[#5c9cf5]" />,
  rectangle: <Square size={13} className="text-[#b3b3b3]" />,
  text: <Type size={13} className="text-[#b3b3b3]" />,
  image: <ImageIcon size={13} className="text-[#b3b3b3]" />,
  group: <Group size={13} className="text-[#b3b3b3]" />,
  ellipse: <Circle size={13} className="text-[#b3b3b3]" />,
}

const INITIAL_LAYERS: Layer[] = [
  {
    id: 'frame-1',
    name: 'Frame 1',
    type: 'frame',
    children: [
      {
        id: 'frame-2',
        name: 'Frame 2',
        type: 'frame',
        children: [
          { id: 'rect-1', name: 'Rectangle 1', type: 'rectangle' },
          { id: 'rect-2', name: 'Rectangle 2', type: 'rectangle' },
          { id: 'rect-3', name: 'Rectangle 3', type: 'rectangle' },
        ],
      },
    ],
  },
]

interface LayerRowProps {
  layer: Layer
  depth: number
  selected: string | null
  onSelect: (id: string) => void
  expanded: Set<string>
  onToggle: (id: string) => void
}

function LayerRow({ layer, depth, selected, onSelect, expanded, onToggle }: LayerRowProps) {
  const hasChildren = layer.children && layer.children.length > 0
  const isExpanded = expanded.has(layer.id)
  const isSelected = selected === layer.id

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-1 h-7 px-2 rounded cursor-pointer text-xs group',
          'hover:bg-white/5',
          isSelected && 'bg-[#1971c2]/30 text-white',
          !isSelected && 'text-[#cccccc]',
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(layer.id)}
      >
        {/* Expand toggle */}
        <span
          className="flex items-center justify-center w-4 h-4 shrink-0"
          onClick={e => {
            e.stopPropagation()
            if (hasChildren) onToggle(layer.id)
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={12} className="text-[#888]" />
            ) : (
              <ChevronRight size={12} className="text-[#888]" />
            )
          ) : null}
        </span>

        {/* Icon */}
        <span className="shrink-0">{ICON_MAP[layer.type]}</span>

        {/* Name */}
        <span className="truncate ml-1">{layer.name}</span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded &&
        layer.children!.map(child => (
          <LayerRow
            key={child.id}
            layer={child}
            depth={depth + 1}
            selected={selected}
            onSelect={onSelect}
            expanded={expanded}
            onToggle={onToggle}
          />
        ))}
    </>
  )
}

export function LayersPanel() {
  const [activeTab, setActiveTab] = useState<'layers' | 'assets'>('layers')
  const [selected, setSelected] = useState<string | null>('frame-2')
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(['frame-1', 'frame-2']),
  )

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <aside className="flex flex-col w-60 bg-[#2c2c2c] border-r border-[#3a3a3a] overflow-hidden shrink-0">
      {/* Tabs + Page selector */}
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

        <div className="flex-1" />

        {/* Page selector */}
        <button className="flex items-center gap-1 text-xs text-[#888] hover:text-white px-2 h-9 transition-colors">
          Page 1
          <ChevronDown size={11} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-1">
        {activeTab === 'layers' ? (
          <div className="px-1">
            {INITIAL_LAYERS.map(layer => (
              <LayerRow
                key={layer.id}
                layer={layer}
                depth={0}
                selected={selected}
                onSelect={setSelected}
                expanded={expanded}
                onToggle={toggleExpand}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-xs text-[#555]">
            No assets yet
          </div>
        )}
      </div>
    </aside>
  )
}

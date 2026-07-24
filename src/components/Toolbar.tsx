import { cn } from '@/lib/utils'
import {
  MousePointer2,
  Frame,
  Square,
  Pen,
  Code2,
  Type,
  Scale,
  Hand,
  MessageCircle,
  Pipette,
  SunMoon,
  Share2,
  Play,
  Undo2,
  Redo2,
  Minus,
  Plus,
} from 'lucide-react'
import { useState } from 'react'
import type { CanvasTool } from '@/components/Canvas'

interface ToolbarProps {
  onTogglePplaCode?: () => void
  activeTool: CanvasTool
  onToolChange: (tool: CanvasTool) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

interface ToolButtonProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  className?: string
}

function ToolButton({ icon, label, active, disabled, onClick, className }: ToolButtonProps) {
  return (
    <button
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
        'text-[#b3b3b3] hover:bg-white/10 hover:text-white',
        active && 'bg-[#1971c2] text-white hover:bg-[#1971c2]',
        disabled && 'opacity-30 hover:bg-transparent hover:text-[#b3b3b3] cursor-not-allowed',
        className,
      )}
    >
      {icon}
    </button>
  )
}

/** Ferramentas puramente decorativas (Figma-lookalike) — não têm efeito real no canvas PPLA. */
type DecorativeTool = 'frame' | 'scale' | 'hand' | 'comment'

export function Toolbar({
  onTogglePplaCode,
  activeTool,
  onToolChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: ToolbarProps) {
  const [decorativeTool, setDecorativeTool] = useState<DecorativeTool | null>(null)
  const [zoom, setZoom] = useState(26)

  function selectRealTool(tool: CanvasTool) {
    setDecorativeTool(null)
    onToolChange(tool)
  }

  return (
    <header className="flex items-center h-12 bg-[#2c2c2c] border-b border-[#3a3a3a] px-2 gap-1 select-none shrink-0">
      {/* Logo / Menu */}
      <div className="flex items-center justify-center w-8 h-8 text-[#b3b3b3] hover:text-white cursor-pointer">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="w-px h-6 bg-[#3a3a3a] mx-1" />

      {/* Selection tools */}
      <ToolButton
        icon={<MousePointer2 size={16} />}
        label="Select (V)"
        active={activeTool === 'select'}
        onClick={() => selectRealTool('select')}
      />

      <ToolButton
        icon={<Frame size={16} />}
        label="Frame (F)"
        active={decorativeTool === 'frame'}
        onClick={() => setDecorativeTool('frame')}
      />

      <ToolButton
        icon={<Square size={16} />}
        label="Caixa (R)"
        active={activeTool === 'box'}
        onClick={() => selectRealTool('box')}
      />

      <ToolButton
        icon={<Pen size={16} />}
        label="Linha (L)"
        active={activeTool === 'line'}
        onClick={() => selectRealTool('line')}
      />

      <ToolButton
        icon={<Type size={16} />}
        label="Texto (T)"
        active={activeTool === 'text'}
        onClick={() => selectRealTool('text')}
      />

      <ToolButton
        icon={<Scale size={16} />}
        label="Scale (K)"
        active={decorativeTool === 'scale'}
        onClick={() => setDecorativeTool('scale')}
      />

      <ToolButton
        icon={<Hand size={16} />}
        label="Hand (H)"
        active={decorativeTool === 'hand'}
        onClick={() => setDecorativeTool('hand')}
      />

      <ToolButton
        icon={<MessageCircle size={16} />}
        label="Comment (C)"
        active={decorativeTool === 'comment'}
        onClick={() => setDecorativeTool('comment')}
      />

      <div className="w-px h-6 bg-[#3a3a3a] mx-1" />

      <ToolButton
        icon={<Undo2 size={16} />}
        label="Desfazer (Ctrl+Z)"
        disabled={!canUndo}
        onClick={onUndo}
      />
      <ToolButton
        icon={<Redo2 size={16} />}
        label="Refazer (Ctrl+Shift+Z)"
        disabled={!canRedo}
        onClick={onRedo}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side controls */}
      <ToolButton icon={<Pipette size={16} />} label="Assets" />
      <ToolButton icon={<SunMoon size={16} />} label="Toggle theme" />

      <div className="w-px h-6 bg-[#3a3a3a] mx-1" />

      <button className="flex items-center gap-1.5 px-3 h-7 bg-[#111827] hover:bg-[#0f172a] text-[#e5e5e5] text-xs font-semibold rounded-md transition-colors"
        onClick={onTogglePplaCode}
      >
        <Code2 size={13} />
        <span>Code</span>
      </button>

      <div className="w-px h-6 bg-[#3a3a3a] mx-1" />

      {/* Share button */}
      <button className="flex items-center gap-1.5 px-3 h-7 bg-[#1971c2] hover:bg-[#1864ab] text-white text-xs font-semibold rounded-md transition-colors">
        <Share2 size={13} />
        Share
      </button>

      {/* Play button */}
      <button className="flex items-center justify-center w-7 h-7 text-[#b3b3b3] hover:bg-white/10 hover:text-white rounded-md transition-colors">
        <Play size={15} />
      </button>

      <div className="w-px h-6 bg-[#3a3a3a] mx-1" />

      {/* Zoom control */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => setZoom(z => Math.max(10, z - 10))}
          className="flex items-center justify-center w-6 h-6 text-[#b3b3b3] hover:bg-white/10 hover:text-white rounded transition-colors"
        >
          <Minus size={12} />
        </button>
        <span className="text-xs text-[#b3b3b3] w-10 text-center">{zoom}%</span>
        <button
          onClick={() => setZoom(z => Math.min(400, z + 10))}
          className="flex items-center justify-center w-6 h-6 text-[#b3b3b3] hover:bg-white/10 hover:text-white rounded transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>
    </header>
  )
}

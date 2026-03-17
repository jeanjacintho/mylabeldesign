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
  ChevronDown,
  Minus,
  Plus,
} from 'lucide-react'
import { useState } from 'react'

interface ToolbarProps {
  onTogglePplaCode?: () => void
}

interface ToolButtonProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
  className?: string
}

function ToolButton({ icon, label, active, onClick, className }: ToolButtonProps) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
        'text-[#b3b3b3] hover:bg-white/10 hover:text-white',
        active && 'bg-[#1971c2] text-white hover:bg-[#1971c2]',
        className,
      )}
    >
      {icon}
    </button>
  )
}

type Tool =
  | 'select'
  | 'frame'
  | 'rectangle'
  | 'pen'
  | 'text'
  | 'scale'
  | 'hand'
  | 'comment'

export function Toolbar({ onTogglePplaCode }: ToolbarProps) {
  const [activeTool, setActiveTool] = useState<Tool>('select')
  const [zoom, setZoom] = useState(26)

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
        onClick={() => setActiveTool('select')}
      />

      {/* Shape tools with dropdown indicator */}
      <div className="relative flex items-center">
        <ToolButton
          icon={<Frame size={16} />}
          label="Frame (F)"
          active={activeTool === 'frame'}
          onClick={() => setActiveTool('frame')}
        />
        <ChevronDown size={8} className="absolute -right-0.5 bottom-1 text-[#888] pointer-events-none" />
      </div>

      <div className="relative flex items-center">
        <ToolButton
          icon={<Square size={16} />}
          label="Rectangle (R)"
          active={activeTool === 'rectangle'}
          onClick={() => setActiveTool('rectangle')}
        />
        <ChevronDown size={8} className="absolute -right-0.5 bottom-1 text-[#888] pointer-events-none" />
      </div>

      <div className="relative flex items-center">
        <ToolButton
          icon={<Pen size={16} />}
          label="Pen (P)"
          active={activeTool === 'pen'}
          onClick={() => setActiveTool('pen')}
        />
        <ChevronDown size={8} className="absolute -right-0.5 bottom-1 text-[#888] pointer-events-none" />
      </div>

      <ToolButton
        icon={<Type size={16} />}
        label="Text (T)"
        active={activeTool === 'text'}
        onClick={() => setActiveTool('text')}
      />

      <ToolButton
        icon={<Scale size={16} />}
        label="Scale (K)"
        active={activeTool === 'scale'}
        onClick={() => setActiveTool('scale')}
      />

      <ToolButton
        icon={<Hand size={16} />}
        label="Hand (H)"
        active={activeTool === 'hand'}
        onClick={() => setActiveTool('hand')}
      />

      <ToolButton
        icon={<MessageCircle size={16} />}
        label="Comment (C)"
        active={activeTool === 'comment'}
        onClick={() => setActiveTool('comment')}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side controls */}
      <ToolButton icon={<Pipette size={16} />} label="Assets" />
      <ToolButton icon={<SunMoon size={16} />} label="Toggle theme" />

      <div className="w-px h-6 bg-[#3a3a3a] mx-1" />

      <button
        className="flex items-center gap-1.5 px-3 h-7 bg-[#111827] hover:bg-[#0f172a] text-[#e5e5e5] text-[11px] font-medium rounded-md border border-[#374151] transition-colors"
        onClick={onTogglePplaCode}
      >
        <Code2 size={14} />
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

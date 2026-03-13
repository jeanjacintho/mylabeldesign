import { startTransition } from 'react'
import { AlertTriangle, Braces, FileCode2, ScanText, RotateCcw } from 'lucide-react'

import type { ParsedLabelDocument } from '@openlabel/core'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface CodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceCode: string
  onSourceCodeChange: (value: string) => void
  parsedDocument: ParsedLabelDocument
  onResetSample: () => void
  isParsing: boolean
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-[#363636] bg-[#262626] px-3 py-2">
      <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#7c7c7c]">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  )
}

export function CodeDialog({
  open,
  onOpenChange,
  sourceCode,
  onSourceCodeChange,
  parsedDocument,
  onResetSample,
  isParsing,
}: CodeDialogProps) {
  const usedFonts = Array.from(new Set(
    parsedDocument.elements
      .filter(element => element.kind === 'text')
      .map(element => {
        const fontId = element.font?.residentId ?? '0'
        const typeId = element.font?.typeId ?? '0'
        return `Font ${fontId} / Tipo ${typeId}`
      }),
  )).sort()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[min(88vh,820px)]">
        <DialogHeader>
          <DialogTitle>Code</DialogTitle>
          <DialogDescription>
            Visualize e edite o PPLA da etiqueta. O parser atual converte texto e codigo de barras para a area de edicao e ja roda a partir de `packages/protocols`, com tipos compartilhados em `packages/core`.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[1.2fr_0.8fr] gap-0">
          <section className="flex min-h-0 flex-col border-r border-[#343434] bg-[#1b1b1b]">
            <div className="flex items-center justify-between border-b border-[#343434] px-4 py-3">
              <div>
                <p className="text-xs font-medium text-white">Etiqueta PPLA</p>
                <p className="text-[11px] text-[#868686]">
                  Edicao em tempo real com reconciliacao do preview
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isParsing ? (
                  <span className="rounded-md bg-[#2d3e55] px-2 py-1 text-[11px] font-medium text-[#8cc1ff]">
                    Atualizando preview...
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onResetSample}
                >
                  <RotateCcw size={14} />
                  Restaurar exemplo
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 p-4">
              <textarea
                value={sourceCode}
                onChange={event => {
                  startTransition(() => onSourceCodeChange(event.target.value))
                }}
                spellCheck={false}
                className="h-full w-full resize-none rounded-lg border border-[#383838] bg-[#111111] p-4 font-mono text-[12px] leading-6 text-[#d8d8d8] outline-none transition-colors focus:border-[#1971c2]"
              />
            </div>
          </section>

          <section className="flex min-h-0 flex-col bg-[#202020]">
            <div className="grid grid-cols-2 gap-3 border-b border-[#343434] px-4 py-4">
              <StatCard label="Protocolo" value={parsedDocument.protocol} icon={<FileCode2 size={12} />} />
              <StatCard label="Elementos" value={parsedDocument.elements.length} icon={<ScanText size={12} />} />
              <StatCard label="Comandos" value={parsedDocument.commands.length} icon={<Braces size={12} />} />
              <StatCard label="Warnings" value={parsedDocument.warnings.length} icon={<AlertTriangle size={12} />} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="mb-4 rounded-lg border border-[#363636] bg-[#252525] p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#7b7b7b]">
                  Documento
                </p>
                <div className="space-y-2 text-sm text-[#cbcbcb]">
                  <div className="flex items-center justify-between gap-4">
                    <span>Canvas</span>
                    <span>
                      {parsedDocument.canvas.widthMm}mm x {parsedDocument.canvas.heightMm}mm
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>DPI</span>
                    <span>{parsedDocument.setup.dpi}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Darkness</span>
                    <span>{parsedDocument.setup.darkness ?? '--'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Quantidade</span>
                    <span>{parsedDocument.setup.quantity ?? '--'}</span>
                  </div>
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-[#363636] bg-[#252525] p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#7b7b7b]">
                  Primeiros elementos
                </p>
                <div className="space-y-2">
                  {parsedDocument.elements.slice(0, 8).map(element => (
                    <div
                      key={element.id}
                      className="rounded-md border border-[#343434] bg-[#1e1e1e] px-3 py-2"
                    >
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-[#bdbdbd]">
                        <span>{element.name}</span>
                        <span>{element.kind}</span>
                      </div>
                      <div className="truncate text-[11px] text-[#7c7c7c]">
                        {element.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[#363636] bg-[#252525] p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#7b7b7b]">
                  Parser status
                </p>
                <p className="mb-2 text-xs text-[#a8a8a8]">
                  Fontes detectadas no PPLA: {usedFonts.length ? usedFonts.join(', ') : 'nenhuma'}
                </p>
                {parsedDocument.warnings.length === 0 ? (
                  <p className="text-sm text-[#99d1a7]">
                    Leitura inicial concluida sem warnings. O preview usa origem invertida no eixo Y para aproximar a saida fisica do PPLA.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {parsedDocument.warnings.map(warning => (
                      <p key={warning} className="text-sm text-[#ffb88c]">
                        {warning}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
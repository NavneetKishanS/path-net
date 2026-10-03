'use client'

import type { ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Right-hand panel on wide screens, bottom sheet on phones. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/20 data-[state=open]:animate-[fade-in_120ms_ease-out]" />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex flex-col bg-paper shadow-[0_8px_32px_-12px_oklch(0.2_0.02_255/0.35)] outline-none',
            'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-md border-t border-line',
            'md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[min(520px,92vw)] md:rounded-none md:border-t-0 md:border-l',
            'data-[state=open]:animate-[sheet-in_160ms_cubic-bezier(0.2,0,0,1)]',
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="font-serif text-h3 text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-label text-ink-3">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">Details</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="-mr-1 rounded-sm p-1 text-ink-3 hover:bg-surface hover:text-ink"
              aria-label="Close"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

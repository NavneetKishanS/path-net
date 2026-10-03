import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'quiet'
type Size = 'sm' | 'md'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-paper hover:bg-accent-ink border border-transparent',
  secondary: 'bg-paper text-ink border border-line-strong hover:bg-surface',
  ghost: 'text-ink-2 hover:text-ink hover:bg-surface border border-transparent',
  quiet: 'text-accent-ink hover:underline underline-offset-4 border border-transparent px-0',
}
const SIZE: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-label gap-1.5',
  md: 'h-9 px-3.5 text-ui gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', asChild, className, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      ref={ref}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-sm font-medium whitespace-nowrap transition-[background-color,color,border-color] duration-150 disabled:pointer-events-none disabled:opacity-50',
        VARIANT[variant],
        variant !== 'quiet' && SIZE[size],
        variant === 'quiet' && 'h-auto text-ui',
        className,
      )}
      {...props}
    />
  )
})

import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[15px] font-semibold tracking-[-0.02em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-[#1b64da]',
        destructive: 'bg-destructive text-white hover:bg-[#d63a48]',
        outline:
          'border-0 bg-secondary text-secondary-foreground hover:bg-secondary-hover',
        secondary:
          'border-0 bg-secondary text-secondary-foreground hover:bg-secondary-hover',
        ghost: 'hover:bg-muted text-foreground',
        ghostDestructive:
          'text-destructive hover:bg-[#fff1f1] hover:text-[#d63a48] dark:hover:bg-[#3a1d22]',
        softDestructive:
          'bg-[#fff1f1] text-destructive hover:bg-[#ffe4e4] hover:text-[#d63a48] dark:bg-[#3a1d22] dark:text-[#f08890] dark:hover:bg-[#4a2429]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-12 px-5',
        sm: 'h-9 rounded-[10px] px-3.5 text-[13px]',
        lg: 'h-14 rounded-2xl px-6 text-[17px]',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>

import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[15px] font-semibold tracking-[-0.01em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        destructive: 'bg-destructive text-white hover:bg-[#be123c]',
        outline:
          'border-0 bg-secondary text-secondary-foreground hover:bg-secondary-hover',
        secondary:
          'border-0 bg-secondary text-secondary-foreground hover:bg-secondary-hover',
        ghost: 'hover:bg-muted text-foreground',
        ghostDestructive:
          'text-destructive hover:bg-[#fff1f2] hover:text-[#be123c] dark:hover:bg-[#3a1d22]',
        softDestructive:
          'bg-[#fff1f2] text-destructive hover:bg-[#ffe4e6] hover:text-[#be123c] dark:bg-[#3a1d22] dark:text-[#fb7185] dark:hover:bg-[#4a2429]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-12 px-5',
        sm: 'h-9 rounded-md px-3.5 text-[13px]',
        lg: 'h-14 rounded-xl px-6 text-[17px]',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>

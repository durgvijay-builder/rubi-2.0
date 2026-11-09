import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const badgeVariants = cva(
  'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-ring select-none tabular-nums',
  {
    variants: {
      variant: {
        default: 'border border-transparent bg-[#ededed] text-[#141415]',
        secondary: 'border border-border/60 bg-[#232325] text-[#a1a1a6]',
        destructive: 'border border-rose-500/20 bg-rose-500/10 text-[#e5484d]',
        outline: 'border border-border/80 text-[#85858b] bg-transparent',
        ruby: 'border border-ruby-500/20 bg-ruby-950/40 text-ruby-300',
        success: 'border border-emerald-500/20 bg-emerald-500/10 text-[#4cc38a]',
        warning: 'border border-amber-500/20 bg-amber-500/10 text-amber-300',
        info: 'border border-sky-500/20 bg-sky-500/10 text-sky-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };


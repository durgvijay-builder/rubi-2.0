import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 min-h-[44px] min-w-[44px] px-4 py-2 select-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-[#ededed] text-[#141415] hover:bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] font-medium',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
        outline: 'border border-border/80 bg-secondary/40 text-foreground hover:bg-secondary hover:text-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/40',
        ghost: 'hover:bg-secondary/60 text-muted-foreground hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline min-h-0 min-w-0 p-0 active:scale-100',
        ruby: 'bg-ruby-600 text-white hover:bg-ruby-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-xs min-h-[36px]',
        lg: 'h-11 rounded-lg px-6 text-sm',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };


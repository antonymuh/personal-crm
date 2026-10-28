import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sketch font-display text-sm font-bold transition-[transform,box-shadow,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "border-[2.5px] border-ink bg-primary text-primary-foreground shadow-pop-sm hover:-translate-y-0.5 hover:shadow-pop active:translate-y-0.5 active:shadow-pop-xs",
        destructive:
          "border-[2.5px] border-ink bg-destructive text-destructive-foreground shadow-pop-sm hover:-translate-y-0.5 hover:shadow-pop active:translate-y-0.5 active:shadow-pop-xs",
        outline:
          "border-[2.5px] border-ink bg-card text-foreground shadow-pop-xs hover:-translate-y-0.5 hover:shadow-pop-sm active:translate-y-0.5 active:shadow-none",
        secondary:
          "border-[2.5px] border-ink bg-secondary text-secondary-foreground shadow-pop-xs hover:-translate-y-0.5 hover:shadow-pop-sm",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3.5 text-xs",
        lg: "h-14 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

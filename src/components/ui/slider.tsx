import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Slider({
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        "relative flex w-full touch-none select-none items-center disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-surface-strong">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-3.5 rounded-full border border-border-strong bg-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none" />
    </SliderPrimitive.Root>
  )
}

export { Slider }

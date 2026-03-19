import { forwardRef } from "react";
import { Handle, type HandleProps } from "@xyflow/react";

import { cn } from "~/lib/utils";

export type BaseHandleProps = HandleProps;

export const BaseHandle = forwardRef<HTMLDivElement, BaseHandleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <Handle
        ref={ref}
        {...props}
        className={cn(
          "h-[6px] w-[6px] rounded-full border-0 bg-white/15 transition",
          className,
        )}
        {...props}
      >
        {children}
      </Handle>
    );
  },
);

BaseHandle.displayName = "BaseHandle";

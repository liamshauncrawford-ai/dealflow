"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  delayMs?: number;
}

const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  ({ children, content, side = "top", className, delayMs = 200, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const showTooltip = React.useCallback(() => {
      timeoutRef.current = setTimeout(() => {
        setVisible(true);
      }, delayMs);
    }, [delayMs]);

    const hideTooltip = React.useCallback(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setVisible(false);
    }, []);

    React.useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    const positionClasses = {
      top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
      bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
      left: "right-full top-1/2 -translate-y-1/2 mr-2",
      right: "left-full top-1/2 -translate-y-1/2 ml-2",
    };

    return (
      <div
        ref={ref}
        className="relative inline-flex"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        {...props}
      >
        {children}
        {visible && content && (
          <div
            role="tooltip"
            className={cn(
              "absolute z-50 max-w-xs rounded-md bg-popover-foreground px-3 py-1.5 text-xs text-popover shadow-md animate-in fade-in-0 zoom-in-95",
              positionClasses[side],
              className
            )}
          >
            {content}
          </div>
        )}
      </div>
    );
  }
);
Tooltip.displayName = "Tooltip";

export { Tooltip };

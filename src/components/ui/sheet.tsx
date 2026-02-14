"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const SheetContext = React.createContext<SheetContextValue | undefined>(
  undefined
);

function useSheetContext() {
  const context = React.useContext(SheetContext);
  if (!context) {
    throw new Error("Sheet components must be used within a <Sheet /> parent");
  }
  return context;
}

interface SheetProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function Sheet({ children, open: controlledOpen, onOpenChange }: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (value: React.SetStateAction<boolean>) => {
      const nextValue =
        typeof value === "function" ? value(open) : value;
      if (isControlled) {
        onOpenChange?.(nextValue);
      } else {
        setUncontrolledOpen(nextValue);
      }
    },
    [open, isControlled, onOpenChange]
  );

  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      {children}
    </SheetContext.Provider>
  );
}

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "right" | "left";
  onClose?: () => void;
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, children, side = "right", onClose, ...props }, ref) => {
    const { open, setOpen } = useSheetContext();
    const [mounted, setMounted] = React.useState(false);
    const [visible, setVisible] = React.useState(false);

    React.useEffect(() => {
      setMounted(true);
    }, []);

    React.useEffect(() => {
      if (open) {
        // Small delay to trigger CSS transition
        requestAnimationFrame(() => setVisible(true));
      } else {
        setVisible(false);
      }
    }, [open]);

    React.useEffect(() => {
      if (!open) return;

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setOpen(false);
          onClose?.();
        }
      };

      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";

      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "";
      };
    }, [open, setOpen, onClose]);

    if (!mounted || !open) return null;

    const sideClasses = side === "right"
      ? cn("right-0 top-0 h-full", visible ? "translate-x-0" : "translate-x-full")
      : cn("left-0 top-0 h-full", visible ? "translate-x-0" : "-translate-x-full");

    return createPortal(
      <div className="fixed inset-0 z-50">
        {/* Overlay */}
        <div
          className={cn(
            "fixed inset-0 bg-black/50 transition-opacity duration-300",
            visible ? "opacity-100" : "opacity-0"
          )}
          onClick={() => {
            setOpen(false);
            onClose?.();
          }}
          aria-hidden="true"
        />
        {/* Panel */}
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          className={cn(
            "fixed z-50 flex flex-col border bg-background shadow-xl transition-transform duration-300 ease-in-out",
            sideClasses,
            className
          )}
          {...props}
        >
          <button
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
            onClick={() => {
              setOpen(false);
              onClose?.();
            }}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          {children}
        </div>
      </div>,
      document.body
    );
  }
);
SheetContent.displayName = "SheetContent";

const SheetHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 px-6 py-4 border-b", className)}
    {...props}
  />
));
SheetHeader.displayName = "SheetHeader";

const SheetTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";

export {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};

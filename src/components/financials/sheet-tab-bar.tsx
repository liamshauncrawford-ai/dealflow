"use client";

interface SheetTabBarProps {
  sheets: Array<{ id: string; title: string | null }>;
  activeSheetId: string;
  onSheetChange: (sheetId: string) => void;
}

export function SheetTabBar({
  sheets,
  activeSheetId,
  onSheetChange,
}: SheetTabBarProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {sheets.map((sheet) => {
        const isActive = sheet.id === activeSheetId;
        const label = sheet.title || "Untitled";

        return (
          <button
            key={sheet.id}
            onClick={() => onSheetChange(sheet.id)}
            className={`
              rounded-full px-3 py-1 text-xs font-medium transition-colors
              ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }
            `}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

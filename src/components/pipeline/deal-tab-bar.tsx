"use client";

import { LayoutDashboard, BarChart3, Calculator } from "lucide-react";

export type DealTab = "overview" | "financials" | "valuation";

interface DealTabBarProps {
  activeTab: DealTab;
  onTabChange: (tab: DealTab) => void;
}

const TABS: { id: DealTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "financials", label: "Financials", icon: BarChart3 },
  { id: "valuation", label: "Valuation", icon: Calculator },
];

export function DealTabBar({ activeTab, onTabChange }: DealTabBarProps) {
  return (
    <div className="border-b border-border">
      <nav className="-mb-px flex gap-6" aria-label="Deal tabs">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`
                flex items-center gap-2 border-b-2 px-1 pb-3 pt-2 text-sm font-medium transition-colors
                ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                }
              `}
              aria-selected={isActive}
              role="tab"
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

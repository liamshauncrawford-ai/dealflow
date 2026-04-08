"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Kanban,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Building2,
  Map,
  BarChart3,
  TrendingUp,
  Calculator,
  Layers,
  GitCompare,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const mainNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Target Businesses", href: "/listings", icon: Building2 },
  { label: "Pipeline", href: "/pipeline", icon: Kanban },
  { label: "Contacts", href: "/contacts", icon: Users },
];

const marketIntelItems: NavItem[] = [
  { label: "Market Overview", href: "/market-intel/overview", icon: BarChart3 },
  { label: "Market Map", href: "/market-intel/map", icon: Map },
  { label: "Comparables", href: "/market-intel/comparables", icon: TrendingUp },
];

const financialItems: NavItem[] = [
  { label: "Valuation Calc", href: "/financial/valuation", icon: Calculator },
  { label: "Roll-Up Model", href: "/financial/rollup", icon: Layers },
  { label: "Deal Comparison", href: "/financial/compare", icon: GitCompare },
];

const aiAgentItems: NavItem[] = [
  { label: "Agent Dashboard", href: "/agents", icon: Bot },
];

const bottomNavItems: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar text-white shadow-lg md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col sidebar-gradient transition-all duration-300",
          // Desktop: always visible, respects collapsed state
          "hidden md:flex",
          collapsed ? "md:w-16" : "md:w-60",
          // Mobile: shown via mobileOpen state
          mobileOpen && "flex w-60"
        )}
      >
        {/* Logo + Mobile Close */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white shadow-lg shadow-indigo-500/20">
              D
            </div>
            {!collapsed && (
              <span className="text-lg font-semibold tracking-tight text-white">
                DealFlow
              </span>
            )}
          </Link>
          {/* Close button on mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-text hover:bg-sidebar-hover hover:text-white md:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          ))}

          {/* Market Intel Section */}
          <SectionLabel collapsed={collapsed} label="Market Intel" />
          {marketIntelItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          ))}

          {/* Financial Analysis Section */}
          <SectionLabel collapsed={collapsed} label="Financial Analysis" />
          {financialItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          ))}

          {/* AI Agents Section */}
          <SectionLabel collapsed={collapsed} label="AI Agents" />
          {aiAgentItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          ))}

          {/* Separator */}
          <div className="my-3 border-t border-sidebar-border" />

          {bottomNavItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Theme Toggle + Collapse — desktop only */}
        <div className="hidden border-t border-sidebar-border p-3 md:block space-y-0.5">
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 px-3")}>
            <ThemeToggle
              className={cn(
                "flex items-center gap-3 rounded-lg py-2 text-sm text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-white",
                collapsed ? "justify-center p-2" : "px-0"
              )}
            />
            {!collapsed && <span className="text-sm text-sidebar-text">Theme</span>}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-white",
              collapsed && "justify-center px-0"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5 shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

function SectionLabel({ collapsed, label }: { collapsed: boolean; label: string }) {
  return (
    <>
      <div className="my-3 border-t border-sidebar-border" />
      {!collapsed && (
        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-text/50">
          {label}
        </p>
      )}
    </>
  );
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
        active
          ? "nav-active-glow text-white"
          : "text-sidebar-text hover:bg-sidebar-hover hover:text-white",
        collapsed && "justify-center px-0"
      )}
      title={collapsed ? item.label : undefined}
    >
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          active ? "text-primary" : "text-sidebar-text group-hover:text-white"
        )}
      />
      {!collapsed && (
        <>
          <span className="flex-1">{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white">
              {item.badge}
            </span>
          )}
        </>
      )}
      {collapsed && item.badge !== undefined && item.badge > 0 && (
        <span className="absolute right-1 top-0.5 h-2 w-2 rounded-full bg-primary" />
      )}
    </Link>
  );
}

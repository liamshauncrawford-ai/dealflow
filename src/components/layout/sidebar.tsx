"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  List,
  Kanban,
  Users,
  Activity,
  ScrollText,
  Copy,
  EyeOff,
  FolderOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Building2,
  HardHat,
  Cable,
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
  { label: "Listings", href: "/listings", icon: List },
  { label: "Pipeline", href: "/pipeline", icon: Kanban },
  { label: "Contacts", href: "/contacts", icon: Users },
  { label: "Activity", href: "/activity", icon: Activity },
  { label: "Audit Log", href: "/audit", icon: ScrollText },
  { label: "Historical Deals", href: "/settings/import", icon: FolderOpen },
  { label: "Duplicates", href: "/settings/dedup", icon: Copy, badge: 0 },
  { label: "Hidden", href: "/hidden", icon: EyeOff },
];

const marketIntelItems: NavItem[] = [
  { label: "DC Operators", href: "/market-intel/operators", icon: Building2 },
  { label: "GC Tracker", href: "/market-intel/gcs", icon: HardHat },
  { label: "Cabling Pipeline", href: "/market-intel/opportunities", icon: Cable },
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
        className="fixed left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white shadow-lg md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col bg-slate-900 text-slate-300 transition-all duration-300",
          // Desktop: always visible, respects collapsed state
          "hidden md:flex",
          collapsed ? "md:w-16" : "md:w-60",
          // Mobile: shown via mobileOpen state
          mobileOpen && "flex w-60"
        )}
      >
        {/* Logo + Mobile Close */}
        <div className="flex h-16 items-center justify-between border-b border-slate-700/50 px-4">
          <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-white">
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
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          ))}

          {/* Market Intel Section */}
          <div className="my-3 border-t border-slate-700/50" />
          {!collapsed && (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Market Intel
            </p>
          )}
          {marketIntelItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              collapsed={collapsed}
            />
          ))}

          {/* Separator */}
          <div className="my-3 border-t border-slate-700/50" />

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
        <div className="hidden border-t border-slate-700/50 p-3 md:block space-y-1">
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3 px-3")}>
            <ThemeToggle
              className={cn(
                "flex items-center gap-3 rounded-lg py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white",
                collapsed ? "justify-center p-2" : "px-0"
              )}
            />
            {!collapsed && <span className="text-sm text-slate-400">Theme</span>}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white",
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
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-slate-400 hover:bg-slate-800 hover:text-white",
        collapsed && "justify-center px-0"
      )}
      title={collapsed ? item.label : undefined}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          active ? "text-primary" : "text-slate-400 group-hover:text-white"
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

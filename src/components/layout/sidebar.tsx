/**
 * Sidebar — Role-based navigation for the dashboard
 * Shows different links for STREAMER, BRAND, and ADMIN roles.
 * Responsive: overlay on mobile, fixed on desktop.
 */
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import {
  LayoutDashboard,
  Link2,
  DollarSign,
  ShoppingBag,
  Settings,
  Megaphone,
  Users,
  CreditCard,
  FileText,
  ShieldCheck,
  Wallet,
  BarChart3,
  X,
  Zap,
} from "lucide-react";

// ---- Navigation config per role ----

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STREAMER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/streamer", icon: LayoutDashboard },
  { label: "My Links", href: "/streamer/links", icon: Link2 },
  { label: "Earnings", href: "/streamer/earnings", icon: DollarSign },
  { label: "Marketplace", href: "/streamer/marketplace", icon: ShoppingBag },
  { label: "Settings", href: "/streamer/settings", icon: Settings },
];

const BRAND_NAV: NavItem[] = [
  { label: "Dashboard", href: "/brand", icon: LayoutDashboard },
  { label: "Campaigns", href: "/brand/campaigns", icon: Megaphone },
  { label: "Applications", href: "/brand/applications", icon: Users },
  { label: "Billing", href: "/brand/billing", icon: CreditCard },
  { label: "Settings", href: "/brand/settings", icon: Settings },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Fraud Queue", href: "/admin?tab=fraud", icon: ShieldCheck },
  { label: "Payouts", href: "/admin?tab=payouts", icon: Wallet },
  { label: "Users", href: "/admin?tab=users", icon: Users },
  { label: "Campaigns", href: "/admin/campaigns", icon: Megaphone },
  { label: "Reports", href: "/admin/reports", icon: BarChart3 },
];

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  STREAMER: STREAMER_NAV,
  BRAND: BRAND_NAV,
  ADMIN: ADMIN_NAV,
};

// ---- Component ----

interface SidebarProps {
  role: UserRole;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const navItems = NAV_BY_ROLE[role] || [];

  const isActive = (href: string) => {
    // Exact match for dashboard root, startsWith for sub-pages
    if (href.includes("?")) {
      return pathname === href.split("?")[0];
    }
    if (href === "/streamer" || href === "/brand" || href === "/admin") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform duration-200 lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo / Brand */}
        <div className="flex h-16 items-center justify-between border-b px-6">
          <Link href="/" className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">
              Stream<span className="text-primary">CPA</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn("h-5 w-5", active && "text-primary")}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t p-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {role === "STREAMER" && "Streamer Dashboard"}
              {role === "BRAND" && "Brand Portal"}
              {role === "ADMIN" && "Admin Panel"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              StreamCPA v1.0
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

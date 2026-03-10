/**
 * Header — Top bar with user menu, mobile hamburger, and breadcrumbs
 */
"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Menu,
  Bell,
  Settings,
  LogOut,
  ChevronRight,
  User as UserIcon,
} from "lucide-react";

interface HeaderUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
}

interface HeaderProps {
  user: HeaderUser;
  onMenuClick: () => void;
}

// ---- Breadcrumb generator ----

function getBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];

  // Map known segments to readable labels
  const labelMap: Record<string, string> = {
    streamer: "Dashboard",
    brand: "Dashboard",
    admin: "Admin",
    links: "My Links",
    earnings: "Earnings",
    marketplace: "Marketplace",
    settings: "Settings",
    campaigns: "Campaigns",
    applications: "Applications",
    billing: "Billing",
    new: "New",
  };

  let path = "";
  for (const segment of segments) {
    path += `/${segment}`;
    const label = labelMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    crumbs.push({ label, href: path });
  }

  return crumbs;
}

// ---- Component ----

export function Header({ user, onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const breadcrumbs = getBreadcrumbs(pathname);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const settingsHref =
    user.role === "BRAND" ? "/brand/settings" : "/streamer/settings";

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
      {/* Left: hamburger + breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 hover:bg-muted lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumbs (hidden on mobile) */}
        <nav className="hidden items-center gap-1 text-sm lg:flex">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {i === breadcrumbs.length - 1 ? (
                <span className="font-medium text-foreground">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* Right: notifications + user menu */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <Link
          href="#notifications"
          className="relative rounded-md p-2 hover:bg-muted"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {/* TODO: badge count from notification query */}
        </Link>

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-muted"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.image || undefined} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium lg:inline-block">
              {user.name || "User"}
            </span>
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border bg-card py-1 shadow-lg">
              {/* User info */}
              <div className="border-b px-4 py-3">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>

              {/* Links */}
              <div className="py-1">
                <Link
                  href={settingsHref}
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <Link
                  href={`/${user.role?.toLowerCase()}`}
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted"
                >
                  <UserIcon className="h-4 w-4" />
                  My Dashboard
                </Link>
              </div>

              {/* Logout */}
              <div className="border-t py-1">
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-muted"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

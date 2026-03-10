/**
 * Dashboard layout - sidebar + header + main content area
 * Used for all authenticated routes: /streamer/*, /brand/*, /admin/*
 *
 * Wraps children with TRPCProvider so all dashboard pages
 * can use tRPC hooks (trpc.xxx.useQuery, useMutation, etc.)
 */
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { TRPCProvider } from "@/lib/trpc-provider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!session) return null;

  return (
    <TRPCProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          role={session.user.role}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            user={session.user}
            onMenuClick={() => setSidebarOpen(true)}
          />
          <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
            {children}
          </main>
        </div>
      </div>
    </TRPCProvider>
  );
}

"use client";

import React from "react";
import { useSession } from "@/app/components/providers/SessionProvider"; // update path if different
import {AppSidebar} from "@/app/components/sidebar"; // path to your sidebar component
import { SidebarProvider } from "@/components/ui/sidebar"; // your sidebar provider

export default function SidebarGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();

  // while loading you can show nothing or a small skeleton
  if (loading) {
    return <>{children}</>; // or a spinner/skeleton if you want
  }

  // If user exists -> show sidebar + children
  if (user) {
    return (
      <SidebarProvider>
        <AppSidebar />
        {children}
      </SidebarProvider>
    );
  }

  // No user -> render children only (no sidebar)
  return <>{children}</>;
}

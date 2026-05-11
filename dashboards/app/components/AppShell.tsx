"use client";

import React, { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BrandHeader } from "./BrandHeader";
import { LeftNav } from "./LeftNav";

type AppShellProps = Readonly<{ children: ReactNode }>;

const DASHBOARD_NAME_BY_PATH: Record<string, string> = {
  "/dashboards/reach-assessment-and-measures": "Reach - Assessment and Measures",
  "/dashboards/reach-file-report": "Reach - File Report",
  "/dashboards/reach-letter-fulfilment": "Reach - Letter Fulfilment",
  "/dashboards/reach-sdoh": "Reach - SDOH",
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const showBackButton = pathname.startsWith("/dashboards/");
  const dashboardName = DASHBOARD_NAME_BY_PATH[pathname] ?? null;

  return (
    <div className="min-h-full bg-white text-slate-900">
      <BrandHeader showBackButton={showBackButton} dashboardName={dashboardName} />
      <div className="flex min-h-[calc(100vh-4rem)]">
        <LeftNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

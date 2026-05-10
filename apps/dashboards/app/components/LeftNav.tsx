"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

const navItems = [
  { label: "Home", href: "/", matchPath: "/", icon: HomeIcon },
  {
    label: "Assessment and Measures",
    href: "/dashboards/reach-assessment-and-measures",
    matchPath: "/dashboards/reach-assessment-and-measures",
    icon: ClipboardIcon,
  },
  {
    label: "File Report",
    href: "/dashboards/reach-file-report",
    matchPath: "/dashboards/reach-file-report",
    icon: ReportIcon,
  },
  {
    label: "Letter Fulfilment",
    href: "/dashboards/reach-letter-fulfilment",
    matchPath: "/dashboards/reach-letter-fulfilment",
    icon: MailIcon,
  },
  {
    label: "SDOH",
    href: "/dashboards/reach-sdoh",
    matchPath: "/dashboards/reach-sdoh",
    icon: HeartIcon,
  },
];

export function LeftNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-16 shrink-0 border-r border-slate-200 bg-slate-50/70 lg:block">
      <div className="sticky top-16 flex items-center justify-center px-1.5 py-4">
        <nav className="flex flex-col items-center gap-2">
          {navItems.map((item) => {
            const isActive = item.matchPath === null ? false : pathname === item.matchPath;
            const Icon = item.icon;

            return (
              <div key={item.label} className="group relative">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors ${
                    isActive
                      ? "border-slate-400 bg-transparent text-slate-900"
                      : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  <Icon />
                </Link>
                <span className="pointer-events-none absolute left-full top-1/2 z-10 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  {item.label}
                </span>
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M3 10.5L12 3l9 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.25 9.75V21h13.5V9.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M9 3.75h6M9 3.75A2.25 2.25 0 006.75 6v13.5A2.25 2.25 0 009 21.75h6a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0015 3.75M9 3.75A2.25 2.25 0 0111.25 1.5h1.5A2.25 2.25 0 0115 3.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12h6M9 15.75h4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M7.5 3.75h6l3 3V20.25A.75.75 0 0115.75 21h-8.5a.75.75 0 01-.75-.75v-15a1.5 1.5 0 011.5-1.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 3.75v3h3M9 12h6M9 15h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M3.75 5.25h16.5A1.5 1.5 0 0121.75 6.75v10.5a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V6.75a1.5 1.5 0 011.5-1.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.25 6.75l9.75 6.75 9.75-6.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M12 21C12 21 3 14.25 3 8.625a4.875 4.875 0 019-2.625 4.875 4.875 0 019 2.625C21 14.25 12 21 12 21z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

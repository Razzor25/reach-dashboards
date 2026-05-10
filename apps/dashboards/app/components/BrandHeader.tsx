import React from "react";
import Image from "next/image";
import Link from "next/link";

type BrandHeaderProps = {
  showBackButton?: boolean;
  dashboardName?: string | null;
};

export function BrandHeader({ showBackButton = false, dashboardName = null }: BrandHeaderProps) {
  return (
    <header className="w-full border-b border-slate-200 bg-white">
      <div className="app-width-left flex h-16 items-center gap-3">
        {showBackButton ? (
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            Back
          </Link>
        ) : null}
        <Image
          src="/optum-logo.png"
          alt="Optum logo"
          width={150}
          height={40}
          className="h-auto w-auto"
          style={{ maxHeight: "2.5rem" }}
          priority
        />
        <span aria-hidden="true" className="h-8 w-px bg-slate-300" />
        <Image
          src="/curo-logo.svg"
          alt="Curo logo"
          width={32}
          height={32}
          className="h-auto w-8"
          priority
        />
        <h1 className="text-xl font-semibold tracking-tight">
          Reach Dashboards{dashboardName ? ` - ${dashboardName}` : ""}
        </h1>
      </div>
    </header>
  );
}

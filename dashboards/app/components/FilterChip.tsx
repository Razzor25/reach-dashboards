import React from "react";

interface FilterChipProps {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  size?: "sm" | "md";
  badge?: number;
  children?: React.ReactNode;
}

export function FilterChip({
  label,
  isSelected,
  onClick,
  size = "md",
  badge,
  children,
}: FilterChipProps) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs font-medium",
    md: "px-4 py-2 text-sm font-medium",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border transition-colors whitespace-nowrap ${
        isSelected
          ? "border-cyan-500 bg-cyan-600 text-white"
          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
      } ${sizeClasses[size]}`}
    >
      {label}
      {badge !== undefined && (
        <span className="ml-1 rounded-full bg-cyan-600 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
          {badge}
        </span>
      )}
      {children}
    </button>
  );
}

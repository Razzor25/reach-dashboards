"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@uhg-netra-ai/core-react-components/ui/select";

interface FilterSelectProps {
  id: string;
  label: string;
  value: string;
  options: string[];
  optionLabels?: string[];
  size?: "sm" | "md";
  onChange: (value: string) => void;
}

export function FilterSelect({
  id,
  label,
  value,
  options,
  optionLabels,
  size = "md",
  onChange,
}: FilterSelectProps) {
  const sizeClasses = {
    sm: "h-8 px-2 text-sm",
    md: "h-10 px-3 text-sm",
  };

  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          className={`w-full rounded-lg border-slate-300 bg-white text-slate-700 focus:border-cyan-500 ${sizeClasses[size]}`}
        >
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option, index) => (
            <SelectItem key={option} value={option}>
              {optionLabels?.[index] ?? option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

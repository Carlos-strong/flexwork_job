import React from "react";

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
  className?: string;
  placeholder?: string;
}

export function Select({ value, onValueChange, children, className }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      className={`w-full rounded-lg border border-[#DADFDD] bg-white px-3 py-2 text-[13.5px] text-[#14213D] outline-none focus:border-[#1F7A5C] ${className ?? ""}`}
    >
      {children}
    </select>
  );
}
export function SelectTrigger({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={`flex items-center justify-between rounded-lg border border-[#DADFDD] bg-white px-3 py-2 text-[13.5px] ${className ?? ""}`}>{children}</div>;
}
export function SelectValue({ placeholder }: { placeholder?: string }) {
  return <span className="text-[#6B7280]">{placeholder}</span>;
}
export function SelectContent({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}
export function SelectItem({ value, children }: { value: string; children?: React.ReactNode }) {
  return <option value={value}>{children}</option>;
}

import React, { useState, useRef, useEffect } from "react";

interface DropdownMenuProps { children: React.ReactNode }
interface DropdownMenuTriggerProps { children: React.ReactNode; asChild?: boolean; className?: string }
interface DropdownMenuContentProps { children: React.ReactNode; className?: string; align?: "start" | "end" }
interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { inset?: boolean }
interface DropdownMenuSeparatorProps { className?: string }
interface DropdownMenuLabelProps { children?: React.ReactNode; className?: string }

const Ctx = React.createContext<{ open: boolean; setOpen: (v: boolean) => void }>({ open: false, setOpen: () => {} });

export function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
}
export function DropdownMenuTrigger({ children, asChild, className }: DropdownMenuTriggerProps) {
  const { open, setOpen } = React.useContext(Ctx);
  return (
    <button onClick={() => setOpen(!open)} className={className}>
      {children}
    </button>
  );
}
export function DropdownMenuContent({ children, className, align }: DropdownMenuContentProps) {
  const { open } = React.useContext(Ctx);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { /* close handled by parent */ } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  if (!open) return null;
  return (
    <div ref={ref} className={`absolute z-50 min-w-[180px] rounded-lg border border-[#DADFDD] bg-white shadow-lg ${align === "end" ? "right-0" : "left-0"} ${className ?? ""}`}>
      {children}
    </div>
  );
}
export function DropdownMenuItem({ className, inset, children, ...props }: DropdownMenuItemProps) {
  return (
    <button className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#14213D] hover:bg-[#F5F6F4] transition-colors ${inset ? "pl-8" : ""} ${className ?? ""}`} {...props}>
      {children}
    </button>
  );
}
export function DropdownMenuSeparator({ className }: DropdownMenuSeparatorProps) {
  return <div className={`h-px bg-[#DADFDD] my-1 ${className ?? ""}`} />;
}
export function DropdownMenuLabel({ children, className }: DropdownMenuLabelProps) {
  return <div className={`px-3 py-2 text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider ${className ?? ""}`}>{children}</div>;
}

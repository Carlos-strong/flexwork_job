import React, { useState, useEffect } from "react";

interface DialogProps { open?: boolean; onOpenChange?: (v: boolean) => void; children: React.ReactNode }
interface DialogContentProps { children: React.ReactNode; className?: string }
interface DialogHeaderProps { children: React.ReactNode; className?: string }
interface DialogTitleProps { children: React.ReactNode; className?: string }
interface DialogDescriptionProps { children: React.ReactNode; className?: string }

const Ctx = React.createContext<{ open: boolean; onOpenChange?: (v: boolean) => void }>({ open: false });

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return <Ctx.Provider value={{ open: open ?? false, onOpenChange }}>{children}</Ctx.Provider>;
}
export function DialogContent({ children, className }: DialogContentProps) {
  const { open, onOpenChange } = React.useContext(Ctx);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange?.(false); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onOpenChange]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45" onClick={() => onOpenChange?.(false)}>
      <div className={`bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto ${className ?? ""}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
export function DialogHeader({ className, children }: DialogHeaderProps) {
  return <div className={`px-6 pt-6 pb-2 ${className ?? ""}`}>{children}</div>;
}
export function DialogTitle({ className, children }: DialogTitleProps) {
  return <h2 className={`text-[18px] font-semibold text-[#1A1916] ${className ?? ""}`}>{children}</h2>;
}
export function DialogDescription({ className, children }: DialogDescriptionProps) {
  return <p className={`text-[13px] text-[#5A5750] mt-1 ${className ?? ""}`}>{children}</p>;
}
export function DialogFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E0D9] ${className ?? ""}`}>{children}</div>;
}

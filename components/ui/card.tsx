import React from "react";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-lg border border-[#E2E0D9] bg-white shadow-sm ${className ?? ""}`} {...props}>{children}</div>;
}
export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex flex-col gap-1.5 p-6 ${className ?? ""}`} {...props}>{children}</div>;
}
export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`text-[16px] font-semibold text-[#1A1916] ${className ?? ""}`} {...props}>{children}</h3>;
}
export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`text-[13px] text-[#5A5750] ${className ?? ""}`} {...props}>{children}</p>;
}
export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-6 pt-0 ${className ?? ""}`} {...props}>{children}</div>;
}
export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex items-center p-6 pt-0 ${className ?? ""}`} {...props}>{children}</div>;
}

// Tabs (exported from card for compatibility with ApplicationList)
export function Tabs({ value, onValueChange, children, className }: { value?: string; onValueChange?: (v: string) => void; children?: React.ReactNode; className?: string }) {
  return <div className={className} data-value={value} data-onchange={onValueChange ? "true" : undefined}>{children}</div>;
}
export function TabsList({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={`flex gap-1 rounded-lg bg-[#F5F6F4] p-1 ${className ?? ""}`}>{children}</div>;
}
export function TabsTrigger({ value, children, className, onClick }: { value: string; children?: React.ReactNode; className?: string; onClick?: () => void }) {
  return <button onClick={onClick} className={`px-3 py-1.5 text-[13px] font-medium rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm ${className ?? ""}`} data-value={value}>{children}</button>;
}
export function TabsContent({ value, children, className }: { value: string; children?: React.ReactNode; className?: string }) {
  return <div className={className} data-value={value}>{children}</div>;
}

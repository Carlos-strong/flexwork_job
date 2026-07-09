import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline";
}

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  const variants: Record<string, string> = {
    default: "bg-[#1F7A5C] text-white",
    secondary: "bg-[#F0F1F5] text-[#4A5178]",
    outline: "border border-[#DADFDD] text-[#6B7280]",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${variants[variant]} ${className ?? ""}`} {...props}>
      {children}
    </span>
  );
}

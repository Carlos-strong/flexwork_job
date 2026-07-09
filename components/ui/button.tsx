import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
}

export function Button({ className, variant = "default", size = "md", children, ...props }: ButtonProps) {
  const variants: Record<string, string> = {
    default: "bg-[#1F7A5C] text-white hover:bg-[#166C4F]",
    outline: "border border-[#DADFDD] bg-white text-[#14213D] hover:bg-[#F5F6F4]",
    ghost: "text-[#6B7280] hover:bg-[#F5F6F4]",
    destructive: "bg-red-600 text-white hover:bg-red-700",
  };
  const sizes: Record<string, string> = {
    sm: "px-3 py-1.5 text-[12px]",
    md: "px-4 py-2 text-[13px]",
    lg: "px-5 py-2.5 text-[14px]",
  };
  return (
    <button className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className ?? ""}`} {...props}>
      {children}
    </button>
  );
}

import React from "react";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive";
}

export function Alert({ className, variant = "default", children, ...props }: AlertProps) {
  const variants: Record<string, string> = {
    default: "bg-[#F5F6F4] border-[#DADFDD] text-[#14213D]",
    destructive: "bg-red-50 border-red-200 text-red-700",
  };
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${variants[variant]} ${className ?? ""}`} {...props}>
      {children}
    </div>
  );
}
export function AlertDescription({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`text-[13px] leading-relaxed ${className ?? ""}`} {...props}>{children}</div>;
}

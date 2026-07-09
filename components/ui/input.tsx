import React from "react";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-[#DADFDD] bg-white px-3 py-2 text-[13.5px] text-[#14213D] outline-none focus:border-[#1F7A5C] focus:ring-1 focus:ring-[#1F7A5C]/30 placeholder:text-[#9CA3AF] disabled:opacity-50 ${className ?? ""}`}
      {...props}
    />
  );
}
